import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { MountingLocation } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateShareToken } from '@/lib/share-token';
import { generateSetupName } from '@/lib/setup-name';
import { serverError } from '@/lib/api-helpers';
import { buildSnapshots } from '@/lib/setup-snapshots';
import type { Prisma } from '@prisma/client';

const mountingLocationEnum = z.nativeEnum(MountingLocation);

const customLoadSchema = z.object({
  label: z.string().min(1).max(200),
  weightKg: z.number().min(0).max(99999),
  mountingLocation: mountingLocationEnum,
  cogXMm: z.number().int().optional(),
  cogYMm: z.number().int().optional(),
  side: z.enum(['VEHICLE', 'CARAVAN', 'BOTH']).optional(),
  footprintLengthMm: z.number().int().min(0).max(10000).optional(),
  footprintWidthMm: z.number().int().min(0).max(5000).optional(),
  notes: z.string().max(500).optional(),
});

const accessoryEntrySchema = z.object({
  fitmentId: z.string(),
  parentId: z.string().optional(),
  quantityOverride: z.number().int().min(1).default(1),
  fillPercent: z.number().int().min(0).max(100).default(100),
  cogXMm: z.number().int().optional(),
  cogYMm: z.number().int().optional(),
  notes: z.string().max(500).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  vehicleVariantId: z.string().optional(),
  caravanVariantId: z.string().optional(),
  passengers: z.number().int().min(0).max(20).default(2),
  cargoKg: z.number().min(0).max(99999).default(0),
  fuelPercent: z.number().int().min(0).max(100).default(100),
  freshWaterPercent: z.number().int().min(0).max(100).default(100),
  greyWaterPercent: z.number().int().min(0).max(100).default(0),
  calibrationOverrides: z.record(z.string(), z.unknown()).default({}),
  regulationSetCode: z
    .enum(['AU_ADR', 'NZ_VIRM', 'US_FMVSS', 'EU_UNECE', 'GB_IVA'])
    .default('AU_ADR'),
  tags: z.array(z.string().max(50)).max(20).default([]),
  accessories: z.array(accessoryEntrySchema).default([]),
  caravanAccessories: z.array(accessoryEntrySchema).default([]),
  customLoads: z.array(customLoadSchema).default([]),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
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

    const data = parsed.data;

    let name = data.name;
    if (!name) {
      if (data.vehicleVariantId) {
        const vehicle = await prisma.vehicleVariant.findUnique({
          where: { id: data.vehicleVariantId },
          include: { model: { select: { name: true } } },
        });
        let caravan = null;
        if (data.caravanVariantId) {
          caravan = await prisma.caravanVariant.findUnique({
            where: { id: data.caravanVariantId },
            include: { model: { select: { name: true } } },
          });
        }
        if (vehicle) {
          name = generateSetupName(vehicle, caravan);
        }
      }
      if (!name) name = `Setup ${new Date().toLocaleDateString('en-AU')}`;
    }

    const snapshots = await buildSnapshots({
      vehicleVariantId: data.vehicleVariantId,
      caravanVariantId: data.caravanVariantId,
      accessoryFitmentIds: data.accessories.map((a) => a.fitmentId),
      caravanAccessoryFitmentIds: data.caravanAccessories.map(
        (a) => a.fitmentId,
      ),
    });

    const setup = await prisma.setup.create({
      data: {
        userId: session.user.id,
        name,
        vehicleVariantId: data.vehicleVariantId,
        caravanVariantId: data.caravanVariantId,
        passengers: data.passengers,
        cargoKg: data.cargoKg,
        fuelPercent: data.fuelPercent,
        freshWaterPercent: data.freshWaterPercent,
        greyWaterPercent: data.greyWaterPercent,
        calibrationOverrides:
          data.calibrationOverrides as Prisma.InputJsonValue,
        regulationSetCode: data.regulationSetCode,
        tags: data.tags,
        shareToken: generateShareToken(),
        vehicleSnapshot: snapshots.vehicleSnapshot,
        caravanSnapshot: snapshots.caravanSnapshot,
        accessorySnapshot: snapshots.accessorySnapshot,
        accessories: {
          create: data.accessories.map((a) => ({
            fitmentId: a.fitmentId,
            parentId: a.parentId,
            quantityOverride: a.quantityOverride,
            fillPercent: a.fillPercent,
            cogXMmOverride: a.cogXMm,
            cogYMmOverride: a.cogYMm,
            notes: a.notes,
          })),
        },
        caravanAccessories: {
          create: data.caravanAccessories.map((a) => ({
            fitmentId: a.fitmentId,
            parentId: a.parentId,
            quantityOverride: a.quantityOverride,
            fillPercent: a.fillPercent,
            cogXMmOverride: a.cogXMm,
            cogYMmOverride: a.cogYMm,
            notes: a.notes,
          })),
        },
        customLoads: {
          create: data.customLoads.map((l) => ({
            label: l.label,
            weightKg: l.weightKg,
            mountingLocation: l.mountingLocation,
            cogXMm: l.cogXMm,
            cogYMm: l.cogYMm,
            side: l.side,
            footprintLengthMm: l.footprintLengthMm,
            footprintWidthMm: l.footprintWidthMm,
            notes: l.notes,
          })),
        },
      },
      include: {
        vehicleVariant: { include: { model: { include: { make: true } } } },
        caravanVariant: { include: { model: { include: { make: true } } } },
      },
    });

    return NextResponse.json(setup, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

const listSchema = z.object({
  sort: z.enum(['name', 'createdAt', 'updatedAt']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  tag: z.string().optional(),
  q: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const raw: Record<string, string> = {};
    searchParams.forEach((v, k) => (raw[k] = v));

    const parsed = listSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const { sort, order, tag, q } = parsed.data;

    const where: Record<string, unknown> = {
      userId: session.user.id,
      deletedAt: null,
    };

    if (tag) {
      where.tags = { has: tag };
    }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ];
    }

    const setups = await prisma.setup.findMany({
      where,
      orderBy: { [sort]: order },
      include: {
        vehicleVariant: { include: { model: { include: { make: true } } } },
        caravanVariant: { include: { model: { include: { make: true } } } },
        _count: {
          select: {
            accessories: true,
            caravanAccessories: true,
            customLoads: true,
          },
        },
      },
    });

    const items = setups.map((s) => ({
      id: s.id,
      name: s.name,
      tags: s.tags,
      vehicleVariant: s.vehicleVariant
        ? {
            id: s.vehicleVariant.id,
            name: s.vehicleVariant.name,
            model: s.vehicleVariant.model.name,
            make: s.vehicleVariant.model.make.name,
          }
        : null,
      caravanVariant: s.caravanVariant
        ? {
            id: s.caravanVariant.id,
            name: s.caravanVariant.name,
            model: s.caravanVariant.model.name,
            make: s.caravanVariant.model.make.name,
          }
        : null,
      accessoryCount: s._count.accessories + s._count.caravanAccessories,
      customLoadCount: s._count.customLoads,
      shareToken: s.shareToken,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return serverError(err);
  }
}
