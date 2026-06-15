export interface AccessoryItem {
  fitmentId: string;
  accessoryId: string;
  name: string;
  brandId: string;
  brandName: string;
  brandLogoUrl?: string | null;
  categoryId: string;
  categoryName: string;
  mountingLocation: string;
  installedWeightKg: number;
  /** Canonical placement (mm) — community/OEM sourced. Seeds the drag start. */
  cogXMm?: number | null;
  cogYMm?: number | null;
  /** Where this item may be mounted: VEHICLE | CARAVAN | BOTH. */
  placementScope?: 'VEHICLE' | 'CARAVAN' | 'BOTH';
  /** Real top-down image (R2) — overrides the category icon. */
  topDownImageUrl?: string | null;
}

export interface AccessoryCategory {
  id: string;
  name: string;
  slug: string;
  iconName: string | null;
  accessoryCount: number;
}

export interface AccessoryBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isPartner: boolean;
  accessoryCount: number;
}

export type AccessoryBrowseStep = 'categories' | 'brands' | 'items';

const STORAGE_KEY = 'tb_accessory_picker_recent';
const MAX_RECENT = 8;

export function readRecentAccessories(): AccessoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AccessoryItem[]) : [];
  } catch {
    return [];
  }
}

export function writeRecentAccessory(item: AccessoryItem): void {
  try {
    const existing = readRecentAccessories();
    // Deduplicate by accessoryId (same item, possibly different fitment)
    const filtered = existing.filter((a) => a.accessoryId !== item.accessoryId);
    const next = [item, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage quota exceeded — fail silently
  }
}
