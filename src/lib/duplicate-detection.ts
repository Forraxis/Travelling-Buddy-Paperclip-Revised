import { createHash } from 'crypto';
import { prisma } from '@/lib/db';

function normalise(val: unknown): string {
  return String(val ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// More aggressive normalisation: strips all non-alphanumeric characters.
// Catches "LandCruiser" vs "Land Cruiser", "Jayco Journey" vs "jayco journey", etc.
function normaliseStrict(val: unknown): string {
  return String(val ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function vehicleFingerprint(data: {
  makeId: string;
  modelId: string;
  year: number;
  bodyType: string;
  drivetrain: string;
  transmission: string;
}): string {
  const key = [
    data.makeId,
    data.modelId,
    data.year,
    normalise(data.bodyType),
    normalise(data.drivetrain),
    normalise(data.transmission),
  ].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function caravanFingerprint(data: {
  makeId: string;
  modelId: string;
  year: number;
  bodyType: string;
  axleConfiguration: string;
}): string {
  const key = [
    data.makeId,
    data.modelId,
    data.year,
    normalise(data.bodyType),
    normalise(data.axleConfiguration),
  ].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export function accessoryFingerprint(data: {
  brandName: string;
  modelName: string;
}): string {
  const key = [normalise(data.brandName), normalise(data.modelName)].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

// Round a ticket value to the nearest kg so trivially-different re-keys of the
// same weigh-in collapse to one fingerprint. null/undefined → '' (stable).
function roundKg(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '';
}

/**
 * Identity fingerprint for one P3 calibration contribution (per variant).
 *
 * A signed-in contributor is one vote per variant — keyed on `submitterId`, so
 * five weigh-ins from the same account collapse to a single vote and can't clear
 * the MIN_SAMPLES gate alone. An anonymous contribution falls back to a content
 * hash of the (rounded) ticket, so an identical weigh-in re-submitted (double
 * click, replay) also collapses to one vote. Variant is folded in so the same
 * user/ticket still contributes independently to different vehicles.
 */
export function calibrationFingerprint(data: {
  submitterId: string | null | undefined;
  vehicleVariantId: string;
  granularity: string;
  measurement: {
    totalKg?: number;
    frontAxleKg?: number;
    rearAxleKg?: number;
    towBallKg?: number;
    corners?: { fl?: number; fr?: number; rl?: number; rr?: number };
  };
  kerbWeightKg: number;
}): string {
  const identity = data.submitterId
    ? `user:${data.submitterId}`
    : [
        'anon',
        normalise(data.granularity),
        roundKg(data.measurement.totalKg),
        roundKg(data.measurement.frontAxleKg),
        roundKg(data.measurement.rearAxleKg),
        roundKg(data.measurement.towBallKg),
        roundKg(data.measurement.corners?.fl),
        roundKg(data.measurement.corners?.fr),
        roundKg(data.measurement.corners?.rl),
        roundKg(data.measurement.corners?.rr),
        roundKg(data.kerbWeightKg),
      ].join(',');
  const key = [data.vehicleVariantId, identity].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  existingId: string | null;
  existingName: string | null;
}

export interface DuplicateMatch {
  id: string;
  name: string;
  kind: 'canonical' | 'community';
  url: string;
}

export interface DuplicateCheckResponse {
  hasDuplicate: boolean;
  matches: DuplicateMatch[];
}

export async function checkVehicleDuplicate(
  fingerprint: string,
): Promise<DuplicateCheckResult> {
  // Check against existing approved variants first
  const variant = await prisma.vehicleVariant.findFirst({
    where: { slug: { contains: fingerprint } },
    select: { id: true, name: true },
  });
  if (variant) {
    return {
      hasDuplicate: true,
      existingId: variant.id,
      existingName: variant.name,
    };
  }

  // Then check pending submissions with the same fingerprint
  const pending = await prisma.vehicleSubmission.findFirst({
    where: {
      duplicateFingerprint: fingerprint,
      status: { in: ['PENDING', 'APPROVED'] },
    },
    select: { id: true },
  });
  if (pending) {
    return {
      hasDuplicate: true,
      existingId: pending.id,
      existingName: 'existing submission',
    };
  }

  return { hasDuplicate: false, existingId: null, existingName: null };
}

export async function checkCaravanDuplicate(
  fingerprint: string,
): Promise<DuplicateCheckResult> {
  const pending = await prisma.caravanSubmission.findFirst({
    where: {
      duplicateFingerprint: fingerprint,
      status: { in: ['PENDING', 'APPROVED'] },
    },
    select: { id: true },
  });
  if (pending) {
    return {
      hasDuplicate: true,
      existingId: pending.id,
      existingName: 'existing submission',
    };
  }
  return { hasDuplicate: false, existingId: null, existingName: null };
}

export async function checkAccessoryDuplicate(
  fingerprint: string,
): Promise<DuplicateCheckResult> {
  const existing = await prisma.accessorySubmission.findFirst({
    where: {
      duplicateFingerprint: fingerprint,
      status: { in: ['PENDING', 'APPROVED'] },
    },
    select: { id: true },
  });
  if (existing) {
    return {
      hasDuplicate: true,
      existingId: existing.id,
      existingName: 'existing submission',
    };
  }
  return { hasDuplicate: false, existingId: null, existingName: null };
}

// Text-based mid-flow duplicate checks for the check-duplicate API endpoint.
// These run before submission using normalised name matching so the user
// sees a warning while still filling in the form.

export async function checkVehicleDuplicateByText(params: {
  makeName: string;
  modelName: string;
  year: number;
}): Promise<DuplicateCheckResponse> {
  const makeNorm = normaliseStrict(params.makeName);
  const modelNorm = normaliseStrict(params.modelName);

  const matches: DuplicateMatch[] = [];

  // Canonical: find VehicleVariants where make+model name matches and year is in range
  const variants = await prisma.vehicleVariant.findMany({
    where: {
      yearFrom: { lte: params.year },
      yearTo: { gte: params.year },
      status: 'CATALOGUE',
    },
    select: {
      id: true,
      name: true,
      model: {
        select: {
          name: true,
          slug: true,
          make: { select: { name: true, slug: true } },
        },
      },
    },
  });

  for (const v of variants) {
    if (
      normaliseStrict(v.model.make.name) === makeNorm &&
      normaliseStrict(v.model.name) === modelNorm
    ) {
      matches.push({
        id: v.id,
        name: `${v.model.make.name} ${v.model.name} ${params.year} — ${v.name}`,
        kind: 'canonical',
        url: `/vehicles/${v.model.make.slug}/${v.model.slug}`,
      });
    }
  }

  // Community: pending/approved submissions with matching names
  const communitySubmissions = await prisma.vehicleSubmission.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] } },
    select: {
      id: true,
      submittedData: true,
    },
  });

  for (const s of communitySubmissions) {
    const data = s.submittedData as Record<string, unknown>;
    const submittedMake = String(data.newMakeName ?? data.makeId ?? '');
    const submittedModel = String(data.newModelName ?? data.modelId ?? '');
    const submittedYear = Number(data.year ?? 0);
    if (
      normaliseStrict(submittedMake) === makeNorm &&
      normaliseStrict(submittedModel) === modelNorm &&
      submittedYear === params.year
    ) {
      matches.push({
        id: s.id,
        name: `${submittedMake} ${submittedModel} ${params.year} (community submission)`,
        kind: 'community',
        url: `/account/submissions`,
      });
    }
  }

  return { hasDuplicate: matches.length > 0, matches };
}

export async function checkCaravanDuplicateByText(params: {
  makeName: string;
  modelName: string;
  year: number;
}): Promise<DuplicateCheckResponse> {
  const makeNorm = normaliseStrict(params.makeName);
  const modelNorm = normaliseStrict(params.modelName);

  const matches: DuplicateMatch[] = [];

  // Canonical: CaravanVariants
  const variants = await prisma.caravanVariant.findMany({
    where: {
      yearFrom: { lte: params.year },
      yearTo: { gte: params.year },
      status: 'CATALOGUE',
    },
    select: {
      id: true,
      name: true,
      model: {
        select: {
          name: true,
          slug: true,
          make: { select: { name: true, slug: true } },
        },
      },
    },
  });

  for (const v of variants) {
    if (
      normaliseStrict(v.model.make.name) === makeNorm &&
      normaliseStrict(v.model.name) === modelNorm
    ) {
      matches.push({
        id: v.id,
        name: `${v.model.make.name} ${v.model.name} ${params.year} — ${v.name}`,
        kind: 'canonical',
        url: `/caravans/${v.model.make.slug}/${v.model.slug}`,
      });
    }
  }

  // Community: pending caravan submissions
  const communitySubmissions = await prisma.caravanSubmission.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] } },
    select: { id: true, submittedData: true },
  });

  for (const s of communitySubmissions) {
    const data = s.submittedData as Record<string, unknown>;
    const submittedMake = String(data.newMakeName ?? data.makeId ?? '');
    const submittedModel = String(data.newModelName ?? data.modelId ?? '');
    const submittedYear = Number(data.year ?? 0);
    if (
      normaliseStrict(submittedMake) === makeNorm &&
      normaliseStrict(submittedModel) === modelNorm &&
      submittedYear === params.year
    ) {
      matches.push({
        id: s.id,
        name: `${submittedMake} ${submittedModel} ${params.year} (community submission)`,
        kind: 'community',
        url: `/account/submissions`,
      });
    }
  }

  return { hasDuplicate: matches.length > 0, matches };
}

export async function checkAccessoryDuplicateByText(params: {
  brandName: string;
  modelName: string;
}): Promise<DuplicateCheckResponse> {
  const brandNorm = normaliseStrict(params.brandName);
  const modelNorm = normaliseStrict(params.modelName);

  const matches: DuplicateMatch[] = [];

  // Canonical: Accessories in the catalogue
  const accessories = await prisma.accessory.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      brand: { select: { name: true, slug: true } },
    },
  });

  for (const a of accessories) {
    if (
      normaliseStrict(a.brand?.name ?? '') === brandNorm &&
      normaliseStrict(a.name) === modelNorm
    ) {
      matches.push({
        id: a.id,
        name: `${a.brand?.name} ${a.name}`,
        kind: 'canonical',
        url: `/accessories/${a.brand?.slug}/${a.slug}`,
      });
    }
  }

  // Community: pending accessory submissions
  const communitySubmissions = await prisma.accessorySubmission.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] } },
    select: { id: true, submittedData: true },
  });

  for (const s of communitySubmissions) {
    const data = s.submittedData as Record<string, unknown>;
    const submittedBrand = String(data.brandName ?? '');
    const submittedModel = String(data.modelName ?? '');
    if (
      normaliseStrict(submittedBrand) === brandNorm &&
      normaliseStrict(submittedModel) === modelNorm
    ) {
      matches.push({
        id: s.id,
        name: `${submittedBrand} ${submittedModel} (community submission)`,
        kind: 'community',
        url: `/account/submissions`,
      });
    }
  }

  return { hasDuplicate: matches.length > 0, matches };
}
