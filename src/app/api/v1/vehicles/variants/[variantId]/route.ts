import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createVehicleService } from '@/modules/catalogue/services/vehicle.service';
import { withRateLimit, notFound, serverError } from '@/lib/api-helpers';

const service = createVehicleService(prisma);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ variantId: string }> },
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { variantId } = await params;

  try {
    const variant = await service.getVariantById(variantId);
    if (!variant) return notFound('Vehicle variant');
    return NextResponse.json(variant);
  } catch (err) {
    return serverError(err);
  }
}
