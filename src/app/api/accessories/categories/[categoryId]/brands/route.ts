import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, serverError } from "@/lib/api-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { categoryId } = await params;

  try {
    const brands = await prisma.accessoryBrand.findMany({
      where: {
        status: "ACTIVE",
        accessories: { some: { categoryId, status: "ACTIVE" } },
      },
      orderBy: [{ isPartner: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        isPartner: true,
        _count: {
          select: { accessories: { where: { categoryId, status: "ACTIVE" } } },
        },
      },
    });

    return NextResponse.json({
      items: brands.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl,
        isPartner: b.isPartner,
        accessoryCount: b._count.accessories,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
}
