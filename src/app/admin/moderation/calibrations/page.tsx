import { redirect } from 'next/navigation';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { prisma } from '@/lib/db';
import {
  aggregateCorrection,
  MIN_SAMPLES,
} from '@/lib/physics/calibration-contribution';
import {
  CalibrationQueueView,
  type CalibrationGroup,
} from './_components/CalibrationQueueView';

export const metadata = { title: 'Calibration Queue — Admin' };

const EMPTY_AGGREGATE = {
  kerbMassDeltaKg: null,
  kerbMassSampleCount: 0,
  cogFractionDelta: null,
  cogSampleCount: 0,
};

export default async function CalibrationQueuePage() {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  // Two sources: pending contributions awaiting a decision, and the corrections
  // already live. We show both per variant so a moderator can see what's
  // currently published before approving more or unpublishing a bad one.
  const [pending, corrections] = await Promise.all([
    prisma.calibrationContribution.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        vehicleVariantId: true,
        granularity: true,
        measuredTotalKg: true,
        predictedTotalKg: true,
        residualMassKg: true,
        barenessWeight: true,
        kerbMassDeltaKg: true,
        cogFractionDelta: true,
        duplicateFingerprint: true,
        createdAt: true,
        vehicleVariant: {
          select: { name: true, model: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.vehicleCalibrationCorrection.findMany({
      select: {
        vehicleVariantId: true,
        kerbMassDeltaKg: true,
        kerbMassSampleCount: true,
        kerbMassApplied: true,
        cogFractionDelta: true,
        cogSampleCount: true,
        cogApplied: true,
        updatedAt: true,
        vehicleVariant: {
          select: { name: true, model: { select: { name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  // Group by variant — the moderator publishes one correction per variant.
  const groups = new Map<string, CalibrationGroup>();
  function ensureGroup(
    id: string,
    variant: { name: string; model: { name: string } },
  ): CalibrationGroup {
    let g = groups.get(id);
    if (!g) {
      g = {
        vehicleVariantId: id,
        variantName: `${variant.model.name} ${variant.name}`,
        minSamples: MIN_SAMPLES,
        rows: [],
        aggregate: { ...EMPTY_AGGREGATE },
        live: null,
      };
      groups.set(id, g);
    }
    return g;
  }

  for (const c of pending) {
    const g = ensureGroup(c.vehicleVariantId, c.vehicleVariant);
    g.rows.push({
      id: c.id,
      granularity: c.granularity,
      measuredTotalKg: c.measuredTotalKg,
      predictedTotalKg: c.predictedTotalKg,
      residualMassKg: c.residualMassKg,
      barenessWeight: c.barenessWeight,
      kerbMassDeltaKg: c.kerbMassDeltaKg,
      cogFractionDelta: c.cogFractionDelta,
      duplicateFingerprint: c.duplicateFingerprint,
    });
  }

  // Preview aggregate of the pending rows (collapsed per contributor) — what the
  // moderator would publish. Note this previews the PENDING pool alone; the
  // server action re-aggregates the full approved pool on publish.
  for (const g of groups.values()) {
    g.aggregate = aggregateCorrection(
      g.rows.map((r) => ({
        barenessWeight: r.barenessWeight,
        kerbMassDeltaKg: r.kerbMassDeltaKg ?? 0,
        cogFractionDelta: r.cogFractionDelta,
        fingerprint: r.duplicateFingerprint,
      })),
    );
  }

  // Attach the live correction; surface published-only variants (no pending) too,
  // so they can be reviewed and unpublished.
  for (const c of corrections) {
    const g = ensureGroup(c.vehicleVariantId, c.vehicleVariant);
    g.live = {
      kerbMassDeltaKg: c.kerbMassDeltaKg,
      kerbMassSampleCount: c.kerbMassSampleCount,
      kerbMassApplied: c.kerbMassApplied,
      cogFractionDelta: c.cogFractionDelta,
      cogSampleCount: c.cogSampleCount,
      cogApplied: c.cogApplied,
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  // Pending-first (work to do), then published-only (for review/unpublish).
  const ordered = [...groups.values()].sort((a, b) => {
    if (a.rows.length === 0 && b.rows.length > 0) return 1;
    if (a.rows.length > 0 && b.rows.length === 0) return -1;
    return a.variantName.localeCompare(b.variantName);
  });

  return <CalibrationQueueView groups={ordered} />;
}
