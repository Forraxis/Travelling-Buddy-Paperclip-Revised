import type {
  CaravanBodyType,
  CaravanVariantStatus,
  AxleConfiguration,
  Market,
} from '@prisma/client';
import type { PaginationOptions, PaginatedResult } from './vehicle.types';

export type { PaginationOptions, PaginatedResult };

// --- Domain types (decoupled from Prisma) ---

export interface CaravanMakeDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  countryOfOrigin: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaravanMakeWithModels extends CaravanMakeDto {
  models: CaravanModelDto[];
}

export interface CaravanModelDto {
  id: string;
  makeId: string;
  name: string;
  slug: string;
  bodyType: CaravanBodyType;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaravanModelWithMake extends CaravanModelDto {
  make: CaravanMakeDto;
}

export interface CaravanModelWithVariants extends CaravanModelDto {
  variants: CaravanVariantDto[];
}

export interface CaravanVariantDto {
  id: string;
  modelId: string;
  status: CaravanVariantStatus;
  communitySubmitterId: string | null;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  name: string;
  slug: string;
  atmKg: number | null;
  gtmKg: number | null;
  tareKg: number | null;
  tbmKg: number | null;
  axleConfiguration: AxleConfiguration;
  couplingToAxleMm: number | null;
  axleSpacingMm: number | null;
  bodyLengthMm: number | null;
  overallLengthMm: number | null;
  freshWaterCapacityL: number | null;
  greyWaterCapacityL: number | null;
  gasBottleConfig: string | null;
  market: Market;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaravanVariantWithModel extends CaravanVariantDto {
  model: CaravanModelWithMake;
}

// --- Input types ---

export interface CreateCaravanMakeInput {
  name: string;
  slug: string;
  logoUrl?: string | null;
  countryOfOrigin?: string | null;
}

export interface UpdateCaravanMakeInput {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  countryOfOrigin?: string | null;
}

export interface CreateCaravanModelInput {
  makeId: string;
  name: string;
  slug: string;
  bodyType: CaravanBodyType;
}

export interface UpdateCaravanModelInput {
  name?: string;
  slug?: string;
  bodyType?: CaravanBodyType;
}

export interface CreateCaravanVariantInput {
  modelId: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction?: boolean;
  name: string;
  slug: string;
  atmKg?: number | null;
  gtmKg?: number | null;
  tareKg?: number | null;
  tbmKg?: number | null;
  axleConfiguration: AxleConfiguration;
  couplingToAxleMm?: number | null;
  axleSpacingMm?: number | null;
  bodyLengthMm?: number | null;
  overallLengthMm?: number | null;
  freshWaterCapacityL?: number | null;
  greyWaterCapacityL?: number | null;
  gasBottleConfig?: string | null;
  market?: Market;
}

export interface UpdateCaravanVariantInput {
  yearFrom?: number;
  yearTo?: number;
  isCurrentProduction?: boolean;
  name?: string;
  slug?: string;
  atmKg?: number;
  gtmKg?: number;
  tareKg?: number;
  tbmKg?: number;
  axleConfiguration?: AxleConfiguration;
  couplingToAxleMm?: number;
  axleSpacingMm?: number | null;
  bodyLengthMm?: number;
  overallLengthMm?: number;
  freshWaterCapacityL?: number;
  greyWaterCapacityL?: number;
  gasBottleConfig?: string | null;
  market?: Market;
}

// --- Query types ---

export interface CaravanVariantFilter {
  bodyType?: CaravanBodyType;
  axleConfiguration?: AxleConfiguration;
  year?: number;
  market?: Market;
}

export interface CaravanSearchResult {
  makes: CaravanMakeDto[];
  models: CaravanModelWithMake[];
  variants: CaravanVariantWithModel[];
}
