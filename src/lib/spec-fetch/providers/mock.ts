/**
 * The mock provider — drives ALL tests + the admin UI tonight. No network, no
 * model. Returns the worked LandCruiser example from the design doc, which is
 * deliberately shaped to exercise the gate:
 *  - GVM/GCM/towing/tow-ball are HIGH + authoritatively sourced,
 *  - front/rear axle limits are LOW + only vendor-sourced (the exact field that
 *    should route to plate/admin and BLOCK promotion uncorroborated),
 *  - geometry/kerb are MEDIUM "estimated".
 *
 * It pattern-matches the requested make/model loosely so an admin can demo with
 * the LandCruiser; any other vehicle returns the same shape with nulled values
 * (so "null-not-guess" is visible for unknown vehicles).
 */
import { PROMPT_VERSION } from '../prompt';
import type {
  FetchedField,
  SpecFetchInput,
  SpecFetchProvider,
  SpecFetchResult,
} from '../types';

const REDBOOK = 'https://www.redbook.com.au/';
const VENDOR = 'https://www.example-4x4-gvm-upgrades.com.au/landcruiser-100';

const LANDCRUISER_FIELDS: FetchedField[] = [
  { field: 'gvmKg', value: '3260', confidence: 'HIGH', sourceUrl: REDBOOK },
  { field: 'gcmKg', value: '6760', confidence: 'HIGH', sourceUrl: REDBOOK },
  // The hard-to-source fields: only 4x4 GVM-upgrade vendor pages → LOW.
  {
    field: 'frontAxleLimitKg',
    value: '1480',
    confidence: 'LOW',
    sourceUrl: VENDOR,
  },
  {
    field: 'rearAxleLimitKg',
    value: '1900',
    confidence: 'LOW',
    sourceUrl: VENDOR,
  },
  {
    field: 'maxTowingCapacityKg',
    value: '3500',
    confidence: 'HIGH',
    sourceUrl: REDBOOK,
  },
  {
    field: 'maxTowBallDownloadKg',
    value: '350',
    confidence: 'HIGH',
    sourceUrl: REDBOOK,
  },
  {
    field: 'kerbWeightKg',
    value: '2510',
    confidence: 'MEDIUM',
    sourceUrl: REDBOOK,
  },
  {
    field: 'wheelbaseMm',
    value: '2850',
    confidence: 'MEDIUM',
    sourceUrl: REDBOOK,
  },
  {
    field: 'frontOverhangMm',
    value: '900',
    confidence: 'LOW',
    sourceUrl: null,
  },
  {
    field: 'rearOverhangMm',
    value: '1130',
    confidence: 'LOW',
    sourceUrl: null,
  },
  {
    field: 'totalLengthMm',
    value: '4890',
    confidence: 'MEDIUM',
    sourceUrl: REDBOOK,
  },
  {
    field: 'fuelTankCapacityL',
    value: '141',
    confidence: 'HIGH',
    sourceUrl: REDBOOK,
  },
  {
    field: 'fuelType',
    value: 'DIESEL',
    confidence: 'HIGH',
    sourceUrl: REDBOOK,
  },
];

/** All catalogue fields nulled — what an honest provider returns for an unknown vehicle. */
const NULLED_FIELDS: FetchedField[] = LANDCRUISER_FIELDS.map((f) => ({
  field: f.field,
  value: null,
  confidence: null,
  sourceUrl: null,
}));

function looksLikeLandCruiser(input: SpecFetchInput): boolean {
  const hay = `${input.makeName} ${input.modelName}`.toLowerCase();
  return (
    (hay.includes('toyota') ||
      hay.includes('landcruiser') ||
      hay.includes('land cruiser')) &&
    (hay.includes('landcruiser') ||
      hay.includes('land cruiser') ||
      hay.includes('100') ||
      hay.includes('cruiser'))
  );
}

export class MockSpecFetchProvider implements SpecFetchProvider {
  readonly id = 'MOCK' as const;

  async fetchVehicleSpec(input: SpecFetchInput): Promise<SpecFetchResult> {
    const fields = looksLikeLandCruiser(input)
      ? LANDCRUISER_FIELDS
      : NULLED_FIELDS;
    return {
      provider: 'MOCK',
      providerModel: 'mock-fixture',
      promptVersion: PROMPT_VERSION,
      fields: fields.map((f) => ({ ...f })),
      raw: {
        fixture: looksLikeLandCruiser(input) ? 'landcruiser-100-gxl' : 'nulled',
        input,
      },
    };
  }
}
