import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { parseSearchParams, withRateLimit, notFound, serverError } from "@/lib/api-helpers";

const filterSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  fuelType: z.enum(["DIESEL", "PETROL", "HYBRID", "ELECTRIC"]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ makeId: string; modelId: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { makeId, modelId } = await params;
  const parsed = parseSearchParams(request, filterSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const model = await prisma.vehicleModel.findFirst({
      where: { id: modelId, makeId },
      include: { make: true },
    });
    if (!model) return notFound("Vehicle model");

    // Fetch all variants for facet computation
    const allVariants = await prisma.vehicleVariant.findMany({
      where: { modelId },
      select: { yearFrom: true, yearTo: true, fuelType: true, isCurrentProduction: true },
    });

    const currentYear = new Date().getFullYear();
    const fuelTypeFacets = [...new Set(allVariants.map((v) => v.fuelType))].sort();
    const yearMin = allVariants.length
      ? Math.min(...allVariants.map((v) => v.yearFrom))
      : null;
    const yearMax = allVariants.length
      ? Math.max(...allVariants.map((v) => (v.isCurrentProduction ? currentYear : v.yearTo)))
      : null;

    // Apply filters
    const { year, fuelType } = parsed.data;
    const whereFilter: Record<string, unknown> = { modelId };
    if (fuelType) whereFilter.fuelType = fuelType;
    if (year) {
      whereFilter.yearFrom = { lte: year };
      whereFilter.OR = [{ yearTo: { gte: year } }, { isCurrentProduction: true }];
    }

    const variants = await prisma.vehicleVariant.findMany({
      where: whereFilter,
      include: { model: { include: { make: true } } },
      orderBy: [{ yearFrom: "desc" }, { name: "asc" }],
    });

    const items = variants.map((v) => {
      const yearSpan = v.isCurrentProduction
        ? `${v.yearFrom}–present`
        : `${v.yearFrom}–${v.yearTo}`;
      return {
        id: v.id,
        type: "vehicle" as const,
        label: `${v.model.make.name} ${v.model.name} ${v.name} (${yearSpan})`,
        make: v.model.make.name,
        makeId: v.model.make.id,
        makeSlug: v.model.make.slug,
        model: v.model.name,
        modelId: v.model.id,
        modelSlug: v.model.slug,
        variant: v.name,
        variantSlug: v.slug,
        yearSpan,
        specs: {
          gvmKg: v.gvmKg,
          gcmKg: v.gcmKg,
          maxTowingCapacityKg: v.maxTowingCapacityKg,
          kerbWeightKg: v.kerbWeightKg,
          fuelType: v.fuelType,
          bodyType: v.model.bodyType,
        },
        confidenceBadge: "manufacturer_spec" as const,
      };
    });

    return NextResponse.json({
      items,
      facets: {
        yearMin,
        yearMax,
        fuelTypes: fuelTypeFacets,
        bodyType: model.bodyType,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
