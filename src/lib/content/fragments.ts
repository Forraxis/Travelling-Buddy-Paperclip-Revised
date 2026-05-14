import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const FRAGMENTS_DIR = path.join(process.cwd(), "src/content/fragments");

export type VehicleBodyType =
  | "ute"
  | "suv"
  | "wagon"
  | "van"
  | "troopcarrier"
  | "any";

export type CaravanSizeClass = "small" | "medium" | "large" | "any";

export type GvmHeadroomRange =
  | "0-100kg"
  | "0-200kg"
  | "100-300kg"
  | "200-500kg"
  | "500kg+"
  | "any";

export type AxleConfig = "single" | "tandem" | "triple" | "any";

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
  const raw = fs.readFileSync(filePath, "utf-8");
  return yaml.load(raw) as ComboFragment[];
}

export function getAllFragmentFiles(): string[] {
  if (!fs.existsSync(FRAGMENTS_DIR)) return [];
  return fs.readdirSync(FRAGMENTS_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
}

export function matchFragments(
  fragments: ComboFragment[],
  criteria: Partial<FragmentTags>
): ComboFragment[] {
  return fragments.filter((f) => {
    const t = f.tags;
    if (criteria.vehicle_body_type && t.vehicle_body_type && t.vehicle_body_type !== "any") {
      if (t.vehicle_body_type !== criteria.vehicle_body_type) return false;
    }
    if (criteria.caravan_size_class && t.caravan_size_class && t.caravan_size_class !== "any") {
      if (t.caravan_size_class !== criteria.caravan_size_class) return false;
    }
    if (criteria.gvm_headroom_range && t.gvm_headroom_range && t.gvm_headroom_range !== "any") {
      if (t.gvm_headroom_range !== criteria.gvm_headroom_range) return false;
    }
    if (criteria.axle_config && t.axle_config && t.axle_config !== "any") {
      if (t.axle_config !== criteria.axle_config) return false;
    }
    return true;
  });
}
