export interface AccessoryCategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  displayOrder: number;
  iconName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessoryCategoryWithParent extends AccessoryCategoryDto {
  parent: AccessoryCategoryDto | null;
}

export interface AccessoryCategoryWithChildren extends AccessoryCategoryDto {
  children: AccessoryCategoryDto[];
}

export interface AccessoryCategoryTree extends AccessoryCategoryDto {
  children: AccessoryCategoryTree[];
}

export interface CreateAccessoryCategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  displayOrder?: number;
  iconName?: string | null;
}

export interface UpdateAccessoryCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  displayOrder?: number;
  iconName?: string | null;
}

export interface AccessoryCategoryFilter {
  parentId?: string | null;
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

export interface AccessoryCategorySearchResult {
  categories: AccessoryCategoryDto[];
}
