export interface TowingSpeedLimits {
  urban: number;
  rural: number;
  highway: number;
  notes?: string;
  sourceUrl?: string;
}

export interface RegulatoryReference {
  title: string;
  url: string;
  notes?: string;
}

export interface RegulationData {
  gvmUpgrade: {
    maxUpgradePercent: number;
    requiresEngineerCert: boolean;
    requiresVehicleInspection: boolean;
    notes?: string;
    sourceUrl?: string;
  };
  towingLicence: {
    standardLicenceMaxGtmKg: number;
    heavyVehicleLicenceThresholdKg: number;
    notes?: string;
    sourceUrl?: string;
  };
  trailerBrakes: {
    brakesRequiredAboveGtmKg: number;
    electricBrakesRequiredAboveGtmKg: number;
    breakawaySystemRequired: boolean;
    notes?: string;
    sourceUrl?: string;
  };
  lengthLimits: {
    maxVehicleLengthM: number;
    maxTrailerLengthM: number;
    maxCombinedLengthM: number;
    notes?: string;
    sourceUrl?: string;
  };
  overhangLimits: {
    maxFrontOverhangPercent: number;
    maxRearOverhangM: number;
    notes?: string;
    sourceUrl?: string;
  };
  towingSpeedLimits: TowingSpeedLimits;
  regulatoryReferences: RegulatoryReference[];
}

export const defaultRegulationData: RegulationData = {
  gvmUpgrade: {
    maxUpgradePercent: 0,
    requiresEngineerCert: false,
    requiresVehicleInspection: false,
  },
  towingLicence: {
    standardLicenceMaxGtmKg: 0,
    heavyVehicleLicenceThresholdKg: 0,
  },
  trailerBrakes: {
    brakesRequiredAboveGtmKg: 0,
    electricBrakesRequiredAboveGtmKg: 0,
    breakawaySystemRequired: false,
  },
  lengthLimits: {
    maxVehicleLengthM: 0,
    maxTrailerLengthM: 0,
    maxCombinedLengthM: 0,
  },
  overhangLimits: {
    maxFrontOverhangPercent: 0,
    maxRearOverhangM: 0,
  },
  towingSpeedLimits: {
    urban: 0,
    rural: 0,
    highway: 0,
  },
  regulatoryReferences: [],
};

export interface RegulationSetDto {
  id: string;
  code: string;
  name: string;
  market: string;
  parentSetCode: string | null;
  currentVersionId: string | null;
  currentVersionDate: Date | null;
  currentVersionNumber: number | null;
  lastUpdatedAt: Date;
}

export interface RegulationVersionDto {
  id: string;
  setId: string;
  effectiveDate: Date;
  changeSummary: string;
  data: RegulationData;
  createdById: string;
  createdByName: string | null;
  createdAt: Date;
  versionNumber: number;
}
