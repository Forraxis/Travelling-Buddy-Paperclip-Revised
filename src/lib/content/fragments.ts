import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const FRAGMENTS_DIR = path.join(process.cwd(), 'src/content/fragments');

export type VehicleBodyType =
  | 'ute'
  | 'suv'
  | 'wagon'
  | 'van'
  | 'troopcarrier'
  | 'any';

export type CaravanSizeClass = 'small' | 'medium' | 'large' | 'any';

export type GvmHeadroomRange =
  | '0-100kg'
  | '0-200kg'
  | '100-300kg'
  | '200-500kg'
  | '500kg+'
  | 'any';

export type AxleConfig = 'single' | 'tandem' | 'triple' | 'any';

export interface FragmentTags {
  vehicle_body_type?: VehicleBodyType;
  caravan_size_class?: CaravanSizeClass;
  gvm_headroom_range?: GvmHeadroomRange;
  axle_config?: AxleConfig;
}

export interface ComboFragment {
  id: string;
  tags: FragmentTags;
  body: string;
}

export function loadFragments(filename: string): ComboFragment[] {
  const filePath = path.join(FRAGMENTS_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(raw) as ComboFragment[];
}

export function getAllFragmentFiles(): string[] {
  if (!fs.existsSync(FRAGMENTS_DIR)) return [];
  return fs
    .readdirSync(FRAGMENTS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
}

/**
 * Map raw catalogue values (DB enums + numbers) onto the fragment tag
 * vocabulary used to select combo-page prose. Kept separate from the page so
 * the mapping is unit-testable.
 */
export function comboFragmentCriteria(input: {
  vehicleBodyType?: string | null;
  caravanAtmKg?: number | null;
  gvmHeadroomKg?: number | null;
  axleConfiguration?: string | null;
}): Partial<FragmentTags> {
  const criteria: Partial<FragmentTags> = {};

  const body = (input.vehicleBodyType ?? '').toUpperCase();
  if (body.includes('UTE')) criteria.vehicle_body_type = 'ute';
  else if (body.includes('TROOP')) criteria.vehicle_body_type = 'troopcarrier';
  else if (body.includes('VAN')) criteria.vehicle_body_type = 'van';
  else if (body.includes('SUV')) criteria.vehicle_body_type = 'suv';
  else if (body.includes('WAGON')) criteria.vehicle_body_type = 'wagon';

  if (input.caravanAtmKg != null) {
    criteria.caravan_size_class =
      input.caravanAtmKg < 2000
        ? 'small'
        : input.caravanAtmKg < 3000
          ? 'medium'
          : 'large';
  }

  if (input.gvmHeadroomKg != null) {
    const h = input.gvmHeadroomKg;
    // Single non-overlapping bucket per value (the corpus has overlapping
    // ranges; pick the narrowest band the value falls in).
    criteria.gvm_headroom_range =
      h < 100
        ? '0-100kg'
        : h < 200
          ? '0-200kg'
          : h < 300
            ? '100-300kg'
            : h < 500
              ? '200-500kg'
              : '500kg+';
  }

  const axle = (input.axleConfiguration ?? '').toUpperCase();
  if (axle === 'SINGLE_AXLE') criteria.axle_config = 'single';
  else if (axle === 'TRIPLE_AXLE') criteria.axle_config = 'triple';
  else if (axle.startsWith('DUAL')) criteria.axle_config = 'tandem';

  return criteria;
}

/** Load every fragment file and return those matching the given criteria. */
export function getComboFragments(
  criteria: Partial<FragmentTags>,
): ComboFragment[] {
  const all = getAllFragmentFiles().flatMap(loadFragments);
  return matchFragments(all, criteria);
}

export function matchFragments(
  fragments: ComboFragment[],
  criteria: Partial<FragmentTags>,
): ComboFragment[] {
  return fragments.filter((f) => {
    const t = f.tags;
    if (
      criteria.vehicle_body_type &&
      t.vehicle_body_type &&
      t.vehicle_body_type !== 'any'
    ) {
      if (t.vehicle_body_type !== criteria.vehicle_body_type) return false;
    }
    if (
      criteria.caravan_size_class &&
      t.caravan_size_class &&
      t.caravan_size_class !== 'any'
    ) {
      if (t.caravan_size_class !== criteria.caravan_size_class) return false;
    }
    if (
      criteria.gvm_headroom_range &&
      t.gvm_headroom_range &&
      t.gvm_headroom_range !== 'any'
    ) {
      if (t.gvm_headroom_range !== criteria.gvm_headroom_range) return false;
    }
    if (criteria.axle_config && t.axle_config && t.axle_config !== 'any') {
      if (t.axle_config !== criteria.axle_config) return false;
    }
    return true;
  });
}
