import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { MountingLocation } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { serverError, notFound } from '@/lib/api-helpers';
import { buildSnapshots } from '@/lib/setup-snapshots';
import type { Prisma } from '@prisma/client';

const fullSetupInclude = {
  vehicleVariant: { include: { model: { include: { make: true } } } },
  caravanVariant: { include: { model: { include: { make: true } } } },
  accessories: {
    include: {
      fitment: {
        include: {
          accessory: {
            include: { brand: true, category: true },
          },
        },
      },
    },
  },
  caravanAccessories: {
    include: {
      fitment: {
        include: {
          accessory: {
            include: { brand: true, category: true },
          },
        },
      },
    },
  },
  customLoads: true,
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const setup = await prisma.setup.findUnique({
      where: { id, deletedAt: null },
      include: fullSetupInclude,
    });

    if (!setup) return notFound('Setup');
    if (setup.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const vehicleSnapshotOnly = !!(
      !setup.vehicleVariant &&
      setup.vehicleVariantId === null &&
      setup.vehicleSnapshot
    );

    const caravanSnapshotOnly = !!(
      !setup.caravanVariant &&
      setup.caravanVariantId === null &&
      setup.caravanSnapshot
    );

    const accessorySnapshotArr = Array.isArray(setup.accessorySnapshot)
      ? (setup.accessorySnapshot as Array<{
          fitmentId: string;
          target: string;
        }>)
      : [];
    const removedFitments: string[] = [];

    if (accessorySnapshotArr.length > 0) {
      const allFitmentIds = [
        ...setup.accessories.map((a) => a.fitmentId),
        ...setup.caravanAccessories.map((a) => a.fitmentId),
      ];
      const liveFitments = await prisma.accessoryFitment.findMany({
        where: { id: { in: allFitmentIds } },
        select: { id: true },
      });
      const liveSet = new Set(liveFitments.map((f) => f.id));
      for (const snapEntry of accessorySnapshotArr) {
        if (!liveSet.has(snapEntry.fitmentId)) {
          removedFitments.push(snapEntry.fitmentId);
        }
      }
    }

    return NextResponse.json({
      ...setup,
      vehicleSnapshotOnly,
      caravanSnapshotOnly,
      removedFitments,
    });
  } catch (err) {
    return serverError(err);
  }
}

const accessoryEntrySchema = z.object({
  fitmentId: z.string(),
  parentId: z.string().optional(),
  quantityOverride: z.number().int().min(1).default(1),
  fillPercent: z.number().int().min(0).max(100).default(100),
  notes: z.string().max(500).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  vehicleVariantId: z.string().nullable().optional(),
  caravanVariantId: z.string().nullable().optional(),
  passengers: z.number().int().min(0).max(20).optional(),
  cargoKg: z.number().min(0).max(99999).optional(),
  fuelPercent: z.number().int().min(0).max(100).optional(),
  freshWaterPercent: z.number().int().min(0).max(100).optional(),
  greyWaterPercent: z.number().int().min(0).max(100).optional(),
  calibrationOverrides: z.record(z.string(), z.unknown()).optional(),
  regulationSetCode: z
    .enum(['AU_ADR', 'NZ_VIRM', 'US_FMVSS', 'EU_UNECE', 'GB_IVA'])
    .optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  accessories: z.array(accessoryEntrySchema).optional(),
  caravanAccessories: z.array(accessoryEntrySchema).optional(),
  customLoads: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        weightKg: z.number().min(0).max(99999),
        mountingLocation: z.nativeEnum(MountingLocation),
        cogXMm: z.number().int().optional(),
        cogYMm: z.number().int().optional(),
        notes: z.string().max(500).optional(),
      }),
    )
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.setup.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) return notFound('Setup');
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const {
      accessories,
      caravanAccessories,
      customLoads,
      calibrationOverrides,
      ...scalarFields
    } = parsed.data;

    const effectiveVehicleVariantId =
      scalarFields.vehicleVariantId !== undefined
        ? scalarFields.vehicleVariantId
        : existing.vehicleVariantId;
    const effectiveCaravanVariantId =
      scalarFields.caravanVariantId !== undefined
        ? scalarFields.caravanVariantId
        : existing.caravanVariantId;

    const needAccessorySnap =
      accessories !== undefined || caravanAccessories !== undefined;
    let accFitmentIds: string[] = [];
    let caravanAccFitmentIds: string[] = [];
    if (needAccessorySnap) {
      accFitmentIds = accessories
        ? accessories.map((a) => a.fitmentId)
        : (
            await prisma.setupAccessory.findMany({
              where: { setupId: id },
              select: { fitmentId: true },
            })
          ).map((r) => r.fitmentId);
      caravanAccFitmentIds = caravanAccessories
        ? caravanAccessories.map((a) => a.fitmentId)
        : (
            await prisma.setupCaravanAccessory.findMany({
              where: { setupId: id },
              select: { fitmentId: true },
            })
          ).map((r) => r.fitmentId);
    } else {
      accFitmentIds = (
        await prisma.setupAccessory.findMany({
          where: { setupId: id },
          select: { fitmentId: true },
        })
      ).map((r) => r.fitmentId);
      caravanAccFitmentIds = (
        await prisma.setupCaravanAccessory.findMany({
          where: { setupId: id },
          select: { fitmentId: true },
        })
      ).map((r) => r.fitmentId);
    }

    const snapshots = await buildSnapshots({
      vehicleVariantId: effectiveVehicleVariantId,
      caravanVariantId: effectiveCaravanVariantId,
      accessoryFitmentIds: accFitmentIds,
      caravanAccessoryFitmentIds: caravanAccFitmentIds,
    });

    const updateData: Prisma.SetupUpdateInput = {
      ...scalarFields,
      vehicleSnapshot: snapshots.vehicleSnapshot,
      caravanSnapshot: snapshots.caravanSnapshot,
      accessorySnapshot: snapshots.accessorySnapshot,
    };
    if (calibrationOverrides !== undefined) {
      updateData.calibrationOverrides =
        calibrationOverrides as Prisma.InputJsonValue;
    }

    const setup = await prisma.$transaction(async (tx) => {
      if (accessories !== undefined) {
        await tx.setupAccessory.deleteMany({ where: { setupId: id } });
        if (accessories.length > 0) {
          await tx.setupAccessory.createMany({
            data: accessories.map((a) => ({
              setupId: id,
              fitmentId: a.fitmentId,
              parentId: a.parentId,
              quantityOverride: a.quantityOverride,
              fillPercent: a.fillPercent,
              notes: a.notes,
            })),
          });
        }
      }

      if (caravanAccessories !== undefined) {
        await tx.setupCaravanAccessory.deleteMany({ where: { setupId: id } });
        if (caravanAccessories.length > 0) {
          await tx.setupCaravanAccessory.createMany({
            data: caravanAccessories.map((a) => ({
              setupId: id,
              fitmentId: a.fitmentId,
              parentId: a.parentId,
              quantityOverride: a.quantityOverride,
              fillPercent: a.fillPercent,
              notes: a.notes,
            })),
          });
        }
      }

      if (customLoads !== undefined) {
        await tx.setupCustomLoad.deleteMany({ where: { setupId: id } });
        if (customLoads.length > 0) {
          await tx.setupCustomLoad.createMany({
            data: customLoads.map((l) => ({
              setupId: id,
              label: l.label,
              weightKg: l.weightKg,
              mountingLocation: l.mountingLocation,
              cogXMm: l.cogXMm,
              cogYMm: l.cogYMm,
              notes: l.notes,
            })),
          });
        }
      }

      return tx.setup.update({
        where: { id },
        data: updateData,
        include: fullSetupInclude,
      });
    });

    return NextResponse.json(setup);
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.setup.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) return notFound('Setup');
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.setup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
