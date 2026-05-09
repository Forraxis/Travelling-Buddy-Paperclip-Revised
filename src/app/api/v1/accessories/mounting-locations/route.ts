import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createFitmentService } from "@/modules/catalogue/services/fitment.service";
import { mountingLocationsQuerySchema } from "@/modules/catalogue/validation/schemas";
import { parseSearchParams, withRateLimit, serverError } from "@/lib/api-helpers";

const service = createFitmentService(prisma);

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const parsed = parseSearchParams(request, mountingLocationsQuerySchema);
  if ("error" in parsed) return parsed.error;

  const { vehicleVariantId, fittedFitmentIds } = parsed.data;

  try {
    const ids = fittedFitmentIds
      ? fittedFitmentIds.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const locations = await service.getAvailableMountingLocations(vehicleVariantId, ids);
    return NextResponse.json({ vehicleVariantId, mountingLocations: locations });
  } catch (err) {
    return serverError(err);
  }
}
