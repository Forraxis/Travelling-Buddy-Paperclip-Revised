import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createCategoryService } from '@/modules/catalogue/services/category.service';
import { withRateLimit, serverError } from '@/lib/api-helpers';

const service = createCategoryService(prisma);

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const tree = await service.listHierarchy();
    return NextResponse.json({ categories: tree });
  } catch (err) {
    return serverError(err);
  }
}
