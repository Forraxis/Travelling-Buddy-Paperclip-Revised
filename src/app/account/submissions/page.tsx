import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SubmissionsView } from "./_components/SubmissionsView";
import { submissionsUntilTrusted } from "@/lib/trust-tier";

export const metadata = { title: "My Submissions — TravellingBuddy" };

export default async function SubmissionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/account/submissions");
  }

  const userId = session.user.id;

  const [user, vehicles, caravans, accessories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { trustTier: true, createdAt: true },
    }),
    prisma.vehicleSubmission.findMany({
      where: { submitterId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        submittedData: true,
        decisionNotes: true,
        decidedAt: true,
        draftExpiresAt: true,
        createdAt: true,
      },
    }),
    prisma.caravanSubmission.findMany({
      where: { submitterId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        submittedData: true,
        decisionNotes: true,
        decidedAt: true,
        draftExpiresAt: true,
        createdAt: true,
      },
    }),
    prisma.accessorySubmission.findMany({
      where: { submitterId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        submittedData: true,
        decisionNotes: true,
        decidedAt: true,
        draftExpiresAt: true,
        isShared: true,
        createdAt: true,
      },
    }),
  ]);

  const approvedCount =
    vehicles.filter((s) => s.status === "APPROVED").length +
    caravans.filter((s) => s.status === "APPROVED").length +
    accessories.filter((s) => s.status === "APPROVED").length;

  const untilTrusted = user
    ? submissionsUntilTrusted(approvedCount, user.trustTier)
    : null;

  const allSubmissions = [
    ...vehicles.map((s) => ({
      ...s,
      type: "vehicle" as const,
      submittedData: s.submittedData as Record<string, unknown>,
    })),
    ...caravans.map((s) => ({
      ...s,
      type: "caravan" as const,
      submittedData: s.submittedData as Record<string, unknown>,
    })),
    ...accessories.map((s) => ({
      ...s,
      type: "accessory" as const,
      submittedData: s.submittedData as Record<string, unknown>,
      isShared: s.isShared,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <SubmissionsView
      submissions={allSubmissions}
      trustTier={user?.trustTier ?? "NEW"}
      untilTrusted={untilTrusted}
    />
  );
}
