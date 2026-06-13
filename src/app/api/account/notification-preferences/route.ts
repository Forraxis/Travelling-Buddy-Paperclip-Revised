import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const preferencesSchema = z.object({
  submissionApproved: z.boolean(),
  submissionRejected: z.boolean(),
  trustTierPromoted: z.boolean(),
  savedSetupCatalogueUpdate: z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPreferences: true },
  });

  const defaults = {
    submissionApproved: true,
    submissionRejected: true,
    trustTierPromoted: true,
    savedSetupCatalogueUpdate: true,
  };

  const stored =
    typeof user?.notificationPreferences === 'object' &&
    user.notificationPreferences !== null
      ? user.notificationPreferences
      : {};

  return NextResponse.json({ ...defaults, ...stored });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = preferencesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid preferences', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPreferences: parsed.data },
  });

  return NextResponse.json(parsed.data);
}
