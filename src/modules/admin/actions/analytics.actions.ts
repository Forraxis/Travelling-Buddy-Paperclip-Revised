"use server";

import { prisma } from "@/lib/db";
import { getAdminUser } from "@/modules/admin/lib/auth";
import { redirect } from "next/navigation";
import { SubmissionStatus } from "@prisma/client";

function adminOnly() {
  return getAdminUser().then((u) => {
    if (!u || u.role !== "ADMIN") redirect("/admin");
    return u;
  });
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export type DateRange = { from: Date; to: Date };

// ── Submissions per period (daily counts by type) ──────────────────────────

export type SubmissionsOverTimeRow = {
  date: string; // YYYY-MM-DD
  vehicle: number;
  caravan: number;
  accessory: number;
};

export async function getSubmissionsOverTime(
  range: DateRange
): Promise<SubmissionsOverTimeRow[]> {
  await adminOnly();

  const [vehicles, caravans, accessories] = await Promise.all([
    prisma.vehicleSubmission.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { createdAt: true },
    }),
    prisma.caravanSubmission.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { createdAt: true },
    }),
    prisma.accessorySubmission.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { createdAt: true },
    }),
  ]);

  const map = new Map<string, SubmissionsOverTimeRow>();

  const toKey = (d: Date) => d.toISOString().slice(0, 10);

  // Ensure all days in range are present
  const cur = new Date(range.from);
  while (cur <= range.to) {
    const k = toKey(cur);
    map.set(k, { date: k, vehicle: 0, caravan: 0, accessory: 0 });
    cur.setDate(cur.getDate() + 1);
  }

  for (const v of vehicles) {
    const k = toKey(v.createdAt);
    if (map.has(k)) map.get(k)!.vehicle++;
  }
  for (const c of caravans) {
    const k = toKey(c.createdAt);
    if (map.has(k)) map.get(k)!.caravan++;
  }
  for (const a of accessories) {
    const k = toKey(a.createdAt);
    if (map.has(k)) map.get(k)!.accessory++;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Approval rates per type ────────────────────────────────────────────────

export type ApprovalRate = {
  type: "vehicle" | "caravan" | "accessory";
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  rate: number; // 0-100
};

export async function getApprovalRates(range: DateRange): Promise<ApprovalRate[]> {
  await adminOnly();

  const where = { createdAt: { gte: range.from, lte: range.to } };

  const [vGroups, cGroups, aGroups] = await Promise.all([
    prisma.vehicleSubmission.groupBy({ by: ["status"], where, _count: true }),
    prisma.caravanSubmission.groupBy({ by: ["status"], where, _count: true }),
    prisma.accessorySubmission.groupBy({ by: ["status"], where, _count: true }),
  ]);

  function buildRate(
    groups: { status: string; _count: number }[],
    type: ApprovalRate["type"]
  ): ApprovalRate {
    const total = groups.reduce((s, g) => s + g._count, 0);
    const approved = groups.find((g) => g.status === "APPROVED")?._count ?? 0;
    const rejected = groups.find((g) => g.status === "REJECTED")?._count ?? 0;
    const pending = groups.find((g) => g.status === "PENDING")?._count ?? 0;
    const decided = approved + rejected;
    return {
      type,
      total,
      approved,
      rejected,
      pending,
      rate: decided > 0 ? Math.round((approved / decided) * 100) : 0,
    };
  }

  return [
    buildRate(vGroups, "vehicle"),
    buildRate(cGroups, "caravan"),
    buildRate(aGroups, "accessory"),
  ];
}

// ── Rejection reasons distribution ────────────────────────────────────────

export type RejectionReason = { reason: string; count: number };

export async function getRejectionReasons(
  range: DateRange
): Promise<RejectionReason[]> {
  await adminOnly();

  const where = {
    status: "REJECTED" as const,
    decidedAt: { gte: range.from, lte: range.to },
  };

  const [vehicles, caravans, accessories] = await Promise.all([
    prisma.vehicleSubmission.findMany({ where, select: { decisionNotes: true } }),
    prisma.caravanSubmission.findMany({ where, select: { decisionNotes: true } }),
    prisma.accessorySubmission.findMany({ where, select: { decisionNotes: true } }),
  ]);

  const counts = new Map<string, number>();
  for (const r of [...vehicles, ...caravans, ...accessories]) {
    const key = r.decisionNotes?.trim() || "No reason given";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

// ── Time-to-moderation ─────────────────────────────────────────────────────

export type ModerationTiming = {
  median: number; // hours
  p95: number; // hours
  sampleSize: number;
};

export async function getModerationTiming(
  range: DateRange
): Promise<ModerationTiming> {
  await adminOnly();

  const where = {
    decidedAt: { not: null, gte: range.from, lte: range.to },
    status: { in: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED] },
  };

  const [vehicles, caravans, accessories] = await Promise.all([
    prisma.vehicleSubmission.findMany({
      where,
      select: { createdAt: true, decidedAt: true },
    }),
    prisma.caravanSubmission.findMany({
      where,
      select: { createdAt: true, decidedAt: true },
    }),
    prisma.accessorySubmission.findMany({
      where,
      select: { createdAt: true, decidedAt: true },
    }),
  ]);

  const durations = [...vehicles, ...caravans, ...accessories]
    .filter((r) => r.decidedAt)
    .map((r) => (r.decidedAt!.getTime() - r.createdAt.getTime()) / 3_600_000)
    .sort((a, b) => a - b);

  return {
    median: Math.round(percentile(durations, 50) * 10) / 10,
    p95: Math.round(percentile(durations, 95) * 10) / 10,
    sampleSize: durations.length,
  };
}

// ── VLM accuracy ──────────────────────────────────────────────────────────

export type VlmAccuracy = {
  autoApprovedTotal: number;
  autoApprovedConfirmed: number; // later moderation = APPROVED
  autoApprovedRevoked: number;  // later moderation = REJECTED
  accuracy: number; // 0-100
};

function extractRecommendedAction(result: unknown): string | null {
  const r = result as Record<string, unknown> | null;
  return typeof r?.recommendedAction === "string" ? r.recommendedAction : null;
}

export async function getVlmAccuracy(range: DateRange): Promise<VlmAccuracy> {
  await adminOnly();

  const where = {
    createdAt: { gte: range.from, lte: range.to },
    status: { in: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED] },
    decidedAt: { not: null },
  };

  const [vehicles, caravans, accessories] = await Promise.all([
    prisma.vehicleSubmission.findMany({
      where,
      select: { status: true, vlmGatekeeperResult: true },
    }),
    prisma.caravanSubmission.findMany({
      where,
      select: { status: true, vlmGatekeeperResult: true },
    }),
    prisma.accessorySubmission.findMany({
      where,
      select: { status: true, vlmSimilarityResult: true },
    }),
  ]);

  let autoApprovedTotal = 0;
  let autoApprovedConfirmed = 0;
  let autoApprovedRevoked = 0;

  for (const v of [...vehicles, ...caravans]) {
    const rec = extractRecommendedAction(v.vlmGatekeeperResult);
    if (rec === "AUTO_APPROVE") {
      autoApprovedTotal++;
      if (v.status === "APPROVED") autoApprovedConfirmed++;
      else autoApprovedRevoked++;
    }
  }
  for (const a of accessories) {
    const rec = extractRecommendedAction(a.vlmSimilarityResult);
    if (rec === "AUTO_APPROVE") {
      autoApprovedTotal++;
      if (a.status === "APPROVED") autoApprovedConfirmed++;
      else autoApprovedRevoked++;
    }
  }

  return {
    autoApprovedTotal,
    autoApprovedConfirmed,
    autoApprovedRevoked,
    accuracy:
      autoApprovedTotal > 0
        ? Math.round((autoApprovedConfirmed / autoApprovedTotal) * 100)
        : 0,
  };
}

// ── Trust tier distribution ────────────────────────────────────────────────

export type TrustTierCount = { tier: string; count: number };

export async function getTrustTierDistribution(): Promise<TrustTierCount[]> {
  await adminOnly();

  const groups = await prisma.user.groupBy({
    by: ["trustTier"],
    _count: true,
  });

  const ORDER = ["NEW", "BASIC", "TRUSTED", "EXPERT"];
  return groups
    .map((g) => ({ tier: g.trustTier, count: g._count }))
    .sort((a, b) => ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier));
}

// ── Top contributors ───────────────────────────────────────────────────────

export type TopContributor = {
  id: string;
  name: string | null;
  email: string | null;
  trustTier: string;
  approvedCount: number;
};

export async function getTopContributors(
  range: DateRange,
  limit = 10
): Promise<TopContributor[]> {
  await adminOnly();

  const where = {
    status: "APPROVED" as const,
    decidedAt: { gte: range.from, lte: range.to },
  };

  const [vehicles, caravans, accessories] = await Promise.all([
    prisma.vehicleSubmission.findMany({
      where,
      select: { submitterId: true },
    }),
    prisma.caravanSubmission.findMany({
      where,
      select: { submitterId: true },
    }),
    prisma.accessorySubmission.findMany({
      where,
      select: { submitterId: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const r of [...vehicles, ...caravans, ...accessories]) {
    counts.set(r.submitterId, (counts.get(r.submitterId) ?? 0) + 1);
  }

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: topIds } },
    select: { id: true, name: true, email: true, trustTier: true },
  });

  return topIds
    .map((id) => {
      const u = users.find((u) => u.id === id)!;
      return {
        id,
        name: u?.name ?? null,
        email: u?.email ?? null,
        trustTier: u?.trustTier ?? "NEW",
        approvedCount: counts.get(id) ?? 0,
      };
    })
    .filter(Boolean);
}
