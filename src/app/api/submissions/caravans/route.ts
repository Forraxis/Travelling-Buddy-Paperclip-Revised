import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submissionVlmQueue } from "@/lib/queue";
import {
  caravanFingerprint,
  checkCaravanDuplicate,
} from "@/lib/duplicate-detection";

const CaravanSubmissionSchema = z.object({
  makeId: z.string().min(1),
  newMakeName: z.string().optional(),
  modelId: z.string().min(1),
  newModelName: z.string().optional(),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 2),
  variantName: z.string().min(1),
  bodyType: z.string().min(1),
  axleConfiguration: z.enum([
    "SINGLE_AXLE",
    "DUAL_AXLE_CLOSE_COUPLED",
    "DUAL_AXLE_SPREAD",
    "TRIPLE_AXLE",
  ]),
  // Weights — required for useful calculations
  atmKg: z.number().int().positive(),
  gtmKg: z.number().int().positive(),
  tareKg: z.number().int().positive(),
  tbmKg: z.number().int().positive(),
  // Geometry — captured but not mandatory for submission
  couplingToAxleMm: z.number().positive().optional(),
  axleSpacingMm: z.number().positive().optional(),
  bodyLengthMm: z.number().positive().optional(),
  overallLengthMm: z.number().positive().optional(),
  // Tank and gas config
  freshWaterLitres: z.number().positive().optional(),
  greyWaterLitres: z.number().positive().optional(),
  gasBottleConfig: z.string().optional(),
  // Photos
  compliancePlatePhotoUrl: z.string().url().optional(),
  compliancePlatePhotoKey: z.string().optional(),
  additionalPhotoUrls: z.array(z.string().url()).default([]),
  additionalPhotoKeys: z.array(z.string()).default([]),
  notes: z.string().optional(),
  duplicateOverride: z.boolean().default(false),
});

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function bodyTypeEnum(
  bodyType: string
): "CARAVAN_POP_TOP" | "CARAVAN_FULL_HEIGHT" | "OFF_ROAD_CARAVAN" | "CAMPER_TRAILER" | "FIFTH_WHEELER" | "OTHER" {
  const map: Record<string, "CARAVAN_POP_TOP" | "CARAVAN_FULL_HEIGHT" | "OFF_ROAD_CARAVAN" | "CAMPER_TRAILER" | "FIFTH_WHEELER" | "OTHER"> = {
    "caravan (pop-top)": "CARAVAN_POP_TOP",
    "caravan (full-height)": "CARAVAN_FULL_HEIGHT",
    "off-road caravan": "OFF_ROAD_CARAVAN",
    "camper trailer": "CAMPER_TRAILER",
    "fifth-wheeler": "FIFTH_WHEELER",
  };
  return map[bodyType.toLowerCase()] ?? "OTHER";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CaravanSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const userId = session.user.id;

  const fingerprint = caravanFingerprint({
    makeId: data.makeId,
    modelId: data.modelId,
    year: data.year,
    bodyType: data.bodyType,
    axleConfiguration: data.axleConfiguration,
  });

  if (!data.duplicateOverride) {
    const dupCheck = await checkCaravanDuplicate(fingerprint);
    if (dupCheck.hasDuplicate) {
      return NextResponse.json(
        {
          duplicate: true,
          existingId: dupCheck.existingId,
          existingName: dupCheck.existingName,
          message:
            "We may already have this caravan. Is yours different from the existing one?",
        },
        { status: 409 }
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
    axleConfiguration: data.axleConfiguration,
    atmKg: data.atmKg,
    gtmKg: data.gtmKg,
    tareKg: data.tareKg,
    tbmKg: data.tbmKg,
    couplingToAxleMm: data.couplingToAxleMm,
    axleSpacingMm: data.axleSpacingMm,
    bodyLengthMm: data.bodyLengthMm,
    overallLengthMm: data.overallLengthMm,
    freshWaterLitres: data.freshWaterLitres,
    greyWaterLitres: data.greyWaterLitres,
    gasBottleConfig: data.gasBottleConfig,
  };

  // Create community variant + submission atomically
  const [submission, communityVariant] = await prisma.$transaction(async (tx) => {
    // Resolve or create CaravanMake
    let resolvedMakeId = data.makeId !== "new" ? data.makeId : null;
    if (!resolvedMakeId && data.newMakeName) {
      const makeSlug = toSlug(data.newMakeName);
      const make = await tx.caravanMake.upsert({
        where: { slug: makeSlug },
        update: {},
        create: { name: data.newMakeName, slug: makeSlug },
        select: { id: true },
      });
      resolvedMakeId = make.id;
    }
    if (!resolvedMakeId) throw new Error("Make is required");

    // Resolve or create CaravanModel
    let resolvedModelId = data.modelId !== "new" ? data.modelId : null;
    if (!resolvedModelId && data.newModelName) {
      const modelSlug = toSlug(
        `${data.newModelName}-${Math.random().toString(36).slice(2, 6)}`
      );
      const model = await tx.caravanModel.upsert({
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
    if (!resolvedModelId) throw new Error("Model is required");

    // Create community CaravanVariant — immediately usable by the submitter
    const variantSlug = toSlug(
      `${data.variantName}-${data.year}-${Math.random().toString(36).slice(2, 6)}`
    );

    const newVariant = await tx.caravanVariant.create({
      data: {
        modelId: resolvedModelId,
        status: "COMMUNITY",
        communitySubmitterId: userId,
        yearFrom: data.year,
        yearTo: data.year,
        isCurrentProduction: false,
        name: `${data.variantName} (Community)`,
        slug: variantSlug,
        axleConfiguration: data.axleConfiguration,
        atmKg: data.atmKg,
        gtmKg: data.gtmKg,
        tareKg: data.tareKg,
        tbmKg: data.tbmKg,
        couplingToAxleMm: data.couplingToAxleMm ? Math.round(data.couplingToAxleMm) : null,
        axleSpacingMm: data.axleSpacingMm ? Math.round(data.axleSpacingMm) : null,
        bodyLengthMm: data.bodyLengthMm ? Math.round(data.bodyLengthMm) : null,
        overallLengthMm: data.overallLengthMm ? Math.round(data.overallLengthMm) : null,
        freshWaterCapacityL: data.freshWaterLitres ? Math.round(data.freshWaterLitres) : null,
        greyWaterCapacityL: data.greyWaterLitres ? Math.round(data.greyWaterLitres) : null,
        gasBottleConfig: data.gasBottleConfig ?? null,
        market: "AU",
      },
    });

    const newSubmission = await tx.caravanSubmission.create({
      data: {
        submitterId: userId,
        status: "PENDING",
        submittedData,
        compliancePlatePhotoUrl: data.compliancePlatePhotoUrl,
        additionalPhotoUrls: data.additionalPhotoUrls,
        notes: data.notes,
        duplicateFingerprint: fingerprint,
        draftExpiresAt,
        resultingVariantId: newVariant.id,
      },
    });

    return [newSubmission, newVariant];
  });

  const photoKeys = [
    data.compliancePlatePhotoKey,
    ...data.additionalPhotoKeys,
  ].filter(Boolean) as string[];

  if (photoKeys.length > 0) {
    const job = await submissionVlmQueue.add("analyse-caravan", {
      submissionType: "caravan",
      submissionId: submission.id,
      photoKeys,
      submittedData: submittedData as Record<string, unknown>,
    });

    await prisma.caravanSubmission.update({
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
        "Caravan submitted for review. You can use it in your own calculations while it awaits approval.",
    },
    { status: 201 }
  );
}
