'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { createBrandService } from '../services/brand.service';
import { createCategoryService } from '../services/category.service';
import { createAccessoryService } from '../services/accessory.service';
import { createFitmentService } from '../services/fitment.service';
import { getAdminUser } from '@/modules/admin/lib/auth';
import type {
  CreateAccessoryBrandInput,
  UpdateAccessoryBrandInput,
} from '../types/accessory-brand.types';
import type {
  CreateAccessoryCategoryInput,
  UpdateAccessoryCategoryInput,
} from '../types/accessory-category.types';
import type {
  CreateAccessoryInput,
  UpdateAccessoryInput,
} from '../types/accessory.types';
import type {
  CreateAccessoryFitmentInput,
  UpdateAccessoryFitmentInput,
} from '../types/fitment.types';

const brandService = createBrandService(prisma);
const categoryService = createCategoryService(prisma);
const accessoryService = createAccessoryService(prisma);
const fitmentService = createFitmentService(prisma);

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function writeAuditLog(
  entityType: string,
  entityId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  changedBy: string,
  changes: object,
) {
  await prisma.auditLog.create({
    data: {
      entityType,
      entityId,
      action,
      changedBy,
      changes: JSON.parse(JSON.stringify(changes)),
    },
  });
}

// ── Brands ──────────────────────────────────────────────────────────

export async function listBrandsAction(cursor?: string, search?: string) {
  if (search) {
    const result = await brandService.search(search, 50);
    return { items: result.brands, nextCursor: null, hasMore: false };
  }
  return brandService.list({}, { cursor, limit: 25 });
}

export async function getBrandByIdAction(id: string) {
  return brandService.getById(id);
}

export async function createBrandAction(
  input: Omit<CreateAccessoryBrandInput, 'slug'>,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const slug = slugify(input.name);
    const brand = await brandService.create({ ...input, slug });
    await writeAuditLog('AccessoryBrand', brand.id, 'CREATE', user.id, {
      ...input,
      slug,
    });
    revalidatePath('/admin/catalogue/brands');
    return { success: true, data: brand };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function updateBrandAction(
  id: string,
  input: UpdateAccessoryBrandInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const brand = await brandService.update(id, input);
    await writeAuditLog('AccessoryBrand', id, 'UPDATE', user.id, input);
    revalidatePath('/admin/catalogue/brands');
    return { success: true, data: brand };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function deleteBrandAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    await brandService.remove(id);
    await writeAuditLog('AccessoryBrand', id, 'DELETE', user.id, {});
    revalidatePath('/admin/catalogue/brands');
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ── Categories ──────────────────────────────────────────────────────

export async function listCategoriesAction(cursor?: string, search?: string) {
  if (search) {
    const result = await categoryService.search(search, 50);
    return { items: result.categories, nextCursor: null, hasMore: false };
  }
  return categoryService.list({}, { cursor, limit: 25 });
}

export async function getCategoryByIdAction(id: string) {
  return categoryService.getById(id);
}

export async function listCategoryTreeAction() {
  return categoryService.listHierarchy();
}

export async function createCategoryAction(
  input: Omit<CreateAccessoryCategoryInput, 'slug'>,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const slug = slugify(input.name);
    const category = await categoryService.create({ ...input, slug });
    await writeAuditLog('AccessoryCategory', category.id, 'CREATE', user.id, {
      ...input,
      slug,
    });
    revalidatePath('/admin/catalogue/categories');
    return { success: true, data: category };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function updateCategoryAction(
  id: string,
  input: UpdateAccessoryCategoryInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const category = await categoryService.update(id, input);
    await writeAuditLog('AccessoryCategory', id, 'UPDATE', user.id, input);
    revalidatePath('/admin/catalogue/categories');
    revalidatePath(`/admin/catalogue/categories/${id}`);
    return { success: true, data: category };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    await categoryService.remove(id);
    await writeAuditLog('AccessoryCategory', id, 'DELETE', user.id, {});
    revalidatePath('/admin/catalogue/categories');
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ── Accessories ──────────────────────────────────────────────────────

export async function listAccessoriesAction(
  cursor?: string,
  search?: string,
  brandId?: string,
  categoryId?: string,
) {
  if (search) {
    const result = await accessoryService.search(search, 50);
    return { items: result.accessories, nextCursor: null, hasMore: false };
  }
  return accessoryService.list({ brandId, categoryId }, { cursor, limit: 25 });
}

export async function getAccessoryByIdAction(id: string) {
  return accessoryService.getById(id);
}

export async function createAccessoryAction(
  input: Omit<CreateAccessoryInput, 'slug'>,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const slug = slugify(input.name);
    const accessory = await accessoryService.create({ ...input, slug });
    await writeAuditLog('Accessory', accessory.id, 'CREATE', user.id, {
      ...input,
      slug,
    });
    revalidatePath('/admin/catalogue/accessories');
    return { success: true, data: accessory };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function updateAccessoryAction(
  id: string,
  input: UpdateAccessoryInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const accessory = await accessoryService.update(id, input);
    await writeAuditLog('Accessory', id, 'UPDATE', user.id, input);
    revalidatePath('/admin/catalogue/accessories');
    revalidatePath(`/admin/catalogue/accessories/${id}`);
    return { success: true, data: accessory };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function deleteAccessoryAction(id: string): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    await accessoryService.remove(id);
    await writeAuditLog('Accessory', id, 'DELETE', user.id, {});
    revalidatePath('/admin/catalogue/accessories');
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// ── Fitments ──────────────────────────────────────────────────────────

export async function listFitmentsForAccessoryAction(accessoryId: string) {
  return fitmentService.getFitmentsForAccessory(accessoryId);
}

export async function getFitmentByIdAction(id: string) {
  return fitmentService.getById(id);
}

export async function createFitmentAction(
  input: CreateAccessoryFitmentInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const fitment = await fitmentService.create(input);
    await writeAuditLog(
      'AccessoryFitment',
      fitment.id,
      'CREATE',
      user.id,
      input,
    );
    revalidatePath(
      `/admin/catalogue/accessories/${input.accessoryId}/fitments`,
    );
    return { success: true, data: fitment };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function updateFitmentAction(
  id: string,
  accessoryId: string,
  input: UpdateAccessoryFitmentInput,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    const fitment = await fitmentService.update(id, input);
    await writeAuditLog('AccessoryFitment', id, 'UPDATE', user.id, input);
    revalidatePath(`/admin/catalogue/accessories/${accessoryId}/fitments`);
    return { success: true, data: fitment };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function deleteFitmentAction(
  id: string,
  accessoryId: string,
): Promise<ActionResult> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  try {
    await fitmentService.remove(id);
    await writeAuditLog('AccessoryFitment', id, 'DELETE', user.id, {});
    revalidatePath(`/admin/catalogue/accessories/${accessoryId}/fitments`);
    return { success: true, data: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
