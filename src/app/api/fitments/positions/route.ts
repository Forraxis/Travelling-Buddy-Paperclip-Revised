import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { serverError, withRateLimit } from '@/lib/api-helpers';
import { aggregatePositions } from '@/lib/fitment-positions';

const itemSchema = z.object({
  fitmentId: z.string().min(1),
  cogXMm: z.number().int().min(-6000).max(6000),
  cogYMm: z.number().int().min(-2000).max(2000),
});

const contributeSchema = z.object({
  vehicleVariantId: z.string().optional(),
  caravanVariantId: z.string().optional(),
  source: z.string().max(120).optional(),
  items: z.array(itemSchema).min(1).max(50),
});

// POST — contribute one or more dragged accessory placements. Auth is optional:
// anonymous contributions are accepted (submitterId null) so the data moat keeps
// growing even before sign-up. Every row lands PENDING for moderation.
export async function POST(request: Request) {
  try {
    // Anonymous write path — throttle to blunt contribution flooding/queue spam.
    const limited = withRateLimit(request);
    if (limited) return limited;

    const session = await auth();
    const body = await request.json();
    const parsed = contributeSchema.safeParse(body);
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
    if (!data.vehicleVariantId && !data.caravanVariantId) {
      return NextResponse.json(
        { error: 'A vehicleVariantId or caravanVariantId is required' },
        { status: 400 },
      );
    }

    // Only accept positions for fitments that actually exist and belong to the
    // declared variant — prevents poisoning the queue with bogus fitment IDs.
    const fitmentIds = [...new Set(data.items.map((i) => i.fitmentId))];
    const fitments = await prisma.accessoryFitment.findMany({
      where: {
        id: { in: fitmentIds },
        OR: [
          { vehicleVariantId: data.vehicleVariantId ?? undefined },
          { caravanVariantId: data.caravanVariantId ?? undefined },
        ],
      },
      select: { id: true },
    });
    const validIds = new Set(fitments.map((f) => f.id));
    const accepted = data.items.filter((i) => validIds.has(i.fitmentId));
    if (accepted.length === 0) {
      return NextResponse.json(
        { error: 'No items matched a fitment for this variant' },
        { status: 422 },
      );
    }

    await prisma.fitmentPositionSubmission.createMany({
      data: accepted.map((i) => ({
        submitterId: session?.user?.id ?? null,
        fitmentId: i.fitmentId,
        vehicleVariantId: data.vehicleVariantId ?? null,
        caravanVariantId: data.caravanVariantId ?? null,
        cogXMm: i.cogXMm,
        cogYMm: i.cogYMm,
        source: data.source ?? 'calculator',
      })),
    });

    return NextResponse.json(
      {
        created: accepted.length,
        skipped: data.items.length - accepted.length,
      },
      { status: 201 },
    );
  } catch (err) {
    return serverError(err);
  }
}

const querySchema = z.object({
  vehicleVariantId: z.string().optional(),
  caravanVariantId: z.string().optional(),
  fitmentId: z.string().optional(),
});

// GET — community position consensus for a variant. Returns, per fitment, the
// median of APPROVED contributions (the heat-map centroid) alongside the current
// canonical position. Public: used to preview "N owners positioned this".
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      vehicleVariantId: searchParams.get('vehicleVariantId') ?? undefined,
      caravanVariantId: searchParams.get('caravanVariantId') ?? undefined,
      fitmentId: searchParams.get('fitmentId') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    const { vehicleVariantId, caravanVariantId, fitmentId } = parsed.data;
    if (!vehicleVariantId && !caravanVariantId) {
      return NextResponse.json(
        { error: 'A vehicleVariantId or caravanVariantId is required' },
        { status: 400 },
      );
    }

    const subs = await prisma.fitmentPositionSubmission.findMany({
      where: {
        status: 'APPROVED',
        vehicleVariantId: vehicleVariantId ?? undefined,
        caravanVariantId: caravanVariantId ?? undefined,
        fitmentId: fitmentId ?? undefined,
      },
      select: { fitmentId: true, cogXMm: true, cogYMm: true },
    });

    const byFitment = new Map<string, { cogXMm: number; cogYMm: number }[]>();
    for (const s of subs) {
      const list = byFitment.get(s.fitmentId) ?? [];
      list.push({ cogXMm: s.cogXMm, cogYMm: s.cogYMm });
      byFitment.set(s.fitmentId, list);
    }

    const fitments = byFitment.size
      ? await prisma.accessoryFitment.findMany({
          where: { id: { in: [...byFitment.keys()] } },
          select: { id: true, cogXMm: true, cogYMm: true },
        })
      : [];
    const canonical = new Map(fitments.map((f) => [f.id, f]));

    const results = [...byFitment.entries()].map(([fid, samples]) => ({
      fitmentId: fid,
      community: aggregatePositions(samples),
      canonical: canonical.get(fid)
        ? {
            cogXMm: canonical.get(fid)!.cogXMm,
            cogYMm: canonical.get(fid)!.cogYMm,
          }
        : null,
    }));

    return NextResponse.json({ fitments: results });
  } catch (err) {
    return serverError(err);
  }
}
