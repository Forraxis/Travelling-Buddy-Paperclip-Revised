import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { parseSearchParams, withRateLimit, serverError } from "@/lib/api-helpers";

const schema = z.object({
  categoryId: z.string().optional(),
  mountingLocation: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { brandId } = await params;
  const parsed = parseSearchParams(request, schema);
  if ("error" in parsed) return parsed.error;

  const { categoryId, mountingLocation } = parsed.data;

  try {
    const fitments = await prisma.accessoryFitment.findMany({
      where: {
        ...(mountingLocation ? { mountingLocation: mountingLocation as never } : {}),
        accessory: {
          brandId,
          status: "ACTIVE",
          ...(categoryId ? { categoryId } : {}),
        },
      },
      include: {
        accessory: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: [{ accessory: { name: "asc" } }, { mountingLocation: "asc" }],
    });

    // Collect available mounting locations for filter chips
    const allLocations = [
      ...new Set(fitments.map((f) => f.mountingLocation)),
    ].sort();

    const items = fitments.map((f) => ({
      fitmentId: f.id,
      accessoryId: f.accessoryId,
      name: f.accessory.name,
      categoryId: f.accessory.categoryId,
      categoryName: f.accessory.category.name,
      mountingLocation: f.mountingLocation,
      installedWeightKg: Number(f.installedWeightKg),
    }));

    return NextResponse.json({ items, allLocations });
  } catch (err) {
    return serverError(err);
  }
}
