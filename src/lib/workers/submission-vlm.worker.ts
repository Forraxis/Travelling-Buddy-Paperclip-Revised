import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/queue";
import { prisma } from "@/lib/db";
import {
  analyseVehicleSubmission,
  analyseCaravanSubmission,
  analyseAccessorySubmission,
} from "@/lib/vlm";
import { promoteUserTrustTier } from "@/lib/trust-tier";
import type { TrustTier } from "@prisma/client";

export interface SubmissionVlmJobData {
  submissionType: "vehicle" | "caravan" | "accessory";
  submissionId: string;
  // R2 keys for photos (used to fetch base64 for VLM)
  photoKeys: string[];
  submittedData: Record<string, unknown>;
}

async function fetchPhotoAsBase64(
  key: string
): Promise<{ base64: string; mimeType: string } | null> {
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!publicUrl || !key) return null;
  try {
    const url = `${publicUrl.replace(/\/$/, "")}/${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    return { base64, mimeType };
  } catch {
    return null;
  }
}

function isAutoApproveEligible(
  trustTier: TrustTier,
  recommendedAction: string
): boolean {
  // Auto-approve gate: VLM clean AND Trusted+ tier (spec 7.8)
  return (
    recommendedAction === "auto_approve" &&
    (trustTier === "TRUSTED" || trustTier === "EXPERT")
  );
}

export function createSubmissionVlmWorker(): Worker<SubmissionVlmJobData> {
  return new Worker<SubmissionVlmJobData>(
    "submission-vlm",
    async (job: Job<SubmissionVlmJobData>) => {
      const { submissionType, submissionId, photoKeys, submittedData } =
        job.data;

      const primaryPhotoKey = photoKeys[0] ?? null;
      const photoData = primaryPhotoKey
        ? await fetchPhotoAsBase64(primaryPhotoKey)
        : null;

      try {
        if (submissionType === "vehicle") {
          const analysis = await analyseVehicleSubmission(
            photoData?.base64 ?? null,
            photoData?.mimeType ?? "image/jpeg",
            submittedData
          );

          const submission = await prisma.vehicleSubmission.findUnique({
            where: { id: submissionId },
            include: { submitter: true },
          });

          if (!submission) return;

          const autoApprove = isAutoApproveEligible(
            submission.submitter.trustTier,
            analysis.gatekeeper.recommendedAction
          );

          await prisma.vehicleSubmission.update({
            where: { id: submissionId },
            data: {
              vlmExtractionResult: analysis.extraction as object,
              vlmGatekeeperResult: analysis.gatekeeper as object,
              status: autoApprove ? "APPROVED" : "PENDING",
              decidedAt: autoApprove ? new Date() : undefined,
            },
          });

          if (autoApprove) {
            // Promote entity to canonical tier (COMMUNITY → CATALOGUE)
            if (submission.resultingVariantId) {
              await prisma.vehicleVariant.update({
                where: { id: submission.resultingVariantId },
                data: { status: "CATALOGUE" },
              });
            }
            await promoteUserTrustTier(submission.submitterId);
          }
        } else if (submissionType === "caravan") {
          const analysis = await analyseCaravanSubmission(
            photoData?.base64 ?? null,
            photoData?.mimeType ?? "image/jpeg",
            submittedData
          );

          const submission = await prisma.caravanSubmission.findUnique({
            where: { id: submissionId },
            include: { submitter: true },
          });

          if (!submission) return;

          const autoApprove = isAutoApproveEligible(
            submission.submitter.trustTier,
            analysis.gatekeeper.recommendedAction
          );

          await prisma.caravanSubmission.update({
            where: { id: submissionId },
            data: {
              vlmExtractionResult: analysis.extraction as object,
              vlmGatekeeperResult: analysis.gatekeeper as object,
              status: autoApprove ? "APPROVED" : "PENDING",
              decidedAt: autoApprove ? new Date() : undefined,
            },
          });

          if (autoApprove) {
            // Promote entity to canonical tier (COMMUNITY → CATALOGUE)
            if (submission.resultingVariantId) {
              await prisma.caravanVariant.update({
                where: { id: submission.resultingVariantId },
                data: { status: "CATALOGUE" },
              });
            }
            await promoteUserTrustTier(submission.submitterId);
          }
        } else if (submissionType === "accessory") {
          const result = await analyseAccessorySubmission(
            photoData?.base64 ?? null,
            photoData?.mimeType ?? "image/jpeg",
            submittedData
          );

          await prisma.accessorySubmission.update({
            where: { id: submissionId },
            data: {
              vlmSimilarityResult: result.similarityResult as object,
            },
          });
        }
      } catch (err) {
        // VLM unreachable or parse failure — rethrow so BullMQ retries with
        // exponential backoff. After max attempts the job is marked failed in
        // Bull Board; submission stays PENDING for human moderator review.
        // The user already received a success confirmation and sees nothing.
        console.error(
          `[vlm-worker] Error processing ${submissionType}/${submissionId}:`,
          err
        );
        throw err;
      }
    },
    {
      connection: redis,
      concurrency: 2,
    }
  );
}
