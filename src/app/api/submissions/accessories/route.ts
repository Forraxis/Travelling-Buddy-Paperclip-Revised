import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { submissionVlmQueue } from '@/lib/queue';
import {
  accessoryFingerprint,
  checkAccessoryDuplicate,
} from '@/lib/duplicate-detection';

const AccessorySubmissionSchema = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().optional(),
  newBrandName: z.string().min(1).optional(),
  modelName: z.string().min(1),
  weightKg: z.number().positive(),
  mountingLocation: z.string().optional(),
  positionNote: z.string().optional(),
  productPhotoUrl: z.string().url().optional(),
  installationPhotoUrl: z.string().url().optional(),
  productPhotoKey: z.string().optional(),
  isShared: z.boolean().default(true),
  appliesToVehicleVariantId: z.string().optional(),
  appliesToCaravanVariantId: z.string().optional(),
  // Client acknowledges duplicate warning
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

  const parsed = AccessorySubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const userId = session.user.id;

  // Resolve or create the brand
  let resolvedBrandId: string;
  let resolvedBrandName: string;

  if (data.brandId) {
    const brand = await prisma.accessoryBrand.findUnique({
      where: { id: data.brandId },
      select: { id: true, name: true },
    });
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 422 });
    }
    resolvedBrandId = brand.id;
    resolvedBrandName = brand.name;
  } else if (data.newBrandName) {
    const slug = toSlug(data.newBrandName);
    const brand = await prisma.accessoryBrand.upsert({
      where: { slug },
      update: {},
      create: { name: data.newBrandName, slug },
      select: { id: true, name: true },
    });
    resolvedBrandId = brand.id;
    resolvedBrandName = brand.name;
  } else {
    return NextResponse.json(
      { error: 'Either brandId or newBrandName is required' },
      { status: 422 },
    );
  }

  const fingerprint = accessoryFingerprint({
    brandName: resolvedBrandName,
    modelName: data.modelName,
  });

  // Duplicate detection — surface warning before creating if not overridden
  if (!data.duplicateOverride) {
    const dupCheck = await checkAccessoryDuplicate(fingerprint);
    if (dupCheck.hasDuplicate) {
      return NextResponse.json(
        {
          duplicate: true,
          existingId: dupCheck.existingId,
          existingName: dupCheck.existingName,
          message:
            'We may already have this accessory. Is yours different from the existing one?',
        },
        { status: 409 },
      );
    }
  }

  const draftExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const submittedData = {
    categoryId: data.categoryId,
    brandId: data.brandId,
    newBrandName: data.newBrandName,
    modelName: data.modelName,
    weightKg: data.weightKg,
    mountingLocation: data.mountingLocation,
    positionNote: data.positionNote,
  };

  // Create the community Accessory immediately so it's usable in calculations
  const accessorySlugBase = toSlug(`${resolvedBrandName} ${data.modelName}`);
  // Append a short random suffix to avoid unique constraint collisions on community submissions
  const accessorySlug = `${accessorySlugBase}-${Math.random().toString(36).slice(2, 7)}`;

  const [submission, accessory] = await prisma.$transaction(async (tx) => {
    const newAccessory = await tx.accessory.create({
      data: {
        brandId: resolvedBrandId,
        categoryId: data.categoryId,
        name: data.modelName,
        slug: accessorySlug,
        status: 'COMMUNITY',
        imageUrls: data.productPhotoUrl ? [data.productPhotoUrl] : [],
      },
    });

    const newSubmission = await tx.accessorySubmission.create({
      data: {
        submitterId: userId,
        // PENDING = queued for moderation when shared; DRAFT = private only
        status: data.isShared ? 'PENDING' : 'DRAFT',
        categoryId: data.categoryId,
        brandId: resolvedBrandId,
        submittedData,
        productPhotoUrl: data.productPhotoUrl,
        installationPhotoUrl: data.installationPhotoUrl,
        appliesToVehicleVariantId: data.appliesToVehicleVariantId,
        appliesToCaravanVariantId: data.appliesToCaravanVariantId,
        isShared: data.isShared,
        duplicateFingerprint: fingerprint,
        dupSuspected: data.dupSuspected,
        draftExpiresAt,
        resultingAccessoryId: newAccessory.id,
      },
    });

    return [newSubmission, newAccessory];
  });

  // Queue VLM similarity check (non-blocking — fires and continues)
  if (data.productPhotoKey) {
    const job = await submissionVlmQueue.add(
      'analyse-accessory',
      {
        submissionType: 'accessory',
        submissionId: submission.id,
        photoKeys: [data.productPhotoKey],
        submittedData: submittedData as Record<string, unknown>,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    );

    await prisma.accessorySubmission.update({
      where: { id: submission.id },
      data: { vlmJobId: job.id ?? null },
    });
  }

  return NextResponse.json(
    {
      id: submission.id,
      accessoryId: accessory.id,
      brandId: resolvedBrandId,
      brandName: resolvedBrandName,
      status: submission.status,
      isShared: submission.isShared,
      message: data.isShared
        ? 'Accessory submitted for moderation. You can use it in your calculation now.'
        : 'Accessory saved as private. You can use it in your calculation now.',
    },
    { status: 201 },
  );
}
