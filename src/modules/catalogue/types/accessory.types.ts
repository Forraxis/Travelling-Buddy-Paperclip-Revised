import type { AccessoryStatus, Market } from "@prisma/client";
import type { AccessoryFitmentDto } from "./fitment.types";

export interface AccessoryDto {
  id: string;
  brandId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrls: string[];
  priceMin: number | null;
  priceMax: number | null;
  currencyCode: string;
  affiliateUrl: string | null;
  status: AccessoryStatus;
  market: Market;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccessoryInput {
  brandId: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrls?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  currencyCode?: string;
  affiliateUrl?: string | null;
  status?: AccessoryStatus;
  market?: Market;
}

export interface UpdateAccessoryInput {
  brandId?: string;
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  imageUrls?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  currencyCode?: string;
  affiliateUrl?: string | null;
  status?: AccessoryStatus;
  market?: Market;
}

export interface AccessoryFilter {
  brandId?: string;
  categoryId?: string;
  status?: AccessoryStatus;
  market?: Market;
  vehicleVariantId?: string;
  caravanVariantId?: string;
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

export interface AccessorySearchResult {
  accessories: AccessoryDto[];
}

export interface AccessoryDetailDto extends AccessoryDto {
  brand: { id: string; name: string; slug: string; logoUrl: string | null };
  category: { id: string; name: string; slug: string; description: string | null };
  fitments: AccessoryFitmentDto[];
}
