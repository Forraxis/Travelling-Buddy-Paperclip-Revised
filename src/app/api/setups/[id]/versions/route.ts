import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { serverError, notFound } from '@/lib/api-helpers';
import type { Prisma } from '@prisma/client';

// The snapshot + summary are opaque JSON from the client (serialized
// CalculatorState + computed metrics). We validate the envelope, not the shape.
const createSchema = z.object({
  label: z.string().min(1).max(120),
  note: z.string().max(1000).optional(),
  stateSnapshot: z.record(z.string(), z.unknown()),
  resultSummary: z.record(z.string(), z.unknown()).optional(),
  isWeighedBaseline: z.boolean().optional(),
});

async function ownedSetup(setupId: string, userId: string) {
  const setup = await prisma.setup.findUnique({
    where: { id: setupId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!setup) return { error: 'notfound' as const };
  if (setup.userId !== userId) return { error: 'forbidden' as const };
  return { setup };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const owned = await ownedSetup(id, session.user.id);
    if (owned.error === 'notfound') return notFound('Setup');
    if (owned.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const version = await prisma.setupVersion.create({
      data: {
        setupId: id,
        label: data.label,
        note: data.note,
        stateSnapshot: data.stateSnapshot as Prisma.InputJsonValue,
        resultSummary: (data.resultSummary ?? {}) as Prisma.InputJsonValue,
        isWeighedBaseline: data.isWeighedBaseline ?? false,
      },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const owned = await ownedSetup(id, session.user.id);
    if (owned.error === 'notfound') return notFound('Setup');
    if (owned.error === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const versions = await prisma.setupVersion.findMany({
      where: { setupId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ items: versions });
  } catch (err) {
    return serverError(err);
  }
}
