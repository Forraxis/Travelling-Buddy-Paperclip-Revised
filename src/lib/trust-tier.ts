import { prisma } from "@/lib/db";
import type { TrustTier } from "@prisma/client";

// Spec 7.8: trust tier thresholds (configurable post-launch)
const CONTRIBUTOR_APPROVED_COUNT = 1;
const TRUSTED_APPROVED_COUNT = 5;
const TRUSTED_MIN_ACCOUNT_AGE_DAYS = 60;
const TRUSTED_REJECTION_WINDOW_DAYS = 30;

// Returns the new tier if promotion occurred, null otherwise
export async function promoteUserTrustTier(
  userId: string
): Promise<TrustTier | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, trustTier: true, createdAt: true },
  });

  if (!user || user.trustTier === "EXPERT") return null;

  const now = new Date();
  const accountAgeDays =
    (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (user.trustTier === "NEW") {
    // Promote to CONTRIBUTOR on first approved submission
    const approvedCount = await countApprovedSubmissions(userId);
    if (approvedCount >= CONTRIBUTOR_APPROVED_COUNT) {
      await prisma.user.update({
        where: { id: userId },
        data: { trustTier: "BASIC" },
      });
      return "BASIC";
    }
  } else if (user.trustTier === "BASIC") {
    if (accountAgeDays < TRUSTED_MIN_ACCOUNT_AGE_DAYS) return null;

    const approvedCount = await countApprovedSubmissions(userId);
    if (approvedCount < TRUSTED_APPROVED_COUNT) return null;

    // No rejections in the last 30 days
    const windowStart = new Date(
      now.getTime() -
        TRUSTED_REJECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const recentRejections = await countRejectedSubmissionsAfter(
      userId,
      windowStart
    );
    if (recentRejections > 0) return null;

    await prisma.user.update({
      where: { id: userId },
      data: { trustTier: "TRUSTED" },
    });
    return "TRUSTED";
  }

  return null;
}

async function countApprovedSubmissions(userId: string): Promise<number> {
  const [v, c, a] = await Promise.all([
    prisma.vehicleSubmission.count({
      where: { submitterId: userId, status: "APPROVED" },
    }),
    prisma.caravanSubmission.count({
      where: { submitterId: userId, status: "APPROVED" },
    }),
    prisma.accessorySubmission.count({
      where: { submitterId: userId, status: "APPROVED" },
    }),
  ]);
  return v + c + a;
}

async function countRejectedSubmissionsAfter(
  userId: string,
  after: Date
): Promise<number> {
  const [v, c, a] = await Promise.all([
    prisma.vehicleSubmission.count({
      where: {
        submitterId: userId,
        status: "REJECTED",
        decidedAt: { gte: after },
      },
    }),
    prisma.caravanSubmission.count({
      where: {
        submitterId: userId,
        status: "REJECTED",
        decidedAt: { gte: after },
      },
    }),
    prisma.accessorySubmission.count({
      where: {
        submitterId: userId,
        status: "REJECTED",
        decidedAt: { gte: after },
      },
    }),
  ]);
  return v + c + a;
}

export function submissionsUntilTrusted(
  approvedCount: number,
  tier: TrustTier
): number | null {
  if (tier !== "BASIC") return null;
  return Math.max(0, TRUSTED_APPROVED_COUNT - approvedCount);
}
