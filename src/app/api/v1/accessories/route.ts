import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAccessoryService } from "@/modules/catalogue/services/accessory.service";
import {
  accessoryPublicFilterSchema,
  accessoryPickerFilterSchema,
} from "@/modules/catalogue/validation/schemas";
import { parseSearchParams, withRateLimit, notFound, serverError } from "@/lib/api-helpers";

const service = createAccessoryService(prisma);

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const url = new URL(request.url);
  const hasPickerParams =
    url.searchParams.has("categoryId") ||
    url.searchParams.has("brandId") ||
    url.searchParams.has("mountingLocation");

  if (hasPickerParams) {
    const parsed = parseSearchParams(request, accessoryPickerFilterSchema);
    if ("error" in parsed) return parsed.error;

    const { cursor, limit, categoryId, brandId, mountingLocation } = parsed.data;
    try {
      const result = await service.listForPicker(
        { categoryId, brandId, mountingLocation },
        { cursor, limit }
      );
      return NextResponse.json(result);
    } catch (err) {
      return serverError(err);
    }
  }

  const parsed = parseSearchParams(request, accessoryPublicFilterSchema);
  if ("error" in parsed) return parsed.error;

  const { cursor, limit, brand, category, vehicleVariantId, caravanVariantId, q } = parsed.data;

  try {
    let brandId: string | undefined;
    let categoryId: string | undefined;

    if (brand) {
      const b = await prisma.accessoryBrand.findUnique({
        where: { slug: brand },
        select: { id: true },
      });
      if (!b) return notFound("Brand");
      brandId = b.id;
    }

    if (category) {
      const c = await prisma.accessoryCategory.findUnique({
        where: { slug: category },
        select: { id: true },
      });
      if (!c) return notFound("Category");
      categoryId = c.id;
    }

    if (q) {
      const results = await service.search(q, limit ?? 25);
      return NextResponse.json({ items: results.accessories, nextCursor: null, hasMore: false });
    }

    const result = await service.list(
      {
        brandId,
        categoryId,
        vehicleVariantId,
        caravanVariantId,
        status: "ACTIVE",
      },
      { cursor, limit }
    );
    return NextResponse.json(result);
  } catch (err) {
    return serverError(err);
  }
}
