import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, serverError } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  try {
    const makes = await prisma.caravanMake.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { models: true } } },
    });

    return NextResponse.json({
      items: makes.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        logoUrl: m.logoUrl,
        modelCount: m._count.models,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
}
