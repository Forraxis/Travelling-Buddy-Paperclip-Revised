import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCaravanService } from "@/modules/catalogue/services/caravan.service";
import { withRateLimit, notFound, serverError } from "@/lib/api-helpers";

const service = createCaravanService(prisma);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ makeId: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { makeId } = await params;

  try {
    const make = await service.getMakeById(makeId);
    if (!make) return notFound("Caravan make");
    return NextResponse.json(make);
  } catch (err) {
    return serverError(err);
  }
}
