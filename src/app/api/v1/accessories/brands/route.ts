import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createBrandService } from '@/modules/catalogue/services/brand.service';
import { paginationSchema } from '@/modules/catalogue/validation/schemas';
import {
  parseSearchParams,
  withRateLimit,
  serverError,
} from '@/lib/api-helpers';

const service = createBrandService(prisma);

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const parsed = parseSearchParams(request, paginationSchema);
  if ('error' in parsed) return parsed.error;

  const { cursor, limit } = parsed.data;

  try {
    const result = await service.list({ status: 'ACTIVE' }, { cursor, limit });
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
