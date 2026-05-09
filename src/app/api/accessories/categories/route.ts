import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, serverError } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const categories = await prisma.accessoryCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { accessories: { where: { status: "ACTIVE" } } } } },
    });

    const items = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      iconName: null,
      accessoryCount: c._count.accessories,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return serverError(err);
  }
}
