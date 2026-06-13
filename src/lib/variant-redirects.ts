import { prisma } from '@/lib/db';

export type VariantEntityType = 'VehicleVariant' | 'CaravanVariant';

/**
 * Resolve a (possibly chained) variant slug redirect.
 *
 * When a variant's `year_to` advances or production closes, its slug
 * regenerates and a {@link VariantSlugRedirect} row (`fromSlug` → `toSlug`) is
 * written (see vehicle/caravan admin actions). This follows the chain from the
 * requested slug to the final current slug so a single old URL never produces a
 * multi-hop redirect.
 *
 * Returns the final `toSlug`, or null if the slug has no redirect (genuine 404).
 * Used by the variant profile pages to issue a permanent (308) redirect before
 * falling through to notFound(). 308 is treated as equivalent to 301 by search
 * engines; a true 301 would require DB access in middleware, which the edge
 * proxy can't do with the Postgres adapter.
 */
export async function resolveVariantRedirect(
  entityType: VariantEntityType,
  fromSlug: string,
): Promise<string | null> {
  let current = fromSlug;
  let resolved: string | null = null;

  // Cap hops to avoid an accidental cycle pinning the request.
  for (let i = 0; i < 5; i++) {
    const row = await prisma.variantSlugRedirect.findFirst({
      where: { entityType, fromSlug: current },
      orderBy: { createdAt: 'desc' },
      select: { toSlug: true },
    });
    if (!row || row.toSlug === current) break;
    resolved = row.toSlug;
    current = row.toSlug;
  }

  return resolved;
}
