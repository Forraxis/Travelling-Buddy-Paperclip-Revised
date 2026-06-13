import type { MetadataRoute } from 'next';
import {
  getAllVehicleVariantSlugsForSSG,
  getAllVehicleModelSlugsForSSG,
} from '@/modules/catalogue/queries/vehicle-profile.queries';
import {
  getAllCaravanVariantSlugsForSSG,
  getAllCaravanModelSlugsForSSG,
} from '@/modules/catalogue/queries/caravan-profile.queries';
import { getAllComboSlugsForSSG } from '@/modules/catalogue/queries/combo.queries';
import { getAllActiveAccessorySlugsForSSG } from '@/modules/catalogue/queries/accessory-profile.queries';
import { getAllTouringRigSlugsForSSG } from '@/modules/catalogue/queries/touring-rig.queries';
import { getAllVehicleAccessoryComboPairsForSSG } from '@/modules/catalogue/queries/vehicle-accessory-combo.queries';
import { getAllGuideSlugs } from '@/lib/content/guides';
import { getAllStateGuidanceParams } from '@/lib/content/state-guidance';

// Regenerate at most daily (spec §9.7: sitemaps generated daily from the DB).
export const revalidate = 86400;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travellingbuddy.com.au';

type Entry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const u = (path: string): string => `${BASE_URL}${path}`;
  const entry = (
    path: string,
    priority: number,
    changeFrequency: Entry['changeFrequency'] = 'weekly',
  ): Entry => ({ url: u(path), lastModified: now, changeFrequency, priority });

  const [
    vehicleVariants,
    vehicleModels,
    caravanVariants,
    caravanModels,
    combos,
    accessories,
    touringRigs,
    vehicleAccessoryCombos,
  ] = await Promise.all([
    getAllVehicleVariantSlugsForSSG(),
    getAllVehicleModelSlugsForSSG(),
    getAllCaravanVariantSlugsForSSG(),
    getAllCaravanModelSlugsForSSG(),
    getAllComboSlugsForSSG(),
    getAllActiveAccessorySlugsForSSG(),
    getAllTouringRigSlugsForSSG(),
    getAllVehicleAccessoryComboPairsForSSG(),
  ]);

  // Static, known-good landing pages.
  const staticEntries: Entry[] = [
    entry('/', 1.0, 'weekly'),
    entry('/calculator', 1.0, 'weekly'),
    entry('/accessories', 0.6, 'weekly'),
    entry('/catalogue/vehicles', 0.6, 'weekly'),
    entry('/catalogue/caravans', 0.6, 'weekly'),
  ];

  // Combo pages are the headliner SEO content (highest priority after landing).
  const comboEntries = combos.map((c) =>
    entry(`/can-a/${c.vehicle}/tow/${c.caravan}/`, 0.8, 'monthly'),
  );

  const vehicleVariantEntries = vehicleVariants.map((v) =>
    entry(`/vehicles/${v.make}/${v.model}/${v.variant}/`, 0.7, 'monthly'),
  );
  const vehicleModelEntries = vehicleModels.map((v) =>
    entry(`/vehicles/${v.make}/${v.model}/`, 0.6, 'monthly'),
  );
  const caravanVariantEntries = caravanVariants.map((c) =>
    entry(`/caravans/${c.make}/${c.model}/${c.variant}/`, 0.7, 'monthly'),
  );
  const caravanModelEntries = caravanModels.map((c) =>
    entry(`/caravans/${c.make}/${c.model}/`, 0.6, 'monthly'),
  );

  // Accessory profile pages + their (derived) brand pages.
  const accessoryEntries = accessories.map((a) =>
    entry(`/accessories/${a.brand}/${a.accessory}/`, 0.6, 'monthly'),
  );
  const brandEntries = Array.from(new Set(accessories.map((a) => a.brand))).map(
    (brand) => entry(`/accessories/${brand}/`, 0.5, 'monthly'),
  );

  const touringEntries = touringRigs.map((t) =>
    entry(`/touring-setups/${t.vehicle}/`, 0.6, 'monthly'),
  );
  const vehicleAccessoryEntries = vehicleAccessoryCombos.map((p) =>
    entry(`/setups/${p.vehicle}/with/${p.category}/`, 0.6, 'monthly'),
  );

  // File-based editorial content.
  const guideEntries = getAllGuideSlugs().map((slug) =>
    entry(`/guides/${slug}/`, 0.5, 'monthly'),
  );
  const stateEntries = getAllStateGuidanceParams().map((p) =>
    entry(`/${p.stateCode}/${p.topic}/`, 0.5, 'monthly'),
  );

  return [
    ...staticEntries,
    ...comboEntries,
    ...vehicleVariantEntries,
    ...vehicleModelEntries,
    ...caravanVariantEntries,
    ...caravanModelEntries,
    ...accessoryEntries,
    ...brandEntries,
    ...touringEntries,
    ...vehicleAccessoryEntries,
    ...guideEntries,
    ...stateEntries,
  ];
}
