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

    const brands = await prisma.accessoryBrand.findMany({
      where: {
        accessories: {
          some: { categoryId, status: "ACTIVE" },
        },
      },
      orderBy: [{ isPartner: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { accessories: { where: { categoryId, status: "ACTIVE" } } } },
      },
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
