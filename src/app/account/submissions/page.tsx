import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SubmissionsView } from './_components/SubmissionsView';
import { submissionsUntilTrusted } from '@/lib/trust-tier';

export const metadata = { title: 'My Submissions — TravellingBuddy' };

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/account/submissions');
  }

  const userId = session.user.id;
  const { submitted } = await searchParams;

  const [user, vehicles, caravans, accessories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { trustTier: true, createdAt: true },
    }),
    prisma.vehicleSubmission.findMany({
      where: { submitterId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        submittedData: true,
        decisionNotes: true,
        decidedAt: true,
        draftExpiresAt: true,
        createdAt: true,
        resultingVariant: {
          select: {
            slug: true,
            model: {
              select: {
                slug: true,
                make: { select: { slug: true } },
              },
            },
          },
        },
      },
    }),
    prisma.caravanSubmission.findMany({
      where: { submitterId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        submittedData: true,
        decisionNotes: true,
        decidedAt: true,
        draftExpiresAt: true,
        createdAt: true,
        resultingVariant: {
          select: {
            slug: true,
            model: {
              select: {
                slug: true,
                make: { select: { slug: true } },
              },
            },
          },
        },
      },
    }),
    prisma.accessorySubmission.findMany({
      where: { submitterId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        submittedData: true,
        decisionNotes: true,
        decidedAt: true,
        draftExpiresAt: true,
        isShared: true,
        createdAt: true,
        resultingAccessory: {
          select: {
            slug: true,
            category: { select: { slug: true } },
          },
        },
      },
    }),
  ]);

  // Build catalogue URLs for approved submissions
  const vehicleCatalogueUrl = (v: (typeof vehicles)[number]): string | null => {
    if (v.status !== 'APPROVED' || !v.resultingVariant) return null;
    const { model } = v.resultingVariant;
    return `/catalogue/vehicles/${model.make.slug}/${model.slug}`;
  };

  const caravanCatalogueUrl = (c: (typeof caravans)[number]): string | null => {
    if (c.status !== 'APPROVED' || !c.resultingVariant) return null;
    const { model } = c.resultingVariant;
    return `/catalogue/caravans/${model.make.slug}/${model.slug}`;
  };

  const accessoryCatalogueUrl = (
    a: (typeof accessories)[number],
  ): string | null => {
    if (a.status !== 'APPROVED' || !a.resultingAccessory) return null;
    const { slug, category } = a.resultingAccessory;
    return `/accessories/${category.slug}/${slug}`;
  };

  // Compute queue positions for pending submissions
  const allPending = [
    ...vehicles.filter((v) => v.status === 'PENDING'),
    ...caravans.filter((c) => c.status === 'PENDING'),
    ...accessories.filter((a) => a.status === 'PENDING'),
  ];

  const queuePositionMap = new Map<string, number>();

  if (allPending.length > 0) {
    await Promise.all(
      allPending.map(async (s) => {
        const [v, c, a] = await Promise.all([
          prisma.vehicleSubmission.count({
            where: { status: 'PENDING', createdAt: { lt: s.createdAt } },
          }),
          prisma.caravanSubmission.count({
            where: { status: 'PENDING', createdAt: { lt: s.createdAt } },
          }),
          prisma.accessorySubmission.count({
            where: { status: 'PENDING', createdAt: { lt: s.createdAt } },
          }),
        ]);
        queuePositionMap.set(s.id, v + c + a + 1);
      }),
    );
  }

  const approvedCount =
    vehicles.filter((s) => s.status === 'APPROVED').length +
    caravans.filter((s) => s.status === 'APPROVED').length +
    accessories.filter((s) => s.status === 'APPROVED').length;

  const untilTrusted = user
    ? await submissionsUntilTrusted(approvedCount, user.trustTier)
    : null;

  const allSubmissions = [
    ...vehicles.map((s) => ({
      id: s.id,
      type: 'vehicle' as const,
      status: s.status,
      submittedData: s.submittedData as Record<string, unknown>,
      decisionNotes: s.decisionNotes,
      decidedAt: s.decidedAt,
      draftExpiresAt: s.draftExpiresAt,
      createdAt: s.createdAt,
      catalogueUrl: vehicleCatalogueUrl(s),
      queuePosition: queuePositionMap.get(s.id) ?? null,
    })),
    ...caravans.map((s) => ({
      id: s.id,
      type: 'caravan' as const,
      status: s.status,
      submittedData: s.submittedData as Record<string, unknown>,
      decisionNotes: s.decisionNotes,
      decidedAt: s.decidedAt,
      draftExpiresAt: s.draftExpiresAt,
      createdAt: s.createdAt,
      catalogueUrl: caravanCatalogueUrl(s),
      queuePosition: queuePositionMap.get(s.id) ?? null,
    })),
    ...accessories.map((s) => ({
      id: s.id,
      type: 'accessory' as const,
      status: s.status,
      submittedData: s.submittedData as Record<string, unknown>,
      decisionNotes: s.decisionNotes,
      decidedAt: s.decidedAt,
      draftExpiresAt: s.draftExpiresAt,
      createdAt: s.createdAt,
      isShared: s.isShared,
      catalogueUrl: accessoryCatalogueUrl(s),
      queuePosition: queuePositionMap.get(s.id) ?? null,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <SubmissionsView
      submissions={allSubmissions}
      trustTier={user?.trustTier ?? 'NEW'}
      untilTrusted={untilTrusted}
      showSuccessBanner={submitted === '1'}
    />
  );
}
