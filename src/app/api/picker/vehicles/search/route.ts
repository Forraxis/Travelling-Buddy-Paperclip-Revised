import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { parseSearchParams, withRateLimit, serverError } from "@/lib/api-helpers";

const schema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const parsed = parseSearchParams(request, schema);
  if ("error" in parsed) return parsed.error;

  const { q, limit } = parsed.data;

  try {
    const variants = await prisma.vehicleVariant.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { model: { name: { contains: q, mode: "insensitive" } } },
          { model: { make: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
      include: { model: { include: { make: true } } },
      take: limit,
      orderBy: [
        { model: { make: { name: "asc" } } },
        { model: { name: "asc" } },
        { yearFrom: "desc" },
        { name: "asc" },
      ],
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

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    return serverError(err);
  }
}
