import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serverError } from "@/lib/api-helpers";

const sharedSetupInclude = {
  vehicleVariant: { include: { model: { include: { make: true } } } },
  caravanVariant: { include: { model: { include: { make: true } } } },
  accessories: {
    include: {
      fitment: {
        include: {
          accessory: { include: { brand: true, category: true } },
        },
      },
    },
  },
  caravanAccessories: {
    include: {
      fitment: {
        include: {
          accessory: { include: { brand: true, category: true } },
        },
      },
    },
  },
  customLoads: true,
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const setup = await prisma.setup.findUnique({
      where: { shareToken: token, deletedAt: null },
      include: sharedSetupInclude,
    });

    if (!setup) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { userId, ...publicSetup } = setup;

    return NextResponse.json(publicSetup, {
      headers: { "X-Robots-Tag": "noindex" },
    });
  } catch (err) {
    return serverError(err);
  }
}
