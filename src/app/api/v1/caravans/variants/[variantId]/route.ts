import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCaravanService } from '@/modules/catalogue/services/caravan.service';
import { withRateLimit, notFound, serverError } from '@/lib/api-helpers';

const service = createCaravanService(prisma);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ variantId: string }> },
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { variantId } = await params;

  try {
    const variant = await service.getVariantById(variantId);
    if (!variant) return notFound('Caravan variant');
    return NextResponse.json(variant);
  } catch (err) {
    return serverError(err);
  }
}
