import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { submissionVlmQueue } from '@/lib/queue';
import {
  vehicleFingerprint,
  checkVehicleDuplicate,
} from '@/lib/duplicate-detection';

const VehicleSubmissionSchema = z.object({
  makeId: z.string().min(1),
  newMakeName: z.string().optional(),
  modelId: z.string().min(1),
  newModelName: z.string().optional(),
  year: z
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 2),
  variantName: z.string().min(1),
  bodyType: z.string().min(1),
  drivetrain: z.string().min(1),
  transmission: z.string().min(1),
  fuelType: z.string().min(1),
  // GVM/GCM — required for community variants (pre-filled from OCR, confirmed by user)
  gvmKg: z.number().int().positive().optional(),
  gcmKg: z.number().int().positive().optional(),
  // Optional technical fields (not on plate)
  wheelbaseMm: z.number().positive().optional(),
  frontOverhangMm: z.number().positive().optional(),
  rearOverhangMm: z.number().positive().optional(),
  totalLengthMm: z.number().positive().optional(),
  fuelTankLitres: z.number().positive().optional(),
  // Photo upload result from /api/upload/photo
  compliancePlatePhotoUrl: z.string().url().optional(),
  compliancePlatePhotoKey: z.string().optional(),
  additionalPhotoUrls: z.array(z.string().url()).default([]),
  additionalPhotoKeys: z.array(z.string()).default([]),
  notes: z.string().optional(),
  duplicateOverride: z.boolean().default(false),
  dupSuspected: z.boolean().default(false),
});

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fuelTypeEnum(
  fuelType: string,
): 'PETROL' | 'DIESEL' | 'HYBRID' | 'ELECTRIC' {
  const map: Record<string, 'PETROL' | 'DIESEL' | 'HYBRID' | 'ELECTRIC'> = {
    petrol: 'PETROL',
    diesel: 'DIESEL',
    hybrid: 'HYBRID',
    electric: 'ELECTRIC',
    lpg: 'PETROL', // closest available enum value
    other: 'PETROL',
  };
  return map[fuelType.toLowerCase()] ?? 'PETROL';
}

function bodyTypeEnum(
  bodyType: string,
):
  | 'DUAL_CAB_UTE'
  | 'SINGLE_CAB_UTE'
  | 'EXTRA_CAB_UTE'
  | 'WAGON'
  | 'SUV'
  | 'VAN'
  | 'TROOPCARRIER'
  | 'OTHER' {
  const map: Record<
    string,
    | 'DUAL_CAB_UTE'
    | 'SINGLE_CAB_UTE'
    | 'EXTRA_CAB_UTE'
    | 'WAGON'
    | 'SUV'
    | 'VAN'
    | 'TROOPCARRIER'
    | 'OTHER'
  > = {
    'dual-cab ute': 'DUAL_CAB_UTE',
    'single-cab ute': 'SINGLE_CAB_UTE',
    'extra-cab ute': 'EXTRA_CAB_UTE',
    wagon: 'WAGON',
    suv: 'SUV',
    van: 'VAN',
    troopcarrier: 'TROOPCARRIER',
  };
  return map[bodyType.toLowerCase()] ?? 'OTHER';
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = VehicleSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const userId = session.user.id;

  const fingerprint = vehicleFingerprint({
    makeId: data.makeId,
    modelId: data.modelId,
    year: data.year,
    bodyType: data.bodyType,
    drivetrain: data.drivetrain,
    transmission: data.transmission,
  });

  if (!data.duplicateOverride) {
    const dupCheck = await checkVehicleDuplicate(fingerprint);
    if (dupCheck.hasDuplicate) {
      return NextResponse.json(
        {
          duplicate: true,
          existingId: dupCheck.existingId,
          existingName: dupCheck.existingName,
          message:
            'We may already have this vehicle. Is yours different from the existing one?',
        },
        { status: 409 },
      );
    }
  }

  const draftExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const submittedData = {
    makeId: data.makeId,
    newMakeName: data.newMakeName,
    modelId: data.modelId,
    newModelName: data.newModelName,
    year: data.year,
    variantName: data.variantName,
    bodyType: data.bodyType,
    drivetrain: data.drivetrain,
    transmission: data.transmission,
    fuelType: data.fuelType,
    gvmKg: data.gvmKg,
    gcmKg: data.gcmKg,
    wheelbaseMm: data.wheelbaseMm,
    frontOverhangMm: data.frontOverhangMm,
    rearOverhangMm: data.rearOverhangMm,
    totalLengthMm: data.totalLengthMm,
    fuelTankLitres: data.fuelTankLitres,
  };

  // Resolve or create the VehicleMake and VehicleModel for the community variant
  const [submission, communityVariant] = await prisma.$transaction(
    async (tx) => {
      // Resolve make
      let resolvedMakeId = data.makeId !== 'new' ? data.makeId : null;
      if (!resolvedMakeId && data.newMakeName) {
        const makeSlug = toSlug(data.newMakeName);
        const make = await tx.vehicleMake.upsert({
          where: { slug: makeSlug },
          update: {},
          create: { name: data.newMakeName, slug: makeSlug },
          select: { id: true },
        });
        resolvedMakeId = make.id;
      }
      if (!resolvedMakeId) {
        throw new Error('Make is required');
      }

      // Resolve model
      let resolvedModelId = data.modelId !== 'new' ? data.modelId : null;
      if (!resolvedModelId && data.newModelName) {
        const modelSlug = toSlug(
          `${data.newModelName}-${Math.random().toString(36).slice(2, 6)}`,
        );
        const model = await tx.vehicleModel.upsert({
          where: { makeId_slug: { makeId: resolvedMakeId, slug: modelSlug } },
          update: {},
          create: {
            makeId: resolvedMakeId,
            name: data.newModelName,
            slug: modelSlug,
            bodyType: bodyTypeEnum(data.bodyType),
          },
          select: { id: true },
        });
        resolvedModelId = model.id;
      }
      if (!resolvedModelId) {
        throw new Error('Model is required');
      }

      // Create the community VehicleVariant — immediately usable by the submitter
      const variantSlug = toSlug(
        `${data.variantName}-${data.year}-${Math.random().toString(36).slice(2, 6)}`,
      );

      const newVariant = await tx.vehicleVariant.create({
        data: {
          modelId: resolvedModelId,
          status: 'COMMUNITY',
          communitySubmitterId: userId,
          yearFrom: data.year,
          yearTo: data.year,
          isCurrentProduction: false,
          name: `${data.variantName} (Community)`,
          slug: variantSlug,
          gvmKg: data.gvmKg ?? null,
          gcmKg: data.gcmKg ?? null,
          kerbWeightKg: null,
          maxTowingCapacityKg: null,
          frontAxleLimitKg: null,
          rearAxleLimitKg: null,
          maxTowBallDownloadKg: null,
          wheelbaseMm: data.wheelbaseMm ? Math.round(data.wheelbaseMm) : null,
          frontOverhangMm: data.frontOverhangMm
            ? Math.round(data.frontOverhangMm)
            : null,
          rearOverhangMm: data.rearOverhangMm
            ? Math.round(data.rearOverhangMm)
            : null,
          totalLengthMm: data.totalLengthMm
            ? Math.round(data.totalLengthMm)
            : null,
          fuelTankCapacityL: data.fuelTankLitres
            ? Math.round(data.fuelTankLitres)
            : null,
          fuelType: fuelTypeEnum(data.fuelType),
          market: 'AU',
        },
      });

      const newSubmission = await tx.vehicleSubmission.create({
        data: {
          submitterId: userId,
          status: 'PENDING',
          submittedData,
          compliancePlatePhotoUrl: data.compliancePlatePhotoUrl,
          additionalPhotoUrls: data.additionalPhotoUrls,
          notes: data.notes,
          duplicateFingerprint: fingerprint,
          dupSuspected: data.dupSuspected,
          draftExpiresAt,
          resultingVariantId: newVariant.id,
        },
      });

      return [newSubmission, newVariant];
    },
  );

  // Dispatch async VLM job (Tier 2 — does not block response)
  const photoKeys = [
    data.compliancePlatePhotoKey,
    ...data.additionalPhotoKeys,
  ].filter(Boolean) as string[];

  if (photoKeys.length > 0) {
    const job = await submissionVlmQueue.add(
      'analyse-vehicle',
      {
        submissionType: 'vehicle',
        submissionId: submission.id,
        photoKeys,
        submittedData: submittedData as Record<string, unknown>,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    );

    await prisma.vehicleSubmission.update({
      where: { id: submission.id },
      data: { vlmJobId: job.id ?? null },
    });
  }

  return NextResponse.json(
    {
      id: submission.id,
      variantId: communityVariant.id,
      status: submission.status,
      message:
        'Vehicle submitted for review. You can use it in your own calculations while it awaits approval.',
    },
    { status: 201 },
  );
}
