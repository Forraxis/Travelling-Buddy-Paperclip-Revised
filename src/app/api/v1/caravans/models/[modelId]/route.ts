import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCaravanService } from "@/modules/catalogue/services/caravan.service";
import { withRateLimit, notFound, serverError } from "@/lib/api-helpers";

const service = createCaravanService(prisma);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ modelId: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { modelId } = await params;

  try {
    const model = await service.getModelById(modelId);
    if (!model) return notFound("Caravan model");
    return NextResponse.json(model);
  } catch (err) {
    return serverError(err);
  }
}
