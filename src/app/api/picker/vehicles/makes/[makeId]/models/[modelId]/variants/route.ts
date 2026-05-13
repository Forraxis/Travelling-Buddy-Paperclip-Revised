import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
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

  const session = await auth();
  const userId = session?.user?.id ?? null;

  try {
    const model = await prisma.vehicleModel.findFirst({
      where: { id: modelId, makeId },
      include: { make: true },
    });
    if (!model) return notFound("Vehicle model");

    // Community filter clause — reused for both facets and filtered query
    const communityFilter = {
      OR: [
        { status: "CATALOGUE" as const },
        { status: "COMMUNITY" as const, communitySubmitterId: userId ?? "__no_match__" },
      ],
    };

    // Fetch all variants for facet computation
    const allVariants = await prisma.vehicleVariant.findMany({
      where: { modelId, ...communityFilter },
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
    const andClauses: object[] = [{ modelId }, communityFilter];
    if (fuelType) andClauses.push({ fuelType });
    if (year) {
      andClauses.push({ yearFrom: { lte: year } });
      andClauses.push({ OR: [{ yearTo: { gte: year } }, { isCurrentProduction: true }] });
    }

    const variants = await prisma.vehicleVariant.findMany({
      where: { AND: andClauses },
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
        confidenceBadge: (v.status === "COMMUNITY" ? "community" : "manufacturer_spec") as "community" | "manufacturer_spec",
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
