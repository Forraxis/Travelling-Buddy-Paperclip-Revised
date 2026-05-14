import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/modules/admin/lib/auth";
import { prisma } from "@/lib/db";
import { SubmissionDetailView } from "./_components/SubmissionDetailView";
import type { SubmissionType } from "../actions";
import { getEntityName, getVlmVerdict, getVlmSummary } from "../_components/types";

interface PageProps {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function SubmissionDetailPage({ params, searchParams }: PageProps) {
  const user = await getAdminUser();
  if (!user) redirect("/auth/signin");

  const { submissionId } = await params;
  const { type } = await searchParams;
  const subType = (type ?? "vehicle") as SubmissionType;

  if (subType === "vehicle") {
    const sub = await prisma.vehicleSubmission.findUnique({
      where: { id: submissionId },
      include: {
        submitter: { select: { id: true, name: true, email: true, trustTier: true, createdAt: true } },
        resultingVariant: { select: { id: true, name: true, slug: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    });
    if (!sub) notFound();

    return (
      <SubmissionDetailView
        id={sub.id}
        type="vehicle"
        status={sub.status}
        submittedData={sub.submittedData as Record<string, unknown>}
        photoUrls={[sub.compliancePlatePhotoUrl, ...sub.additionalPhotoUrls].filter(Boolean) as string[]}
        vlmGatekeeperResult={sub.vlmGatekeeperResult as Record<string, unknown> | null}
        vlmExtractionResult={sub.vlmExtractionResult as Record<string, unknown> | null}
        vlmVerdict={getVlmVerdict(sub.vlmGatekeeperResult, null)}
        vlmSummary={getVlmSummary(sub.vlmGatekeeperResult, null)}
        entityName={getEntityName(sub.submittedData, "vehicle")}
        submitter={{
          id: sub.submitter.id,
          name: sub.submitter.name,
          email: sub.submitter.email,
          trustTier: sub.submitter.trustTier,
          memberSince: sub.submitter.createdAt.toISOString(),
        }}
        decidedBy={sub.decidedBy ? { id: sub.decidedBy.id, name: sub.decidedBy.name } : null}
        decidedAt={sub.decidedAt?.toISOString() ?? null}
        decisionNotes={sub.decisionNotes}
        createdAt={sub.createdAt.toISOString()}
        dupSuspected={sub.dupSuspected}
      />
    );
  }

  if (subType === "caravan") {
    const sub = await prisma.caravanSubmission.findUnique({
      where: { id: submissionId },
      include: {
        submitter: { select: { id: true, name: true, email: true, trustTier: true, createdAt: true } },
        resultingVariant: { select: { id: true, name: true, slug: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    });
    if (!sub) notFound();

    return (
      <SubmissionDetailView
        id={sub.id}
        type="caravan"
        status={sub.status}
        submittedData={sub.submittedData as Record<string, unknown>}
        photoUrls={[sub.compliancePlatePhotoUrl, ...sub.additionalPhotoUrls].filter(Boolean) as string[]}
        vlmGatekeeperResult={sub.vlmGatekeeperResult as Record<string, unknown> | null}
        vlmExtractionResult={sub.vlmExtractionResult as Record<string, unknown> | null}
        vlmVerdict={getVlmVerdict(sub.vlmGatekeeperResult, null)}
        vlmSummary={getVlmSummary(sub.vlmGatekeeperResult, null)}
        entityName={getEntityName(sub.submittedData, "caravan")}
        submitter={{
          id: sub.submitter.id,
          name: sub.submitter.name,
          email: sub.submitter.email,
          trustTier: sub.submitter.trustTier,
          memberSince: sub.submitter.createdAt.toISOString(),
        }}
        decidedBy={sub.decidedBy ? { id: sub.decidedBy.id, name: sub.decidedBy.name } : null}
        decidedAt={sub.decidedAt?.toISOString() ?? null}
        decisionNotes={sub.decisionNotes}
        createdAt={sub.createdAt.toISOString()}
        dupSuspected={sub.dupSuspected}
      />
    );
  }

  // accessory
  const sub = await prisma.accessorySubmission.findUnique({
    where: { id: submissionId },
    include: {
      submitter: { select: { id: true, name: true, email: true, trustTier: true, createdAt: true } },
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } },
    },
  });
  if (!sub) notFound();

  return (
    <SubmissionDetailView
      id={sub.id}
      type="accessory"
      status={sub.status}
      submittedData={sub.submittedData as Record<string, unknown>}
      photoUrls={[sub.productPhotoUrl, sub.installationPhotoUrl].filter(Boolean) as string[]}
      vlmGatekeeperResult={sub.vlmSimilarityResult as Record<string, unknown> | null}
      vlmExtractionResult={null}
      vlmVerdict={getVlmVerdict(null, sub.vlmSimilarityResult)}
      vlmSummary={getVlmSummary(null, sub.vlmSimilarityResult)}
      entityName={getEntityName(sub.submittedData, "accessory")}
      submitter={{
        id: sub.submitter.id,
        name: sub.submitter.name,
        email: sub.submitter.email,
        trustTier: sub.submitter.trustTier,
        memberSince: sub.submitter.createdAt.toISOString(),
      }}
      decidedBy={sub.decidedBy ? { id: sub.decidedBy.id, name: sub.decidedBy.name } : null}
      decidedAt={sub.decidedAt?.toISOString() ?? null}
      decisionNotes={sub.decisionNotes}
      createdAt={sub.createdAt.toISOString()}
      dupSuspected={sub.dupSuspected}
    />
  );
}
