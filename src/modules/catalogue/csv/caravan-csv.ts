import { z } from 'zod';
import type {
  CaravanBodyType,
  AxleConfiguration,
  Market,
} from '@prisma/client';
import { parseCsvToRecords } from './csv-parser';

// ── Constants ──────────────────────────────────────

export const CARAVAN_CSV_HEADERS = [
  'make_name',
  'make_country_of_origin',
  'model_name',
  'body_type',
  'variant_name',
  'year_from',
  'year_to',
  'is_current_production',
  'axle_configuration',
  'market',
  'atm_kg',
  'gtm_kg',
  'tare_kg',
  'tbm_kg',
  'coupling_to_axle_mm',
  'axle_spacing_mm',
  'body_length_mm',
  'overall_length_mm',
  'fresh_water_capacity_l',
  'grey_water_capacity_l',
  'gas_bottle_config',
] as const;

export const CARAVAN_CSV_EXAMPLE_ROW = [
  'Jayco',
  'AU',
  'Journey',
  'CARAVAN_FULL_HEIGHT',
  '17.55-3',
  '2020',
  '2023',
  'false',
  'SINGLE_AXLE',
  'AU',
  '2195',
  '2195',
  '1450',
  '130',
  '3200',
  '',
  '5280',
  '7650',
  '95',
  '70',
  '2x9kg',
];

const CARAVAN_BODY_TYPES = [
  'CARAVAN_POP_TOP',
  'CARAVAN_FULL_HEIGHT',
  'OFF_ROAD_CARAVAN',
  'CAMPER_TRAILER',
  'HYBRID',
  'FIFTH_WHEELER',
  'OTHER',
] as const;

const AXLE_CONFIGURATIONS = [
  'SINGLE_AXLE',
  'DUAL_AXLE_CLOSE_COUPLED',
  'DUAL_AXLE_SPREAD',
  'TRIPLE_AXLE',
] as const;

const MARKETS = ['AU', 'NZ', 'US', 'EU', 'GB'] as const;

// ── Parsed row type ────────────────────────────────

export interface CaravanCsvRowParsed {
  makeName: string;
  makeCountryOfOrigin: string | null;
  modelName: string;
  bodyType: CaravanBodyType;
  variantName: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  axleConfiguration: AxleConfiguration;
  market: Market;
  atmKg: number;
  gtmKg: number;
  tareKg: number;
  tbmKg: number;
  couplingToAxleMm: number;
  axleSpacingMm: number | null;
  bodyLengthMm: number;
  overallLengthMm: number;
  freshWaterCapacityL: number;
  greyWaterCapacityL: number;
  gasBottleConfig: string | null;
}

// ── Zod helpers ────────────────────────────────────

function optionalIntField() {
  return z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || v.trim() === '') return null;
      const n = Number(v.trim());
      if (!Number.isInteger(n) || n <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Must be a positive integer' });
        return z.NEVER;
      }
      return n;
    });
}

function requiredIntField(min = 0) {
  return z
    .string()
    .min(1, 'Required')
    .transform((v, ctx) => {
      const n = Number(v.trim());
      if (!Number.isInteger(n) || n < min) {
        ctx.addIssue({
          code: 'custom',
          message: `Must be an integer >= ${min}`,
        });
        return z.NEVER;
      }
      return n;
    });
}

const caravanCsvRowSchema = z.object({
  make_name: z.string().min(1, 'Required'),
  make_country_of_origin: z.string().optional(),
  model_name: z.string().min(1, 'Required'),
  body_type: z.enum(CARAVAN_BODY_TYPES, {
    error: `Must be one of: ${CARAVAN_BODY_TYPES.join(', ')}`,
  }),
  variant_name: z.string().min(1, 'Required'),
  year_from: requiredIntField(1900),
  year_to: requiredIntField(1900),
  is_current_production: z
    .string()
    .optional()
    .transform((v) =>
      ['true', '1', 'yes'].includes((v ?? '').toLowerCase().trim()),
    ),
  axle_configuration: z.enum(AXLE_CONFIGURATIONS, {
    error: `Must be one of: ${AXLE_CONFIGURATIONS.join(', ')}`,
  }),
  market: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const val = (v ?? 'AU').trim().toUpperCase();
      if (!MARKETS.includes(val as Market)) {
        ctx.addIssue({
          code: 'custom',
          message: `Must be one of: ${MARKETS.join(', ')}`,
        });
        return z.NEVER;
      }
      return val as Market;
    }),
  atm_kg: requiredIntField(1),
  gtm_kg: requiredIntField(1),
  tare_kg: requiredIntField(1),
  tbm_kg: requiredIntField(0),
  coupling_to_axle_mm: requiredIntField(1),
  axle_spacing_mm: optionalIntField(),
  body_length_mm: requiredIntField(1),
  overall_length_mm: requiredIntField(1),
  fresh_water_capacity_l: requiredIntField(0),
  grey_water_capacity_l: requiredIntField(0),
  gas_bottle_config: z.string().optional(),
});

// ── Row result types ───────────────────────────────

export interface CaravanCsvRowResult {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: CaravanCsvRowParsed;
  errors?: Record<string, string>;
}

export interface CaravanCsvPreviewResult {
  rows: CaravanCsvRowResult[];
  deduplicated: CaravanCsvRowParsed[];
  totalInputRows: number;
  validRows: number;
  errorRows: number;
  mergedRows: number;
}

// ── Validation ─────────────────────────────────────

function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
): CaravanCsvRowResult {
  const result = caravanCsvRowSchema.safeParse(raw);

  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? String(issue.path[0]) : '_';
      if (!errors[path]) errors[path] = issue.message;
    }
    return { rowNumber, raw, errors };
  }

  const d = result.data;
  const parsed: CaravanCsvRowParsed = {
    makeName: d.make_name.trim(),
    makeCountryOfOrigin: d.make_country_of_origin?.trim() || null,
    modelName: d.model_name.trim(),
    bodyType: d.body_type as CaravanBodyType,
    variantName: d.variant_name.trim(),
    yearFrom: d.year_from as unknown as number,
    yearTo: d.year_to as unknown as number,
    isCurrentProduction: d.is_current_production as unknown as boolean,
    axleConfiguration: d.axle_configuration as AxleConfiguration,
    market: d.market as unknown as Market,
    atmKg: d.atm_kg as unknown as number,
    gtmKg: d.gtm_kg as unknown as number,
    tareKg: d.tare_kg as unknown as number,
    tbmKg: d.tbm_kg as unknown as number,
    couplingToAxleMm: d.coupling_to_axle_mm as unknown as number,
    axleSpacingMm: d.axle_spacing_mm as unknown as number | null,
    bodyLengthMm: d.body_length_mm as unknown as number,
    overallLengthMm: d.overall_length_mm as unknown as number,
    freshWaterCapacityL: d.fresh_water_capacity_l as unknown as number,
    greyWaterCapacityL: d.grey_water_capacity_l as unknown as number,
    gasBottleConfig: d.gas_bottle_config?.trim() || null,
  };

  if (!parsed.isCurrentProduction && parsed.yearTo < parsed.yearFrom) {
    return {
      rowNumber,
      raw,
      errors: { year_to: 'year_to must be >= year_from' },
    };
  }

  return { rowNumber, raw, parsed };
}

// ── Year-range deduplication ───────────────────────

function variantSignature(r: CaravanCsvRowParsed): string {
  return JSON.stringify({
    makeName: r.makeName,
    modelName: r.modelName,
    bodyType: r.bodyType,
    variantName: r.variantName,
    axleConfiguration: r.axleConfiguration,
    market: r.market,
    atmKg: r.atmKg,
    gtmKg: r.gtmKg,
    tareKg: r.tareKg,
    tbmKg: r.tbmKg,
    couplingToAxleMm: r.couplingToAxleMm,
    axleSpacingMm: r.axleSpacingMm,
    bodyLengthMm: r.bodyLengthMm,
    overallLengthMm: r.overallLengthMm,
    freshWaterCapacityL: r.freshWaterCapacityL,
    greyWaterCapacityL: r.greyWaterCapacityL,
  });
}

function deduplicateCaravanRows(
  rows: CaravanCsvRowParsed[],
): CaravanCsvRowParsed[] {
  const groups = new Map<string, CaravanCsvRowParsed[]>();
  for (const row of rows) {
    const sig = variantSignature(row);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(row);
  }

  const result: CaravanCsvRowParsed[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.yearFrom - b.yearFrom);
    let current = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      if (current.yearTo + 1 >= next.yearFrom) {
        current = {
          ...current,
          yearTo: Math.max(current.yearTo, next.yearTo),
          isCurrentProduction:
            current.isCurrentProduction || next.isCurrentProduction,
        };
      } else {
        result.push(current);
        current = { ...next };
      }
    }
    result.push(current);
  }
  return result;
}

// ── Main entry point ───────────────────────────────

export function validateAndPreviewCaravanCsv(
  csvText: string,
): CaravanCsvPreviewResult {
  const { records } = parseCsvToRecords(csvText);

  const rows: CaravanCsvRowResult[] = records.map((raw, i) =>
    validateRow(raw, i + 2),
  );

  const validRows = rows.filter((r) => r.parsed);
  const errorRows = rows.filter((r) => r.errors);

  const deduplicated = deduplicateCaravanRows(validRows.map((r) => r.parsed!));

  const mergedRows = validRows.length - deduplicated.length;

  return {
    rows,
    deduplicated,
    totalInputRows: records.length,
    validRows: validRows.length,
    errorRows: errorRows.length,
    mergedRows,
  };
}
