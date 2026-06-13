import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createVehicleService } from '@/modules/catalogue/services/vehicle.service';
import { withRateLimit, notFound, serverError } from '@/lib/api-helpers';

const service = createVehicleService(prisma);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ makeId: string }> },
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { makeId } = await params;

  try {
    const make = await service.getMakeById(makeId);
    if (!make) return notFound('Vehicle make');
    return NextResponse.json(make);
  } catch (err) {
    return serverError(err);
  }
}
