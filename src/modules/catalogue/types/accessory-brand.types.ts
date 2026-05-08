import type { BrandStatus } from "@prisma/client";

export interface AccessoryBrandDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  status: BrandStatus;
  isPartner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccessoryBrandInput {
  name: string;
  slug: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  status?: BrandStatus;
  isPartner?: boolean;
}

export interface UpdateAccessoryBrandInput {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  status?: BrandStatus;
  isPartner?: boolean;
}

export interface AccessoryBrandFilter {
  status?: BrandStatus;
  isPartner?: boolean;
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

export interface AccessoryBrandSearchResult {
  brands: AccessoryBrandDto[];
}
