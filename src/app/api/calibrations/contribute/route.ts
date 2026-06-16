import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { serverError, withRateLimit } from '@/lib/api-helpers';
import { deriveContribution } from '@/lib/physics/calibration-contribution';
import { calibrationFingerprint } from '@/lib/duplicate-detection';
import { calculate } from '@/lib/physics/engine';
import type { PhysicsInput } from '@/lib/physics/types';
import type { WeighbridgeMeasurement } from '@/lib/physics/calibration';

const measurementSchema = z.object({
  granularity: z.enum(['TOTAL', 'AXLE', 'CORNER', 'TOWBALL']),
  totalKg: z.number().nonnegative().max(50_000).optional(),
  frontAxleKg: z.number().nonnegative().max(50_000).optional(),
  rearAxleKg: z.number().nonnegative().max(50_000).optional(),
  towBallKg: z.number().nonnegative().max(50_000).optional(),
  corners: z
    .object({
      fl: z.number().nonnegative().max(50_000).optional(),
      fr: z.number().nonnegative().max(50_000).optional(),
      rl: z.number().nonnegative().max(50_000).optional(),
      rr: z.number().nonnegative().max(50_000).optional(),
    })
    .optional(),
});

// The weighed config C₀. Validated only enough to run the engine safely; the
// full PhysicsInput is stored verbatim ("store raw, derive later"). Both this and
// the snapshot are `.loose()` so the engine receives EVERY vehicle field — a
// strict object would strip gvm/limits/fuelType and the engine would read NaN.
const vehicleSchema = z
  .object({
    kerbWeightKg: z.number().positive().max(20_000),
    wheelbaseMm: z.number().positive().max(10_000),
  })
  .loose();

const snapshotSchema = z
  .object({ vehicle: vehicleSchema })
  .loose(); // keep every other PhysicsInput field untouched

const bodySchema = z.object({
  vehicleVariantId: z.string().min(1),
  measurement: measurementSchema,
  weighedSnapshot: snapshotSchema,
  source: z.string().max(120).optional(),
});

// POST — contribute one weighbridge calibration for a vehicle variant. Auth is
// optional: anonymous contributions are accepted (submitterId null) so the data
// moat keeps growing pre-sign-up. The row lands PENDING; P₀ and the derived
// signals are recomputed server-side (never trust client-sent deltas). See
// CALIBRATION_SIGNOFF.md §9 and RIG_LAYOUT.md "Phase E / P3".
export async function POST(request: Request) {
  try {
    // Anonymous write path — throttle to blunt fabricated-contribution flooding
    // (a burst of plausible near-kerb tickets could skew the weighted median a
    // moderator later bulk-approves). Moderation-gating limits the blast radius;
    // this caps the rate. (In-memory per-instance limiter — see rate-limit.ts.)
    const limited = withRateLimit(request);
    if (limited) return limited;

    const session = await auth();
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
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
    const { vehicleVariantId, source } = parsed.data;
    const measurement = parsed.data.measurement as WeighbridgeMeasurement;
    const input = parsed.data.weighedSnapshot as unknown as PhysicsInput;

    // The variant must exist — don't poison the pool with bogus IDs.
    const variant = await prisma.vehicleVariant.findUnique({
      where: { id: vehicleVariantId },
      select: { id: true },
    });
    if (!variant) {
      return NextResponse.json(
        { error: 'Unknown vehicleVariantId' },
        { status: 422 },
      );
    }

    // Recompute P₀ and the derived signals; drop the contribution if the ticket
    // is unusable or implausibly far from the model (likely a data-entry error).
    let derived;
    let prediction;
    try {
      derived = deriveContribution(input, measurement);
      prediction = calculate(input).vehicle;
    } catch {
      return NextResponse.json(
        { error: 'Could not evaluate the weighed config' },
        { status: 422 },
      );
    }
    if (!derived) {
      return NextResponse.json(
        { error: 'Ticket is unusable or implausible for this vehicle' },
        { status: 422 },
      );
    }

    // Per-contributor identity (signed-in id, else a content hash of the ticket).
    // One actor — or one re-submitted weigh-in — is a single vote per variant, so
    // a contributor can't stuff the pending pool to clear the MIN_SAMPLES gate.
    const fingerprint = calibrationFingerprint({
      submitterId: session?.user?.id ?? null,
      vehicleVariantId,
      granularity: measurement.granularity,
      measurement,
      kerbWeightKg: input.vehicle.kerbWeightKg,
    });
    // Idempotent: if this contributor already has a PENDING row for the variant,
    // treat the resubmit as a no-op success rather than growing the pool.
    const existingPending = await prisma.calibrationContribution.findFirst({
      where: {
        vehicleVariantId,
        duplicateFingerprint: fingerprint,
        status: 'PENDING',
      },
      select: { id: true },
    });
    if (existingPending) {
      return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
    }

    await prisma.calibrationContribution.create({
      data: {
        submitterId: session?.user?.id ?? null,
        vehicleVariantId,
        duplicateFingerprint: fingerprint,
        granularity: measurement.granularity,
        measurement: measurement as object,
        weighedSnapshot: input as object,
        prediction: {
          totalWeightKg: prediction.totalWeightKg,
          frontAxleKg: prediction.frontAxleKg,
          rearAxleKg: prediction.rearAxleKg,
        },
        measuredTotalKg: derived.measuredTotalKg,
        predictedTotalKg: derived.predictedTotalKg,
        residualMassKg: derived.residualMassKg,
        barenessWeight: derived.barenessWeight,
        kerbMassDeltaKg: derived.kerbMassDeltaKg,
        cogFractionDelta: derived.cogFractionDelta,
        source: source ?? 'calculator',
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
