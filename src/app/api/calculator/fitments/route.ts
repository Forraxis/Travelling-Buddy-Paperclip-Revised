import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withRateLimit, serverError } from '@/lib/api-helpers';
import { z } from 'zod';

const schema = z.object({
  accessoryIds: z.array(z.string()).min(1).max(50),
});

export async function POST(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { accessoryIds } = parsed.data;

    const accessories = await prisma.accessory.findMany({
      where: { id: { in: accessoryIds } },
      select: { id: true, name: true },
    });

    return NextResponse.json(
      accessories.map((a) => ({ accessoryId: a.id, name: a.name })),
    );
  } catch (err) {
    return serverError(err);
  }
}
