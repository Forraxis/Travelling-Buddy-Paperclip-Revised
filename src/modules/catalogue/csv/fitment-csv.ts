import { z } from "zod";
import type { PositionType, MountingLocation } from "@prisma/client";
import { parseCsvToRecords } from "./csv-parser";

// ── Constants ──────────────────────────────────────

export const FITMENT_CSV_HEADERS = [
  "accessory_slug",
  "brand_name",
  "vehicle_variant_slug",
  "caravan_variant_slug",
  "installed_weight_kg",
  "position_type",
  "mounting_location",
  "provides_mounting_locations",
  "cog_x_mm",
  "start_x_mm",
  "end_x_mm",
  "mount_offset_x_mm",
  "fluid_density",
] as const;

// vehicle_variant_slug format: make-slug/model-slug/variant-slug
// caravan_variant_slug format: make-slug/model-slug/variant-slug
// provides_mounting_locations: pipe-separated, e.g. BULL_BAR|ROOF_RACK
// fluid_density: tank contents density in kg/L (= tankContentsKgPerL)
export const FITMENT_CSV_EXAMPLE_ROW = [
  "summit-bull-bar-toyota-landcruiser-200-series",
  "ARB",
  "toyota/landcruiser-200-series/vx-petrol",
  "",
  "42.5",
  "FIXED",
  "CHASSIS_FRONT",
  "BULL_BAR",
  "450",
  "",
  "",
  "0",
  "",
];

const POSITION_TYPES = ["FIXED", "ADJUSTABLE", "MODULAR", "SLIDING"] as const;

const MOUNTING_LOCATIONS = [
  "CHASSIS_FRONT", "CHASSIS_MID", "CHASSIS_REAR", "BULL_BAR", "ROOF_RACK",
  "ROOF_RAILS", "TRAY_FLOOR", "TRAY_SIDE_LEFT", "TRAY_SIDE_RIGHT",
  "TRAY_HEADBOARD", "TRAY_TAILGATE", "CANOPY_EXTERIOR", "CANOPY_INTERIOR",
  "CANOPY_ROOF", "TUB_INTERIOR", "TUB_EXTERIOR", "BONNET", "REAR_BAR",
  "TOW_HITCH", "WHEEL_ARCH_LEFT", "WHEEL_ARCH_RIGHT", "UNDERBODY_FRONT",
  "UNDERBODY_MID", "UNDERBODY_REAR", "A_PILLAR_LEFT", "A_PILLAR_RIGHT",
  "WINDSCREEN", "CABIN_INTERIOR", "CABIN_ROOF", "CABIN_DASH", "DOOR_LEFT",
  "DOOR_RIGHT", "SNORKEL", "FENDER_LEFT", "FENDER_RIGHT", "CARAVAN_DRAWBAR",
  "CARAVAN_A_FRAME", "CARAVAN_CHASSIS_FRONT", "CARAVAN_CHASSIS_MID",
  "CARAVAN_CHASSIS_REAR", "CARAVAN_UNDERBODY", "CARAVAN_ROOF",
  "CARAVAN_WALL_LEFT", "CARAVAN_WALL_RIGHT", "CARAVAN_WALL_FRONT",
  "CARAVAN_WALL_REAR", "CARAVAN_BUMPER_BAR", "CARAVAN_BOOT",
  "CARAVAN_TUNNEL_BOOT", "CARAVAN_TOOLBAR_EXTERNAL", "CARAVAN_TOOLBAR_INTERNAL",
] as const;

// ── Parsed row type ────────────────────────────────

export interface FitmentCsvRowParsed {
  accessorySlug: string;
  brandName: string;
  vehicleVariantSlug: string | null;
  caravanVariantSlug: string | null;
  installedWeightKg: number;
  positionType: PositionType;
  mountingLocation: MountingLocation;
  providesMountingLocations: MountingLocation[];
  cogXMm: number | null;
  startXMm: number | null;
  endXMm: number | null;
  mountOffsetXMm: number | null;
  fluidDensity: number | null;
}

// ── Zod helpers ────────────────────────────────────

function optionalIntField() {
  return z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || v.trim() === "") return null;
      const n = Number(v.trim());
      if (!Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: "Must be an integer" });
        return z.NEVER;
      }
      return n;
    });
}

function optionalDecimalField() {
  return z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || v.trim() === "") return null;
      const n = parseFloat(v.trim());
      if (isNaN(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "Must be a non-negative number" });
        return z.NEVER;
      }
      return n;
    });
}

const fitmentCsvRowSchema = z.object({
  accessory_slug: z.string().min(1, "Required"),
  brand_name: z.string().min(1, "Required"),
  vehicle_variant_slug: z.string().optional(),
  caravan_variant_slug: z.string().optional(),
  installed_weight_kg: z
    .string()
    .min(1, "Required")
    .transform((v, ctx) => {
      const n = parseFloat(v.trim());
      if (isNaN(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "Must be a non-negative number" });
        return z.NEVER;
      }
      return n;
    }),
  position_type: z.enum(POSITION_TYPES, {
    error: `Must be one of: ${POSITION_TYPES.join(", ")}`,
  }),
  mounting_location: z.enum(MOUNTING_LOCATIONS, {
    error: `Must be one of the valid MountingLocation values`,
  }),
  provides_mounting_locations: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || v.trim() === "") return [] as MountingLocation[];
      const parts = v.split("|").map((s) => s.trim().toUpperCase());
      for (const p of parts) {
        if (!MOUNTING_LOCATIONS.includes(p as MountingLocation)) {
          ctx.addIssue({
            code: "custom",
            message: `Unknown mounting location: ${p}`,
          });
          return z.NEVER;
        }
      }
      return parts as MountingLocation[];
    }),
  cog_x_mm: optionalIntField(),
  start_x_mm: optionalIntField(),
  end_x_mm: optionalIntField(),
  mount_offset_x_mm: optionalIntField(),
  fluid_density: optionalDecimalField(),
});

// ── Row result types ───────────────────────────────

export interface FitmentCsvRowResult {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: FitmentCsvRowParsed;
  errors?: Record<string, string>;
}

export interface FitmentCsvPreviewResult {
  rows: FitmentCsvRowResult[];
  validRows: number;
  errorRows: number;
  totalInputRows: number;
}

// ── Validation ─────────────────────────────────────

function validateRow(
  raw: Record<string, string>,
  rowNumber: number
): FitmentCsvRowResult {
  const result = fitmentCsvRowSchema.safeParse(raw);

  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? String(issue.path[0]) : "_";
      if (!errors[path]) errors[path] = issue.message;
    }
    return { rowNumber, raw, errors };
  }

  const d = result.data;

  const vehicleSlug = d.vehicle_variant_slug?.trim() || null;
  const caravanSlug = d.caravan_variant_slug?.trim() || null;

  if (!vehicleSlug && !caravanSlug) {
    return {
      rowNumber,
      raw,
      errors: {
        vehicle_variant_slug:
          "Either vehicle_variant_slug or caravan_variant_slug is required",
      },
    };
  }

  if (vehicleSlug && caravanSlug) {
    return {
      rowNumber,
      raw,
      errors: {
        vehicle_variant_slug:
          "Specify vehicle_variant_slug or caravan_variant_slug, not both",
      },
    };
  }

  const parsed: FitmentCsvRowParsed = {
    accessorySlug: d.accessory_slug.trim(),
    brandName: d.brand_name.trim(),
    vehicleVariantSlug: vehicleSlug,
    caravanVariantSlug: caravanSlug,
    installedWeightKg: d.installed_weight_kg as unknown as number,
    positionType: d.position_type as PositionType,
    mountingLocation: d.mounting_location as MountingLocation,
    providesMountingLocations: d.provides_mounting_locations as unknown as MountingLocation[],
    cogXMm: d.cog_x_mm as unknown as number | null,
    startXMm: d.start_x_mm as unknown as number | null,
    endXMm: d.end_x_mm as unknown as number | null,
    mountOffsetXMm: d.mount_offset_x_mm as unknown as number | null,
    fluidDensity: d.fluid_density as unknown as number | null,
  };

  return { rowNumber, raw, parsed };
}

// ── Main entry point ───────────────────────────────

export function validateAndPreviewFitmentCsv(
  csvText: string
): FitmentCsvPreviewResult {
  const { records } = parseCsvToRecords(csvText);

  const rows: FitmentCsvRowResult[] = records.map((raw, i) =>
    validateRow(raw, i + 2)
  );

  const validRows = rows.filter((r) => r.parsed);
  const errorRows = rows.filter((r) => r.errors);

  return {
    rows,
    validRows: validRows.length,
    errorRows: errorRows.length,
    totalInputRows: records.length,
  };
}
