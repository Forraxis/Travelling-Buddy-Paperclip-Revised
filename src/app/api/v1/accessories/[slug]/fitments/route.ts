import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAccessoryService } from "@/modules/catalogue/services/accessory.service";
import { createFitmentService } from "@/modules/catalogue/services/fitment.service";
import { withRateLimit, notFound, serverError } from "@/lib/api-helpers";

const accessoryService = createAccessoryService(prisma);
const fitmentService = createFitmentService(prisma);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = withRateLimit(request);
  if (limited) return limited;

  const { slug } = await params;

  try {
    const accessory = await accessoryService.getDetailBySlug(slug);
    if (!accessory) return notFound("Accessory");

    const fitments = await fitmentService.getFitmentsForAccessory(accessory.id);
    return NextResponse.json({ accessoryId: accessory.id, fitments });
  } catch (err) {
    return serverError(err);
  }
}
