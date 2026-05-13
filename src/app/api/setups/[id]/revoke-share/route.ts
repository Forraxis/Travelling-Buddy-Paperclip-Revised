import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateShareToken } from "@/lib/share-token";
import { serverError, notFound } from "@/lib/api-helpers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.setup.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) return notFound("Setup");
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.setup.update({
      where: { id },
      data: { shareToken: generateShareToken() },
      select: { id: true, shareToken: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err);
  }
}
