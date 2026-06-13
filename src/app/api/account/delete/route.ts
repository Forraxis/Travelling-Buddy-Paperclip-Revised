import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const GRACE_PERIOD_DAYS = 30;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.confirmEmail || typeof body.confirmEmail !== 'string') {
    return NextResponse.json(
      { error: 'Email confirmation required' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, deletedAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.deletedAt) {
    return NextResponse.json(
      { error: 'Account already deleted' },
      { status: 400 },
    );
  }

  if (body.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'Email does not match' },
      { status: 400 },
    );
  }

  const now = new Date();
  const hardDeleteAt = new Date(
    now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        deletedAt: now,
        scheduledHardDeleteAt: hardDeleteAt,
      },
    }),
    prisma.session.deleteMany({
      where: { userId: session.user.id },
    }),
  ]);

  return NextResponse.json({ success: true });
}
