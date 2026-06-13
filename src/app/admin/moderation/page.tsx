import { redirect } from 'next/navigation';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { prisma } from '@/lib/db';
import { ModerationQueueView } from './_components/ModerationQueueView';
import type { UnifiedSubmission } from './_components/types';
import {
  getVlmVerdict,
  getVlmSummary,
  getEntityName,
} from './_components/types';

export const metadata = { title: 'Moderation Queue — Admin' };

export default async function ModerationQueuePage() {
  const user = await getAdminUser();
  if (!user) redirect('/auth/signin');

  const [vehicles, caravans, accessories] = await Promise.all([
    prisma.vehicleSubmission.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        status: true,
        submittedData: true,
        compliancePlatePhotoUrl: true,
        additionalPhotoUrls: true,
        vlmGatekeeperResult: true,
        createdAt: true,
        submitter: { select: { id: true, name: true, trustTier: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.caravanSubmission.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        status: true,
        submittedData: true,
        compliancePlatePhotoUrl: true,
        additionalPhotoUrls: true,
        vlmGatekeeperResult: true,
        createdAt: true,
        submitter: { select: { id: true, name: true, trustTier: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.accessorySubmission.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        status: true,
        submittedData: true,
        productPhotoUrl: true,
        vlmSimilarityResult: true,
        createdAt: true,
        submitter: { select: { id: true, name: true, trustTier: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const unified: UnifiedSubmission[] = [
    ...vehicles.map((v) => ({
      id: v.id,
      type: 'vehicle' as const,
      status: v.status,
      entityName: getEntityName(v.submittedData, 'vehicle'),
      photoUrl: v.compliancePlatePhotoUrl ?? v.additionalPhotoUrls[0] ?? null,
      vlmVerdict: getVlmVerdict(v.vlmGatekeeperResult, null),
      vlmSummary: getVlmSummary(v.vlmGatekeeperResult, null),
      submitter: {
        id: v.submitter.id,
        name: v.submitter.name,
        trustTier: v.submitter.trustTier,
      },
      createdAt: v.createdAt.toISOString(),
    })),
    ...caravans.map((c) => ({
      id: c.id,
      type: 'caravan' as const,
      status: c.status,
      entityName: getEntityName(c.submittedData, 'caravan'),
      photoUrl: c.compliancePlatePhotoUrl ?? c.additionalPhotoUrls[0] ?? null,
      vlmVerdict: getVlmVerdict(c.vlmGatekeeperResult, null),
      vlmSummary: getVlmSummary(c.vlmGatekeeperResult, null),
      submitter: {
        id: c.submitter.id,
        name: c.submitter.name,
        trustTier: c.submitter.trustTier,
      },
      createdAt: c.createdAt.toISOString(),
    })),
    ...accessories.map((a) => ({
      id: a.id,
      type: 'accessory' as const,
      status: a.status,
      entityName: getEntityName(a.submittedData, 'accessory'),
      photoUrl: a.productPhotoUrl ?? null,
      vlmVerdict: getVlmVerdict(null, a.vlmSimilarityResult),
      vlmSummary: getVlmSummary(null, a.vlmSimilarityResult),
      submitter: {
        id: a.submitter.id,
        name: a.submitter.name,
        trustTier: a.submitter.trustTier,
      },
      createdAt: a.createdAt.toISOString(),
    })),
  ];

  return <ModerationQueueView submissions={unified} />;
}
