import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCaravanService } from '@/modules/catalogue/services/caravan.service';
import { caravanFilterSchema } from '@/modules/catalogue/validation/schemas';
import {
  parseSearchParams,
  withRateLimit,
  serverError,
} from '@/lib/api-helpers';

const service = createCaravanService(prisma);

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const parsed = parseSearchParams(request, caravanFilterSchema);
  if ('error' in parsed) return parsed.error;

  const { cursor, limit, ...filter } = parsed.data;

  try {
    const result = await service.listVariantsFiltered(filter, {
      cursor,
      limit,
    });
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
