import { z } from "zod";
import type { VehicleBodyType, FuelType, Market } from "@prisma/client";
import { parseCsvToRecords } from "./csv-parser";

// ── Constants ──────────────────────────────────────

export const VEHICLE_CSV_HEADERS = [
  "make_name",
  "make_country_of_origin",
  "model_name",
  "body_type",
  "variant_name",
  "year_from",
  "year_to",
  "is_current_production",
  "fuel_type",
  "market",
  "gvm_kg",
  "gcm_kg",
  "kerb_weight_kg",
  "max_towing_capacity_kg",
  "front_axle_limit_kg",
  "rear_axle_limit_kg",
  "wheelbase_mm",
  "front_overhang_mm",
  "rear_overhang_mm",
  "total_length_mm",
  "max_tow_ball_download_kg",
  "fuel_tank_capacity_l",
] as const;

export const VEHICLE_CSV_EXAMPLE_ROW = [
  "Toyota",
  "JP",
  "HiLux",
  "DUAL_CAB_UTE",
  "SR5 4x4 Auto",
  "2018",
  "2022",
  "false",
  "DIESEL",
  "AU",
  "3200",
  "6000",
  "1940",
  "3500",
  "1500",
  "1500",
  "3085",
  "",
  "",
  "5330",
  "300",
  "80",
];

const VEHICLE_BODY_TYPES = [
  "DUAL_CAB_UTE",
  "SINGLE_CAB_UTE",
  "EXTRA_CAB_UTE",
  "WAGON",
  "SUV",
  "VAN",
  "TROOPCARRIER",
  "OTHER",
] as const;

const FUEL_TYPES = ["DIESEL", "PETROL", "HYBRID", "ELECTRIC"] as const;
const MARKETS = ["AU", "NZ", "US", "EU", "GB"] as const;

// ── Parsed row type ────────────────────────────────

export interface VehicleCsvRowParsed {
  makeName: string;
  makeCountryOfOrigin: string | null;
  modelName: string;
  bodyType: VehicleBodyType;
  variantName: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  fuelType: FuelType;
  market: Market;
  gvmKg: number;
  gcmKg: number;
  kerbWeightKg: number;
  maxTowingCapacityKg: number;
  frontAxleLimitKg: number;
  rearAxleLimitKg: number;
  wheelbaseMm: number;
  frontOverhangMm: number | null;
  rearOverhangMm: number | null;
  totalLengthMm: number | null;
  maxTowBallDownloadKg: number;
  fuelTankCapacityL: number;
}

// ── Zod schema ─────────────────────────────────────

function optionalIntField() {
  return z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || v.trim() === "") return null;
      const n = Number(v.trim());
      if (!Number.isInteger(n) || n <= 0) {
        ctx.addIssue({ code: "custom", message: "Must be a positive integer" });
        return z.NEVER;
      }
      return n;
    });
}

function requiredIntField(min = 0) {
  return z
    .string()
    .min(1, "Required")
    .transform((v, ctx) => {
      const n = Number(v.trim());
      if (!Number.isInteger(n) || n < min) {
        ctx.addIssue({
          code: "custom",
          message: `Must be an integer >= ${min}`,
        });
        return z.NEVER;
      }
      return n;
    });
}

const vehicleCsvRowSchema = z.object({
  make_name: z.string().min(1, "Required"),
  make_country_of_origin: z.string().optional(),
  model_name: z.string().min(1, "Required"),
  body_type: z.enum(VEHICLE_BODY_TYPES, {
    error: `Must be one of: ${VEHICLE_BODY_TYPES.join(", ")}`,
  }),
  variant_name: z.string().min(1, "Required"),
  year_from: requiredIntField(1900),
  year_to: requiredIntField(1900),
  is_current_production: z
    .string()
    .optional()
    .transform((v) =>
      ["true", "1", "yes"].includes((v ?? "").toLowerCase().trim())
    ),
  fuel_type: z.enum(FUEL_TYPES, {
    error: `Must be one of: ${FUEL_TYPES.join(", ")}`,
  }),
  market: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const val = (v ?? "AU").trim().toUpperCase();
      if (!MARKETS.includes(val as Market)) {
        ctx.addIssue({
          code: "custom",
          message: `Must be one of: ${MARKETS.join(", ")}`,
        });
        return z.NEVER;
      }
      return val as Market;
    }),
  gvm_kg: requiredIntField(1),
  gcm_kg: requiredIntField(1),
  kerb_weight_kg: requiredIntField(1),
  max_towing_capacity_kg: requiredIntField(0),
  front_axle_limit_kg: requiredIntField(1),
  rear_axle_limit_kg: requiredIntField(1),
  wheelbase_mm: requiredIntField(1),
  front_overhang_mm: optionalIntField(),
  rear_overhang_mm: optionalIntField(),
  total_length_mm: optionalIntField(),
  max_tow_ball_download_kg: requiredIntField(0),
  fuel_tank_capacity_l: requiredIntField(1),
});

// ── Row result types ───────────────────────────────

export interface VehicleCsvRowResult {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: VehicleCsvRowParsed;
  errors?: Record<string, string>;
  mergedInto?: number;
}

export interface VehicleCsvPreviewResult {
  rows: VehicleCsvRowResult[];
  deduplicated: VehicleCsvRowParsed[];
  totalInputRows: number;
  validRows: number;
  errorRows: number;
  mergedRows: number;
}

// ── Validation ─────────────────────────────────────

function validateRow(
  raw: Record<string, string>,
  rowNumber: number
): VehicleCsvRowResult {
  const result = vehicleCsvRowSchema.safeParse(raw);

  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? String(issue.path[0]) : "_";
      if (!errors[path]) errors[path] = issue.message;
    }
    return { rowNumber, raw, errors };
  }

  const d = result.data;
  const parsed: VehicleCsvRowParsed = {
    makeName: d.make_name.trim(),
    makeCountryOfOrigin:
      d.make_country_of_origin?.trim() || null,
    modelName: d.model_name.trim(),
    bodyType: d.body_type as VehicleBodyType,
    variantName: d.variant_name.trim(),
    yearFrom: d.year_from as unknown as number,
    yearTo: d.year_to as unknown as number,
    isCurrentProduction: d.is_current_production as unknown as boolean,
    fuelType: d.fuel_type as FuelType,
    market: d.market as unknown as Market,
    gvmKg: d.gvm_kg as unknown as number,
    gcmKg: d.gcm_kg as unknown as number,
    kerbWeightKg: d.kerb_weight_kg as unknown as number,
    maxTowingCapacityKg: d.max_towing_capacity_kg as unknown as number,
    frontAxleLimitKg: d.front_axle_limit_kg as unknown as number,
    rearAxleLimitKg: d.rear_axle_limit_kg as unknown as number,
    wheelbaseMm: d.wheelbase_mm as unknown as number,
    frontOverhangMm: d.front_overhang_mm as unknown as number | null,
    rearOverhangMm: d.rear_overhang_mm as unknown as number | null,
    totalLengthMm: d.total_length_mm as unknown as number | null,
    maxTowBallDownloadKg: d.max_tow_ball_download_kg as unknown as number,
    fuelTankCapacityL: d.fuel_tank_capacity_l as unknown as number,
  };

  const yearFrom = parsed.yearFrom;
  const yearTo = parsed.yearTo;
  if (!parsed.isCurrentProduction && yearTo < yearFrom) {
    return {
      rowNumber,
      raw,
      errors: { year_to: "year_to must be >= year_from" },
    };
  }

  return { rowNumber, raw, parsed };
}

// ── Year-range deduplication ───────────────────────

function variantSignature(r: VehicleCsvRowParsed): string {
  return JSON.stringify({
    makeName: r.makeName,
    modelName: r.modelName,
    bodyType: r.bodyType,
    variantName: r.variantName,
    fuelType: r.fuelType,
    market: r.market,
    gvmKg: r.gvmKg,
    gcmKg: r.gcmKg,
    kerbWeightKg: r.kerbWeightKg,
    maxTowingCapacityKg: r.maxTowingCapacityKg,
    frontAxleLimitKg: r.frontAxleLimitKg,
    rearAxleLimitKg: r.rearAxleLimitKg,
    wheelbaseMm: r.wheelbaseMm,
    frontOverhangMm: r.frontOverhangMm,
    rearOverhangMm: r.rearOverhangMm,
    totalLengthMm: r.totalLengthMm,
    maxTowBallDownloadKg: r.maxTowBallDownloadKg,
    fuelTankCapacityL: r.fuelTankCapacityL,
  });
}

function deduplicateVehicleRows(
  rows: VehicleCsvRowParsed[]
): VehicleCsvRowParsed[] {
  const groups = new Map<string, VehicleCsvRowParsed[]>();
  for (const row of rows) {
    const sig = variantSignature(row);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push(row);
  }

  const result: VehicleCsvRowParsed[] = [];
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

export function validateAndPreviewVehicleCsv(
  csvText: string
): VehicleCsvPreviewResult {
  const { records } = parseCsvToRecords(csvText);

  const rows: VehicleCsvRowResult[] = records.map((raw, i) =>
    validateRow(raw, i + 2)
  );

  const validRows = rows.filter((r) => r.parsed);
  const errorRows = rows.filter((r) => r.errors);

  const deduplicated = deduplicateVehicleRows(
    validRows.map((r) => r.parsed!)
  );

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
