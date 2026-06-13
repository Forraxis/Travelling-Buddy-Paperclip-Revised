import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SharedSetupView } from './SharedSetupView';

export const metadata: Metadata = {
  title: 'Shared Setup | TravellingBuddy',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedSetupPage({ params }: Props) {
  const { token } = await params;

  const setup = await prisma.setup.findUnique({
    where: { shareToken: token, deletedAt: null },
    include: {
      vehicleVariant: { include: { model: { include: { make: true } } } },
      caravanVariant: { include: { model: { include: { make: true } } } },
      accessories: {
        include: {
          fitment: {
            include: {
              accessory: { include: { brand: true, category: true } },
            },
          },
        },
      },
      caravanAccessories: {
        include: {
          fitment: {
            include: {
              accessory: { include: { brand: true, category: true } },
            },
          },
        },
      },
      customLoads: true,
    },
  });

  if (!setup) {
    notFound();
  }

  return (
    <SharedSetupView setup={JSON.parse(JSON.stringify(setup))} token={token} />
  );
}
