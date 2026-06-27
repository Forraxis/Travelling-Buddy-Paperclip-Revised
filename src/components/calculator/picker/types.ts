export type EntityType = 'vehicle' | 'caravan';

export interface PickerMake {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
}

export interface PickerModel {
  id: string;
  makeId: string;
  name: string;
  slug: string;
  bodyType: string;
}

export interface PickerVariant {
  id: string;
  name: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  entityType: EntityType;
  makeId: string;
  makeName: string;
  makeLogoUrl?: string | null;
  modelId: string;
  modelName: string;
  bodyType?: string;
  confidenceBadge?:
    | 'verified'
    | 'manufacturer_spec'
    | 'community'
    | 'estimated';
  // Vehicle-specific
  gvmKg?: number;
  gcmKg?: number;
  kerbWeightKg?: number;
  maxTowingCapacityKg?: number;
  fuelType?: string;
  // Vehicle granularity facets
  generation?: string | null;
  cabType?: string | null;
  driveType?: string | null;
  badge?: string | null;
  transmission?: string | null;
  buildOrigin?: string | null; // ISO-3166 alpha-2 country of manufacture
  // Caravan-specific
  atmKg?: number;
  gtmKg?: number;
  tbmKg?: number;
  axleConfiguration?: string;
  freshWaterCapacityL?: number;
  greyWaterCapacityL?: number;
  bodyLengthMm?: number | null;
  // Caravan granularity facets
  floorplan?: string | null;
  berths?: number | null;
}

export type BrowseStep = 'makes' | 'models' | 'variants';

export interface BrowseState {
  step: BrowseStep;
  make?: PickerMake;
  model?: PickerModel;
}

export interface VariantFilters {
  bodyType?: string;
  fuelType?: string;
  axleConfiguration?: string;
  // Vehicle granularity facets
  generation?: string;
  cabType?: string;
  driveType?: string;
  badge?: string;
  buildOrigin?: string;
  // Caravan granularity facets
  floorplan?: string;
  berths?: number;
  lengthFt?: number;
}

export interface PickerConfig {
  entityType: EntityType;
  label: string;
  apiBase: string;
  submitLabel: string;
  popularMakeNames: readonly string[];
}

export const VEHICLE_CONFIG: PickerConfig = {
  entityType: 'vehicle',
  label: 'vehicle',
  apiBase: '/api/picker/vehicles',
  submitLabel: 'Submit vehicle',
  popularMakeNames: [
    'Toyota',
    'Ford',
    'Isuzu',
    'Nissan',
    'Mitsubishi',
    'Land Rover',
    'Jeep',
    'GWM',
  ],
} as const;

export const CARAVAN_CONFIG: PickerConfig = {
  entityType: 'caravan',
  label: 'caravan or trailer',
  apiBase: '/api/picker/caravans',
  submitLabel: 'Submit caravan',
  popularMakeNames: [
    'Jayco',
    'Coromal',
    'Roadstar',
    'Avan',
    'Concept',
    'Jurgen',
    'Lotus',
    'Royal Flair',
  ],
} as const;

// API response shapes (matching existing route handlers)
export interface PaginatedApiResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface VehicleSearchApiResult {
  makes: { id: string; name: string; slug: string; logoUrl: string | null }[];
  models: {
    id: string;
    makeId: string;
    name: string;
    slug: string;
    bodyType: string;
    make: { id: string; name: string; slug: string; logoUrl: string | null };
  }[];
  variants: {
    id: string;
    modelId: string;
    name: string;
    slug: string;
    yearFrom: number;
    yearTo: number;
    isCurrentProduction: boolean;
    gvmKg: number;
    gcmKg: number;
    kerbWeightKg: number;
    maxTowingCapacityKg: number;
    fuelType: string;
    model: {
      id: string;
      name: string;
      slug: string;
      bodyType: string;
      make: { id: string; name: string; slug: string; logoUrl: string | null };
    };
  }[];
}

export interface CaravanSearchApiResult {
  makes: { id: string; name: string; slug: string; logoUrl: string | null }[];
  models: {
    id: string;
    makeId: string;
    name: string;
    slug: string;
    bodyType: string;
    make: { id: string; name: string; slug: string; logoUrl: string | null };
  }[];
  variants: {
    id: string;
    modelId: string;
    name: string;
    slug: string;
    yearFrom: number;
    yearTo: number;
    isCurrentProduction: boolean;
    atmKg: number;
    gtmKg: number;
    tbmKg: number;
    axleConfiguration: string;
    model: {
      id: string;
      name: string;
      slug: string;
      bodyType: string;
      make: { id: string; name: string; slug: string; logoUrl: string | null };
    };
  }[];
}
