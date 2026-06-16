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

export default async function CalibrationQueuePage() {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const pending = await prisma.calibrationContribution.findMany({
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
      createdAt: true,
      vehicleVariant: {
        select: { name: true, model: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by variant — the moderator publishes one correction per variant.
  const groups = new Map<string, CalibrationGroup>();
  for (const c of pending) {
    let g = groups.get(c.vehicleVariantId);
    if (!g) {
      g = {
        vehicleVariantId: c.vehicleVariantId,
        variantName: `${c.vehicleVariant.model.name} ${c.vehicleVariant.name}`,
        minSamples: MIN_SAMPLES,
        rows: [],
        aggregate: {
          kerbMassDeltaKg: null,
          kerbMassSampleCount: 0,
          cogFractionDelta: null,
          cogSampleCount: 0,
        },
      };
      groups.set(c.vehicleVariantId, g);
    }
    g.rows.push({
      id: c.id,
      granularity: c.granularity,
      measuredTotalKg: c.measuredTotalKg,
      predictedTotalKg: c.predictedTotalKg,
      residualMassKg: c.residualMassKg,
      barenessWeight: c.barenessWeight,
      kerbMassDeltaKg: c.kerbMassDeltaKg,
      cogFractionDelta: c.cogFractionDelta,
    });
  }
  for (const g of groups.values()) {
    g.aggregate = aggregateCorrection(
      g.rows.map((r) => ({
        barenessWeight: r.barenessWeight,
        kerbMassDeltaKg: r.kerbMassDeltaKg ?? 0,
        cogFractionDelta: r.cogFractionDelta,
      })),
    );
  }

  return <CalibrationQueueView groups={[...groups.values()]} />;
}
