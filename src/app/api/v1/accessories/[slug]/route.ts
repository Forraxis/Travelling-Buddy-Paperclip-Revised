import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAccessoryService } from "@/modules/catalogue/services/accessory.service";
import { withRateLimit, notFound, serverError } from "@/lib/api-helpers";

const service = createAccessoryService(prisma);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { slug } = await params;
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get("category") ?? undefined;

  try {
    const accessory = await service.getDetailBySlug(slug, categorySlug);
    if (!accessory) return notFound("Accessory");
    return NextResponse.json(accessory);
  } catch (err) {
    return serverError(err);
  }
}
