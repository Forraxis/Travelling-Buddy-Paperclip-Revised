import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCaravanService } from "@/modules/catalogue/services/caravan.service";
import { searchSchema } from "@/modules/catalogue/validation/schemas";
import { parseSearchParams, withRateLimit, serverError } from "@/lib/api-helpers";

const service = createCaravanService(prisma);

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const parsed = parseSearchParams(request, searchSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const result = await service.search(parsed.data.q, parsed.data.limit);
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
