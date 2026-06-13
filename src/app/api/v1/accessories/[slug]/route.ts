import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAccessoryService } from '@/modules/catalogue/services/accessory.service';
import { withRateLimit, notFound, serverError } from '@/lib/api-helpers';

const service = createAccessoryService(prisma);

// UUID v4 pattern — used to distinguish ID-based lookups from slug-based ones
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// cuid pattern (c + 24 alphanumeric chars)
const CUID_RE = /^c[a-z0-9]{24,}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { slug } = await params;

  try {
    if (UUID_RE.test(slug) || CUID_RE.test(slug)) {
      const accessory = await service.getPickerDtoById(slug);
      if (!accessory) return notFound('Accessory');
      return NextResponse.json(accessory);
    }

    const url = new URL(request.url);
    const categorySlug = url.searchParams.get('category') ?? undefined;

    const accessory = await service.getDetailBySlug(slug, categorySlug);
    if (!accessory) return notFound('Accessory');
    return NextResponse.json(accessory);
  } catch (err) {
    return serverError(err);
  }
}
