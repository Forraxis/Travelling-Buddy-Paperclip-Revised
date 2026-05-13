import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submissionVlmQueue } from "@/lib/queue";
import {
  caravanFingerprint,
  checkCaravanDuplicate,
} from "@/lib/duplicate-detection";

const CaravanSubmissionSchema = z.object({
  makeId: z.string().min(1),
  newMakeName: z.string().optional(),
  modelId: z.string().min(1),
  newModelName: z.string().optional(),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 2),
  variantName: z.string().min(1),
  bodyType: z.string().min(1),
  axleConfiguration: z.string().min(1),
  // Geometry
  couplingToAxleMm: z.number().positive().optional(),
  axleSpacingMm: z.number().positive().optional(), // tandem only
  bodyLengthMm: z.number().positive().optional(),
  overallLengthMm: z.number().positive().optional(),
  // Tank config
  freshWaterLitres: z.number().positive().optional(),
  greyWaterLitres: z.number().positive().optional(),
  gasBottleKg: z.number().positive().optional(),
  // Photos
  compliancePlatePhotoUrl: z.string().url().optional(),
  compliancePlatePhotoKey: z.string().optional(),
  additionalPhotoUrls: z.array(z.string().url()).default([]),
  additionalPhotoKeys: z.array(z.string()).default([]),
  notes: z.string().optional(),
  duplicateOverride: z.boolean().default(false),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CaravanSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const userId = session.user.id;

  const fingerprint = caravanFingerprint({
    makeId: data.makeId,
    modelId: data.modelId,
    year: data.year,
    bodyType: data.bodyType,
    axleConfiguration: data.axleConfiguration,
  });

  if (!data.duplicateOverride) {
    const dupCheck = await checkCaravanDuplicate(fingerprint);
    if (dupCheck.hasDuplicate) {
      return NextResponse.json(
        {
          duplicate: true,
          existingId: dupCheck.existingId,
          existingName: dupCheck.existingName,
          message:
            "We may already have this caravan. Is yours different from the existing one?",
        },
        { status: 409 }
      );
    }
  }

  const draftExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const submittedData = {
    makeId: data.makeId,
    newMakeName: data.newMakeName,
    modelId: data.modelId,
    newModelName: data.newModelName,
    year: data.year,
    variantName: data.variantName,
    bodyType: data.bodyType,
    axleConfiguration: data.axleConfiguration,
    couplingToAxleMm: data.couplingToAxleMm,
    axleSpacingMm: data.axleSpacingMm,
    bodyLengthMm: data.bodyLengthMm,
    overallLengthMm: data.overallLengthMm,
    freshWaterLitres: data.freshWaterLitres,
    greyWaterLitres: data.greyWaterLitres,
    gasBottleKg: data.gasBottleKg,
  };

  const submission = await prisma.caravanSubmission.create({
    data: {
      submitterId: userId,
      status: "PENDING",
      submittedData,
      compliancePlatePhotoUrl: data.compliancePlatePhotoUrl,
      additionalPhotoUrls: data.additionalPhotoUrls,
      notes: data.notes,
      duplicateFingerprint: fingerprint,
      draftExpiresAt,
    },
  });

  const photoKeys = [
    data.compliancePlatePhotoKey,
    ...data.additionalPhotoKeys,
  ].filter(Boolean) as string[];

  if (photoKeys.length > 0) {
    const job = await submissionVlmQueue.add("analyse-caravan", {
      submissionType: "caravan",
      submissionId: submission.id,
      photoKeys,
      submittedData: submittedData as Record<string, unknown>,
    });

    await prisma.caravanSubmission.update({
      where: { id: submission.id },
      data: { vlmJobId: job.id ?? null },
    });
  }

  return NextResponse.json(
    {
      id: submission.id,
      status: submission.status,
      message:
        "Caravan submitted for review. You can use it in your own calculations while it awaits approval.",
    },
    { status: 201 }
  );
}
