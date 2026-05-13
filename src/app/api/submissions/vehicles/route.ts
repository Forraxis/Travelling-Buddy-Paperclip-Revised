import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submissionVlmQueue } from "@/lib/queue";
import {
  vehicleFingerprint,
  checkVehicleDuplicate,
} from "@/lib/duplicate-detection";

const VehicleSubmissionSchema = z.object({
  makeId: z.string().min(1),
  newMakeName: z.string().optional(),
  modelId: z.string().min(1),
  newModelName: z.string().optional(),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 2),
  variantName: z.string().min(1),
  bodyType: z.string().min(1),
  drivetrain: z.string().min(1),
  transmission: z.string().min(1),
  fuelType: z.string().min(1),
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
});

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

  const parsed = VehicleSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
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
            "We may already have this vehicle. Is yours different from the existing one?",
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
    drivetrain: data.drivetrain,
    transmission: data.transmission,
    fuelType: data.fuelType,
    wheelbaseMm: data.wheelbaseMm,
    frontOverhangMm: data.frontOverhangMm,
    rearOverhangMm: data.rearOverhangMm,
    totalLengthMm: data.totalLengthMm,
    fuelTankLitres: data.fuelTankLitres,
  };

  const submission = await prisma.vehicleSubmission.create({
    data: {
      submitterId: userId,
      // Immediately usable by submitter at community tier; stays PENDING for others
      status: "PENDING",
      submittedData,
      compliancePlatePhotoUrl: data.compliancePlatePhotoUrl,
      additionalPhotoUrls: data.additionalPhotoUrls,
      notes: data.notes,
      duplicateFingerprint: fingerprint,
      draftExpiresAt,
    },
  });

  // Dispatch async VLM job (Tier 2 — does not block response)
  const photoKeys = [
    data.compliancePlatePhotoKey,
    ...data.additionalPhotoKeys,
  ].filter(Boolean) as string[];

  if (photoKeys.length > 0) {
    const job = await submissionVlmQueue.add("analyse-vehicle", {
      submissionType: "vehicle",
      submissionId: submission.id,
      photoKeys,
      submittedData: submittedData as Record<string, unknown>,
    });

    await prisma.vehicleSubmission.update({
      where: { id: submission.id },
      data: { vlmJobId: job.id ?? null },
    });
  }

  return NextResponse.json(
    {
      id: submission.id,
      status: submission.status,
      message:
        "Vehicle submitted for review. You can use it in your own calculations while it awaits approval.",
    },
    { status: 201 }
  );
}
