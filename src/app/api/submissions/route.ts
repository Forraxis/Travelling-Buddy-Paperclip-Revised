import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/submissions — list authenticated user's submissions across all types
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [vehicles, caravans, accessories] = await Promise.all([
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
        updatedAt: true,
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
        updatedAt: true,
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
        createdAt: true,
        updatedAt: true,
        isShared: true,
      },
    }),
  ]);

  return NextResponse.json({
    vehicles: vehicles.map((s) => ({ ...s, type: 'vehicle' as const })),
    caravans: caravans.map((s) => ({ ...s, type: 'caravan' as const })),
    accessories: accessories.map((s) => ({ ...s, type: 'accessory' as const })),
  });
}
