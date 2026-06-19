/**
 * Read-model for the PUBLIC confirmed-spec vehicle page (P9 — overnight build).
 *
 * Decision 6 (VEHICLE_DATA_FETCH.md §6): publish ONLY `VariantSpecProvenance`
 * rows with `status = CONFIRMED` (ROVER-authoritative, plate-confirmed, or
 * ≥K cross-source agreement). AI ESTIMATE / DISPUTED values NEVER appear on a
 * public page — they stay inside the calculator flow as flagged estimates.
 *
 * This module is the sole gate that enforces that boundary for the public page:
 * every value it returns is provenance-stamped (source + as-of date + citation)
 * so the page can render "sourced from ROVER, as at [date]" near each figure.
 *
 * The page is canonicalised to avoid thin/duplicate content (25–30 near-identical
 * variants per model): one MODEL page + a variant table, never a public page per
 * variant.
 */
import type { SpecProvenanceSource } from '@prisma/client';
import { prisma } from '@/lib/db';

/** Spec fields published on the confirmed page, in display order. */
export const CONFIRMED_SPEC_FIELDS = [
  'gvmKg',
  'gcmKg',
  'maxTowingCapacityKg',
  'maxTowBallDownloadKg',
  'kerbWeightKg',
  'frontAxleLimitKg',
  'rearAxleLimitKg',
  'wheelbaseMm',
  'frontOverhangMm',
  'rearOverhangMm',
  'totalLengthMm',
] as const;

export type ConfirmedSpecField = (typeof CONFIRMED_SPEC_FIELDS)[number];

const CONFIRMED_SPEC_FIELD_SET = new Set<string>(CONFIRMED_SPEC_FIELDS);

/** One published, provenance-stamped field value. */
export interface ConfirmedSpecCell {
  field: ConfirmedSpecField;
  /** Canonical string value (e.g. "3500"); never null on a published cell. */
  value: string;
  source: SpecProvenanceSource;
  /** Citation URL where one exists (ROVER report / source). */
  sourceUrl: string | null;
  /** Deterministic ISO date (YYYY-MM-DD) the value was sourced / last reviewed. */
  asOf: string;
}

/** A variant row with only its CONFIRMED, provenance-stamped fields. */
export interface ConfirmedVariantRow {
  id: string;
  name: string;
  slug: string;
  yearFrom: number;
  yearTo: number;
  isCurrentProduction: boolean;
  /** Confirmed cells keyed by field; missing fields are simply absent. */
  cells: Partial<Record<ConfirmedSpecField, ConfirmedSpecCell>>;
}

export interface ConfirmedModelPageData {
  make: { name: string; slug: string };
  model: { name: string; slug: string };
  /** Only variants that have at least one CONFIRMED published field. */
  variants: ConfirmedVariantRow[];
  /** The most recent as-of date across every published cell (YYYY-MM-DD), or null. */
  latestAsOf: string | null;
}

/** Deterministic ISO date stamp — never `toLocaleDateString` (locale-dependent). */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build the public confirmed-spec page for a make+model.
 *
 * Returns null when the make/model doesn't exist OR when no variant has any
 * CONFIRMED published field (nothing to publish → 404, never an empty stub page).
 */
export async function getConfirmedModelPageData(
  makeSlug: string,
  modelSlug: string,
): Promise<ConfirmedModelPageData | null> {
  const make = await prisma.vehicleMake.findUnique({
    where: { slug: makeSlug },
  });
  if (!make) return null;

  const model = await prisma.vehicleModel.findUnique({
    where: { makeId_slug: { makeId: make.id, slug: modelSlug } },
  });
  if (!model) return null;

  const variants = await prisma.vehicleVariant.findMany({
    where: { modelId: model.id, status: 'CATALOGUE' },
    orderBy: { yearFrom: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      yearFrom: true,
      yearTo: true,
      isCurrentProduction: true,
      specProvenance: {
        // Public boundary: CONFIRMED only. AI estimates never published.
        where: { status: 'CONFIRMED', value: { not: null } },
        select: {
          field: true,
          value: true,
          source: true,
          sourceUrl: true,
          asOf: true,
        },
      },
    },
  });

  let latest: Date | null = null;

  const rows: ConfirmedVariantRow[] = [];
  for (const v of variants) {
    const cells: Partial<Record<ConfirmedSpecField, ConfirmedSpecCell>> = {};
    for (const p of v.specProvenance) {
      if (!CONFIRMED_SPEC_FIELD_SET.has(p.field)) continue;
      if (p.value == null) continue;
      const field = p.field as ConfirmedSpecField;
      cells[field] = {
        field,
        value: p.value,
        source: p.source,
        sourceUrl: p.sourceUrl,
        asOf: isoDate(p.asOf),
      };
      if (latest == null || p.asOf > latest) latest = p.asOf;
    }
    if (Object.keys(cells).length === 0) continue; // nothing confirmed → omit
    rows.push({
      id: v.id,
      name: v.name,
      slug: v.slug,
      yearFrom: v.yearFrom,
      yearTo: v.yearTo,
      isCurrentProduction: v.isCurrentProduction,
      cells,
    });
  }

  if (rows.length === 0) return null;

  return {
    make: { name: make.name, slug: make.slug },
    model: { name: model.name, slug: model.slug },
    variants: rows,
    latestAsOf: latest ? isoDate(latest) : null,
  };
}

/**
 * SSG params: every (make, model) that has at least one CONFIRMED published field.
 * Done with a single provenance query + in-memory dedup to keep the slug set tight
 * (a model with only ESTIMATE data must NOT generate a public page).
 */
export async function getAllConfirmedModelSlugsForSSG(): Promise<
  Array<{ make: string; model: string }>
> {
  const confirmed = await prisma.variantSpecProvenance.findMany({
    where: {
      status: 'CONFIRMED',
      value: { not: null },
      field: { in: [...CONFIRMED_SPEC_FIELDS] },
      variant: { status: 'CATALOGUE' },
    },
    select: {
      variant: {
        select: {
          model: { select: { slug: true, make: { select: { slug: true } } } },
        },
      },
    },
  });

  const seen = new Map<string, { make: string; model: string }>();
  for (const c of confirmed) {
    const make = c.variant.model.make.slug;
    const model = c.variant.model.slug;
    const key = `${make}/${model}`;
    if (!seen.has(key)) seen.set(key, { make, model });
  }
  return [...seen.values()];
}
