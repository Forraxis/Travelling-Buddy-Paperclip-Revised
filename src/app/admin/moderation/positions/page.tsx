import { redirect } from 'next/navigation';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { prisma } from '@/lib/db';
import { aggregatePositions } from '@/lib/fitment-positions';
import { PositionQueueView, type PositionGroup } from './_components/PositionQueueView';

export const metadata = { title: 'Position Queue — Admin' };

export default async function PositionQueuePage() {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const pending = await prisma.fitmentPositionSubmission.findMany({
    where: { status: 'PENDING' },
    select: {
      id: true,
      fitmentId: true,
      vehicleVariantId: true,
      caravanVariantId: true,
      cogXMm: true,
      cogYMm: true,
      createdAt: true,
      fitment: {
        select: {
          cogXMm: true,
          cogYMm: true,
          mountingLocation: true,
          accessory: { select: { name: true } },
        },
      },
      vehicleVariant: {
        select: { name: true, model: { select: { name: true } } },
      },
      caravanVariant: {
        select: { name: true, model: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by fitment + variant — a moderator promotes the consensus for a
  // (fitment, variant) pair in one action, not row by row.
  const groups = new Map<string, PositionGroup>();
  for (const p of pending) {
    const k = `${p.fitmentId}|${p.vehicleVariantId ?? ''}|${p.caravanVariantId ?? ''}`;
    let g = groups.get(k);
    if (!g) {
      const variantName = p.vehicleVariant
        ? `${p.vehicleVariant.model.name} ${p.vehicleVariant.name}`
        : p.caravanVariant
          ? `${p.caravanVariant.model.name} ${p.caravanVariant.name}`
          : 'Unknown variant';
      g = {
        key: {
          fitmentId: p.fitmentId,
          vehicleVariantId: p.vehicleVariantId,
          caravanVariantId: p.caravanVariantId,
        },
        accessoryName: p.fitment.accessory.name,
        mountingLocation: p.fitment.mountingLocation,
        variantName,
        canonical:
          p.fitment.cogXMm != null && p.fitment.cogYMm != null
            ? { cogXMm: p.fitment.cogXMm, cogYMm: p.fitment.cogYMm }
            : null,
        samples: [],
        consensus: { cogXMm: 0, cogYMm: 0, sampleCount: 0 },
      };
      groups.set(k, g);
    }
    g.samples.push({ cogXMm: p.cogXMm, cogYMm: p.cogYMm });
  }
  for (const g of groups.values()) {
    g.consensus = aggregatePositions(g.samples) ?? g.consensus;
  }

  return <PositionQueueView groups={[...groups.values()]} />;
}
