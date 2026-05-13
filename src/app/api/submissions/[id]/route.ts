import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  // Try each submission type
  const vehicle = await prisma.vehicleSubmission.findFirst({
    where: { id, submitterId: userId },
    select: {
      id: true,
      status: true,
      submittedData: true,
      decisionNotes: true,
      decidedAt: true,
      vlmGatekeeperResult: true,
      createdAt: true,
    },
  });
  if (vehicle) return NextResponse.json({ ...vehicle, type: "vehicle" });

  const caravan = await prisma.caravanSubmission.findFirst({
    where: { id, submitterId: userId },
    select: {
      id: true,
      status: true,
      submittedData: true,
      decisionNotes: true,
      decidedAt: true,
      vlmGatekeeperResult: true,
      createdAt: true,
    },
  });
  if (caravan) return NextResponse.json({ ...caravan, type: "caravan" });

  const accessory = await prisma.accessorySubmission.findFirst({
    where: { id, submitterId: userId },
    select: {
      id: true,
      status: true,
      submittedData: true,
      decisionNotes: true,
      decidedAt: true,
      createdAt: true,
      isShared: true,
    },
  });
  if (accessory) return NextResponse.json({ ...accessory, type: "accessory" });

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
