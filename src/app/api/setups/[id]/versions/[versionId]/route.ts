import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { serverError, notFound } from '@/lib/api-helpers';

// Loads a version and confirms the caller owns its parent setup.
async function ownedVersion(
  setupId: string,
  versionId: string,
  userId: string,
) {
  const version = await prisma.setupVersion.findUnique({
    where: { id: versionId },
    include: { setup: { select: { id: true, userId: true, deletedAt: true } } },
  });
  if (!version || version.setupId !== setupId || version.setup.deletedAt) {
    return { error: 'notfound' as const };
  }
  if (version.setup.userId !== userId) return { error: 'forbidden' as const };
  return { version };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id, versionId } = await params;
    const res = await ownedVersion(id, versionId, session.user.id);
    if (res.error === 'notfound') return notFound('Version');
    if (res.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(res.version);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id, versionId } = await params;
    const res = await ownedVersion(id, versionId, session.user.id);
    if (res.error === 'notfound') return notFound('Version');
    if (res.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.setupVersion.delete({ where: { id: versionId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
