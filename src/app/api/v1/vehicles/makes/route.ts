import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createVehicleService } from '@/modules/catalogue/services/vehicle.service';
import { paginationSchema } from '@/modules/catalogue/validation/schemas';
import {
  parseSearchParams,
  withRateLimit,
  serverError,
} from '@/lib/api-helpers';

const service = createVehicleService(prisma);

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const parsed = parseSearchParams(request, paginationSchema);
  if ('error' in parsed) return parsed.error;

  try {
    const result = await service.listMakes(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
