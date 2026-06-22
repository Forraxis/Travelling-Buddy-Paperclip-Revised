import type {
  VehicleBodyType,
  FuelType,
  Market,
  SpecProvenanceStatus,
  SpecFieldConfidence,
} from '@prisma/client';

// --- Domain types (decoupled from Prisma) ---

export interface VehicleMakeDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  countryOfOrigin: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleMakeWithModels extends VehicleMakeDto {
  models: VehicleModelDto[];
}

export interface VehicleModelDto {
  id: string;
  makeId: string;
  name: string;
  slug: string;
  bodyType: VehicleBodyType;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleModelWithMake extends VehicleModelDto {
  make: VehicleMakeDto;
}

export interface VehicleModelWithVariants extends VehicleModelDto {
  variants: VehicleVariantDto[];
}

export interface VehicleVariantDto {
  id: string;
  modelId: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  name: string;
  slug: string;
  // Community-submitted variants may have null specs until moderation fills them in
  gvmKg: number | null;
  gcmKg: number | null;
  kerbWeightKg: number | null;
  maxTowingCapacityKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  wheelbaseMm: number | null;
  frontOverhangMm: number | null;
  rearOverhangMm: number | null;
  totalLengthMm: number | null;
  maxTowBallDownloadKg: number | null;
  fuelTankCapacityL: number | null;
  fuelType: FuelType | null;
  market: Market;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleVariantWithModel extends VehicleVariantDto {
  model: VehicleModelWithMake;
  /**
   * Published P3 community calibration correction for this variant, if any.
   * Folded into the live physics input via `mergeModelCorrection`. See
   * CALIBRATION_SIGNOFF.md §9.
   */
  calibrationCorrection?: {
    kerbMassDeltaKg: number | null;
    kerbMassApplied: boolean;
    cogFractionDelta: number | null;
    cogApplied: boolean;
  } | null;
  /**
   * Per-field spec provenance (one row per accepted field). Drives the verdict-
   * honesty "Est." flag in the calculator AND carries the per-field badge
   * metadata (status / confidence / citation / as-of) a later UI PR renders as a
   * confidence badge + "help us verify" CTA. Only the selected columns are
   * loaded — see `getVariantById`. Public CONFIRMED-only SEO pages do NOT use
   * this relation (see confirmed-spec.queries.ts).
   */
  specProvenance?: {
    field: string;
    value: string | null;
    status: SpecProvenanceStatus;
    confidence: SpecFieldConfidence | null;
    sourceUrl: string | null;
    asOf: Date;
  }[];
}

// --- Input types ---

export interface CreateVehicleMakeInput {
  name: string;
  slug: string;
  logoUrl?: string | null;
  countryOfOrigin?: string | null;
}

export interface UpdateVehicleMakeInput {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  countryOfOrigin?: string | null;
}

export interface CreateVehicleModelInput {
  makeId: string;
  name: string;
  slug: string;
  bodyType: VehicleBodyType;
}

export interface UpdateVehicleModelInput {
  name?: string;
  slug?: string;
  bodyType?: VehicleBodyType;
}

export interface CreateVehicleVariantInput {
  modelId: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction?: boolean;
  name: string;
  slug: string;
  gvmKg: number;
  gcmKg: number;
  kerbWeightKg: number;
  maxTowingCapacityKg: number;
  frontAxleLimitKg: number;
  rearAxleLimitKg: number;
  wheelbaseMm: number;
  frontOverhangMm?: number | null;
  rearOverhangMm?: number | null;
  totalLengthMm?: number | null;
  maxTowBallDownloadKg: number;
  fuelTankCapacityL: number;
  fuelType: FuelType;
  market?: Market;
}

export interface UpdateVehicleVariantInput {
  yearFrom?: number;
  yearTo?: number;
  isCurrentProduction?: boolean;
  name?: string;
  slug?: string;
  gvmKg?: number;
  gcmKg?: number;
  kerbWeightKg?: number;
  maxTowingCapacityKg?: number;
  frontAxleLimitKg?: number;
  rearAxleLimitKg?: number;
  wheelbaseMm?: number;
  frontOverhangMm?: number | null;
  rearOverhangMm?: number | null;
  totalLengthMm?: number | null;
  maxTowBallDownloadKg?: number;
  fuelTankCapacityL?: number;
  fuelType?: FuelType;
  market?: Market;
}

// --- Query types ---

export interface VehicleVariantFilter {
  bodyType?: VehicleBodyType;
  fuelType?: FuelType;
  year?: number;
  market?: Market;
}

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface VehicleSearchResult {
  makes: VehicleMakeDto[];
  models: VehicleModelWithMake[];
  variants: VehicleVariantWithModel[];
}
