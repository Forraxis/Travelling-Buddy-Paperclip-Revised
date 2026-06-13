import { prisma } from '@/lib/db';
import type { TrustTier } from '@prisma/client';

// Fallback defaults matching original hardcoded constants (spec 7.8)
const DEFAULTS = {
  contributorApprovedCount: 1,
  trustedApprovedCount: 5,
  trustedMinAccountAgeDays: 60,
  trustedRejectionWindowDays: 30,
} as const;

export type TrustTierConfig = typeof DEFAULTS;

// Simple in-process TTL cache (60 s)
let cachedConfig: TrustTierConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

export async function getTrustTierConfig(): Promise<TrustTierConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;

  const rows = await prisma.adminConfig.findMany({
    where: {
      key: { in: Object.keys(DEFAULTS) },
    },
    select: { key: true, value: true },
  });

  const config = { ...DEFAULTS };
  for (const row of rows) {
    const key = row.key as keyof TrustTierConfig;
    if (key in DEFAULTS && typeof row.value === 'number') {
      (config as Record<string, number>)[key] = row.value as number;
    }
  }

  cachedConfig = config;
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return config;
}

export function invalidateTrustTierConfigCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}

// Returns the new tier if promotion occurred, null otherwise
export async function promoteUserTrustTier(
  userId: string,
): Promise<TrustTier | null> {
  const [user, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, trustTier: true, createdAt: true },
    }),
    getTrustTierConfig(),
  ]);

  if (!user || user.trustTier === 'EXPERT') return null;

  const now = new Date();
  const accountAgeDays =
    (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (user.trustTier === 'NEW') {
    const approvedCount = await countApprovedSubmissions(userId);
    if (approvedCount >= config.contributorApprovedCount) {
      await prisma.user.update({
        where: { id: userId },
        data: { trustTier: 'BASIC' },
      });
      return 'BASIC';
    }
  } else if (user.trustTier === 'BASIC') {
    if (accountAgeDays < config.trustedMinAccountAgeDays) return null;

    const approvedCount = await countApprovedSubmissions(userId);
    if (approvedCount < config.trustedApprovedCount) return null;

    const windowStart = new Date(
      now.getTime() - config.trustedRejectionWindowDays * 24 * 60 * 60 * 1000,
    );
    const recentRejections = await countRejectedSubmissionsAfter(
      userId,
      windowStart,
    );
    if (recentRejections > 0) return null;

    await prisma.user.update({
      where: { id: userId },
      data: { trustTier: 'TRUSTED' },
    });
    return 'TRUSTED';
  }

  return null;
}

async function countApprovedSubmissions(userId: string): Promise<number> {
  const [v, c, a] = await Promise.all([
    prisma.vehicleSubmission.count({
      where: { submitterId: userId, status: 'APPROVED' },
    }),
    prisma.caravanSubmission.count({
      where: { submitterId: userId, status: 'APPROVED' },
    }),
    prisma.accessorySubmission.count({
      where: { submitterId: userId, status: 'APPROVED' },
    }),
  ]);
  return v + c + a;
}

async function countRejectedSubmissionsAfter(
  userId: string,
  after: Date,
): Promise<number> {
  const [v, c, a] = await Promise.all([
    prisma.vehicleSubmission.count({
      where: {
        submitterId: userId,
        status: 'REJECTED',
        decidedAt: { gte: after },
      },
    }),
    prisma.caravanSubmission.count({
      where: {
        submitterId: userId,
        status: 'REJECTED',
        decidedAt: { gte: after },
      },
    }),
    prisma.accessorySubmission.count({
      where: {
        submitterId: userId,
        status: 'REJECTED',
        decidedAt: { gte: after },
      },
    }),
  ]);
  return v + c + a;
}

export async function submissionsUntilTrusted(
  approvedCount: number,
  tier: TrustTier,
): Promise<number | null> {
  if (tier !== 'BASIC') return null;
  const config = await getTrustTierConfig();
  return Math.max(0, config.trustedApprovedCount - approvedCount);
}
