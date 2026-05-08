import type { VehicleBodyType, FuelType, Market } from "@prisma/client";

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
  gvmKg: number;
  gcmKg: number;
  kerbWeightKg: number;
  maxTowingCapacityKg: number;
  frontAxleLimitKg: number;
  rearAxleLimitKg: number;
  wheelbaseMm: number;
  frontOverhangMm: number | null;
  rearOverhangMm: number | null;
  totalLengthMm: number | null;
  maxTowBallDownloadKg: number;
  fuelTankCapacityL: number;
  fuelType: FuelType;
  market: Market;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleVariantWithModel extends VehicleVariantDto {
  model: VehicleModelWithMake;
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
