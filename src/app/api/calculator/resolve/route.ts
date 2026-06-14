import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withRateLimit, serverError } from '@/lib/api-helpers';

// Resolves the spec §9.5 inbound calculator contract — readable slugs from SEO
// page CTAs (/calculator?v={vehicle-slug}&c={caravan-slug}) — into the variant
// IDs the calculator state uses. Catalogue variants only (SEO links point at
// published pages). Variant slugs are unique per model and indexed; in the rare
// event two models share a variant slug, the first catalogue match is returned.
export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const vSlug = searchParams.get('v');
    const cSlug = searchParams.get('c');

    const out: {
      vehicleVariantId?: string;
      caravanVariantId?: string;
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

    return NextResponse.json(out);
  } catch (err) {
    return serverError(err);
  }
}
