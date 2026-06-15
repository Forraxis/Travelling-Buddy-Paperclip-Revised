'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/modules/admin/lib/auth';

type Result = { success: true } | { success: false; error: string };

/**
 * Set (or clear) the real top-down image for an accessory. When present it
 * overrides the category glyph in the layout editor. Upload elsewhere (R2) and
 * paste the URL here; passing an empty value clears it back to the icon.
 */
export async function setTopDownImage(
  accessoryId: string,
  url: string | null,
): Promise<Result> {
  const user = await getAdminUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  const clean = url && url.trim() ? url.trim() : null;
  if (clean && !/^https?:\/\//.test(clean)) {
    return { success: false, error: 'URL must start with http:// or https://' };
  }
  try {
    await prisma.accessory.update({
      where: { id: accessoryId },
      data: { topDownImageUrl: clean },
    });
    revalidatePath('/admin/catalogue/top-down-images');
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed' };
  }
}
