import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCaravanService } from "@/modules/catalogue/services/caravan.service";
import { paginationSchema } from "@/modules/catalogue/validation/schemas";
import { parseSearchParams, withRateLimit, notFound, serverError } from "@/lib/api-helpers";

const service = createCaravanService(prisma);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ makeId: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { makeId } = await params;
  const parsed = parseSearchParams(request, paginationSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const make = await service.getMakeById(makeId);
    if (!make) return notFound("Caravan make");

    const result = await service.listModelsByMake(makeId, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
