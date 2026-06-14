import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withRateLimit, serverError } from '@/lib/api-helpers';

// Resolves the spec §9.5 inbound calculator contract — readable slugs from SEO
// page CTAs (/calculator?v={vehicle-slug}&c={caravan-slug}&a={accessory-slugs})
// — into the variant IDs and accessory fitments the calculator state uses.
// Catalogue/active records only (SEO links point at published pages). Variant
// slugs are unique per model and indexed; in the rare event two models share a
// variant slug, the first catalogue match is returned.
export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const vSlug = searchParams.get('v');
    const cSlug = searchParams.get('c');
    const aSlugs = searchParams.get('a');

    const out: {
      vehicleVariantId?: string;
      caravanVariantId?: string;
      accessories?: {
        accessoryId: string;
        massKg: number;
        mountingLocation: string;
      }[];
    } = {};

    if (vSlug) {
      const v = await prisma.vehicleVariant.findFirst({
        where: { slug: vSlug, status: 'CATALOGUE' },
        select: { id: true },
      });
      if (v) out.vehicleVariantId = v.id;
    }

    if (cSlug) {
      const c = await prisma.caravanVariant.findFirst({
        where: { slug: cSlug, status: 'CATALOGUE' },
        select: { id: true },
      });
      if (c) out.caravanVariantId = c.id;
    }

    // Accessories need a vehicle to resolve against — a fitment carries the
    // installed weight + mounting location for that specific vehicle. Slugs that
    // don't fit the resolved vehicle are skipped. Order is preserved.
    if (aSlugs && out.vehicleVariantId) {
      const slugs = aSlugs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (slugs.length) {
        const accs = await prisma.accessory.findMany({
          where: { slug: { in: slugs }, status: 'ACTIVE' },
          select: { id: true, slug: true },
        });
        const fitments = await prisma.accessoryFitment.findMany({
          where: {
            vehicleVariantId: out.vehicleVariantId,
            accessoryId: { in: accs.map((a) => a.id) },
          },
          select: {
            id: true,
            accessoryId: true,
            installedWeightKg: true,
            mountingLocation: true,
          },
        });
        const accIdBySlug = new Map(accs.map((a) => [a.slug, a.id]));
        const resolved: NonNullable<typeof out.accessories> = [];
        for (const slug of slugs) {
          const accId = accIdBySlug.get(slug);
          if (!accId) continue;
          const fit = fitments.find((f) => f.accessoryId === accId);
          if (!fit) continue;
          resolved.push({
            accessoryId: fit.id,
            massKg: Number(fit.installedWeightKg),
            mountingLocation: fit.mountingLocation,
          });
        }
        if (resolved.length) out.accessories = resolved;
      }
    }

    return NextResponse.json(out);
  } catch (err) {
    return serverError(err);
  }
}
