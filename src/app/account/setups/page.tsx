import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SetupsDashboard } from './_components/SetupsDashboard';

export default async function SetupsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/account/setups');
  }

  const setups = await prisma.setup.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: {
      vehicleVariant: { include: { model: { include: { make: true } } } },
      caravanVariant: { include: { model: { include: { make: true } } } },
      _count: {
        select: {
          accessories: true,
          caravanAccessories: true,
          customLoads: true,
        },
      },
    },
  });

  const items = setups.map((s) => ({
    id: s.id,
    name: s.name,
    tags: s.tags,
    vehicleVariant: s.vehicleVariant
      ? {
          id: s.vehicleVariant.id,
          name: s.vehicleVariant.name,
          slug: s.vehicleVariant.slug,
          model: s.vehicleVariant.model.name,
          make: s.vehicleVariant.model.make.name,
        }
      : null,
    caravanVariant: s.caravanVariant
      ? {
          id: s.caravanVariant.id,
          name: s.caravanVariant.name,
          model: s.caravanVariant.model.name,
          make: s.caravanVariant.model.make.name,
        }
      : null,
    accessoryCount: s._count.accessories + s._count.caravanAccessories,
    customLoadCount: s._count.customLoads,
    shareToken: s.shareToken,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return <SetupsDashboard initialSetups={items} />;
}
