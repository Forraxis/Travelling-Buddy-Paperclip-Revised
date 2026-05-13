import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, serverError } from "@/lib/api-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const { id: categoryId } = await params;
    const { searchParams } = new URL(request.url);
    const vehicleVariantId = searchParams.get("vehicleVariantId") ?? undefined;
    const caravanVariantId = searchParams.get("caravanVariantId") ?? undefined;

    // For caravans, show all brands that have any caravan fitment; exact variant
    // matching happens at the items step.
    const fitmentFilter = vehicleVariantId
      ? { vehicleVariantId }
      : caravanVariantId
        ? { caravanVariantId: { not: null } }
        : undefined;

    const accessoryWhere = {
      categoryId,
      status: "ACTIVE" as const,
      ...(fitmentFilter ? { fitments: { some: fitmentFilter } } : {}),
    };

    const brands = await prisma.accessoryBrand.findMany({
      where: { accessories: { some: accessoryWhere } },
      orderBy: [{ isPartner: "desc" }, { name: "asc" }],
      include: { _count: { select: { accessories: { where: accessoryWhere } } } },
    });

    const items = brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      logoUrl: b.logoUrl,
      isPartner: b.isPartner,
      accessoryCount: b._count.accessories,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return serverError(err);
  }
}
