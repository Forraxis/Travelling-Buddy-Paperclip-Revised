import type {
  MountingLocation,
  PositionType,
  FitmentConfidence,
  FitmentSource,
} from '@prisma/client';

export interface AccessoryFitmentDto {
  id: string;
  accessoryId: string;
  vehicleVariantId: string | null;
  caravanVariantId: string | null;
  installedWeightKg: number;
  positionType: PositionType;
  cogXMm: number | null;
  cogYMm: number | null;
  startXMm: number | null;
  endXMm: number | null;
  mountingLocation: MountingLocation;
  providesMountingLocations: MountingLocation[];
  mountOffsetXMm: number | null;
  mountOffsetYMm: number | null;
  mountOffsetZMm: number | null;
  tankCapacityL: number | null;
  tankContentsKgPerL: number | null;
  confidence: FitmentConfidence;
  source: FitmentSource;
  notes: string | null;
  verifiedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccessoryFitmentInput {
  accessoryId: string;
  vehicleVariantId?: string | null;
  caravanVariantId?: string | null;
  installedWeightKg: number;
  positionType: PositionType;
  cogXMm?: number | null;
  cogYMm?: number | null;
  startXMm?: number | null;
  endXMm?: number | null;
  mountingLocation: MountingLocation;
  providesMountingLocations?: MountingLocation[];
  mountOffsetXMm?: number | null;
  mountOffsetYMm?: number | null;
  mountOffsetZMm?: number | null;
  tankCapacityL?: number | null;
  tankContentsKgPerL?: number | null;
  confidence?: FitmentConfidence;
  source?: FitmentSource;
  notes?: string | null;
  verifiedById?: string | null;
}

export interface UpdateAccessoryFitmentInput {
  vehicleVariantId?: string | null;
  caravanVariantId?: string | null;
  installedWeightKg?: number;
  positionType?: PositionType;
  cogXMm?: number | null;
  cogYMm?: number | null;
  startXMm?: number | null;
  endXMm?: number | null;
  mountingLocation?: MountingLocation;
  providesMountingLocations?: MountingLocation[];
  mountOffsetXMm?: number | null;
  mountOffsetYMm?: number | null;
  mountOffsetZMm?: number | null;
  tankCapacityL?: number | null;
  tankContentsKgPerL?: number | null;
  confidence?: FitmentConfidence;
  source?: FitmentSource;
  notes?: string | null;
  verifiedById?: string | null;
}

export interface ResolvedPositionChain {
  absoluteCogXMm: number;
  parentCogXMm: number | null;
  fitmentMountOffsetXMm: number | null;
  fitmentCogXMm: number | null;
}

export interface MountingCompatibilityResult {
  compatible: boolean;
  requiredLocation: MountingLocation;
  parentProvides: MountingLocation[];
}
