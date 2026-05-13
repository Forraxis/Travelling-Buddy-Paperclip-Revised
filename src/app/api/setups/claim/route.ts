import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateShareToken } from "@/lib/share-token";
import { generateSetupName } from "@/lib/setup-name";
import { serverError } from "@/lib/api-helpers";
import { buildSnapshots } from "@/lib/setup-snapshots";
import type { Prisma } from "@prisma/client";

const accessorySelectionSchema = z.object({
  accessoryId: z.string(),
  massKg: z.number(),
  mountingLocation: z.string(),
});

const journeySchema = z.object({
  passengers: z.number().int().min(0).max(20).default(2),
  passengerWeightKg: z.number().default(80),
  cargoKg: z.number().min(0).default(0),
  fuelPercent: z.number().int().min(0).max(100).default(100),
  freshWaterPercent: z.number().int().min(0).max(100).default(100),
  greyWaterPercent: z.number().int().min(0).max(100).default(0),
  gearKg: z.number().default(0),
});

const calculatorStateSchema = z.object({
  vehicleVariantId: z.string().nullable().optional(),
  caravanVariantId: z.string().nullable().optional(),
  journey: journeySchema.optional(),
  accessories: z.array(accessorySelectionSchema).default([]),
  caravanAccessories: z.array(accessorySelectionSchema).default([]),
});

const localSetupSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  rigIdentifier: z.string(),
  calculatorState: calculatorStateSchema,
  savedAt: z.string().optional(),
  lastEditedAt: z.string().optional(),
  v: z.literal(1),
});

const claimSchema = z.object({
  setups: z.array(localSetupSchema).min(1).max(50),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { setups } = parsed.data;
    const created: string[] = [];

    for (const local of setups) {
      const cs = local.calculatorState;
      const vehicleVariantId = cs.vehicleVariantId ?? undefined;
      const caravanVariantId = cs.caravanVariantId ?? undefined;
      const journey = cs.journey;

      // accessories: accessoryId field stores fitmentId (see VehiclePanel comment)
      const accessoryFitmentIds = cs.accessories.map((a) => a.accessoryId);
      const caravanFitmentIds = cs.caravanAccessories.map((a) => a.accessoryId);

      let name = local.name;
      if (!name && vehicleVariantId) {
        const vehicle = await prisma.vehicleVariant.findUnique({
          where: { id: vehicleVariantId },
          include: { model: { select: { name: true } } },
        });
        const caravan = caravanVariantId
          ? await prisma.caravanVariant.findUnique({
              where: { id: caravanVariantId },
              include: { model: { select: { name: true } } },
            })
          : null;
        if (vehicle) name = generateSetupName(vehicle, caravan);
      }
      if (!name) name = `Setup ${new Date().toLocaleDateString("en-AU")}`;

      const snapshots = await buildSnapshots({
        vehicleVariantId: vehicleVariantId ?? null,
        caravanVariantId: caravanVariantId ?? null,
        accessoryFitmentIds,
        caravanAccessoryFitmentIds: caravanFitmentIds,
      });

      const setup = await prisma.setup.create({
        data: {
          userId: session.user.id,
          name,
          vehicleVariantId: vehicleVariantId ?? null,
          caravanVariantId: caravanVariantId ?? null,
          passengers: journey?.passengers ?? 2,
          cargoKg: journey?.cargoKg ?? 0,
          fuelPercent: journey?.fuelPercent ?? 100,
          freshWaterPercent: journey?.freshWaterPercent ?? 100,
          greyWaterPercent: journey?.greyWaterPercent ?? 0,
          calibrationOverrides: {} as Prisma.InputJsonValue,
          regulationSetCode: "AU_ADR",
          tags: [],
          shareToken: generateShareToken(),
          vehicleSnapshot: snapshots.vehicleSnapshot,
          caravanSnapshot: snapshots.caravanSnapshot,
          accessorySnapshot: snapshots.accessorySnapshot,
          accessories: {
            create: cs.accessories.map((a) => ({
              fitmentId: a.accessoryId,
              quantityOverride: 1,
              fillPercent: 100,
            })),
          },
          caravanAccessories: {
            create: cs.caravanAccessories.map((a) => ({
              fitmentId: a.accessoryId,
              quantityOverride: 1,
              fillPercent: 100,
            })),
          },
        },
      });

      created.push(setup.id);
    }

    return NextResponse.json({ created, count: created.length }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
