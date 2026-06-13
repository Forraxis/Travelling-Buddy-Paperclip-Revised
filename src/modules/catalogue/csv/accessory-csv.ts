import { z } from 'zod';
import type { AccessoryStatus } from '@prisma/client';
import { parseCsvToRecords } from './csv-parser';

// ── Constants ──────────────────────────────────────

export const ACCESSORY_CSV_HEADERS = [
  'brand_name',
  'category_name',
  'name',
  'slug',
  'description',
  'status',
] as const;

export const ACCESSORY_CSV_EXAMPLE_ROW = [
  'ARB',
  'Bull Bars',
  'Summit Bull Bar – Toyota LandCruiser 200 Series',
  '',
  'Heavy-duty steel bull bar with integrated winch mount and LED light bar bracket.',
  'ACTIVE',
];

const ACCESSORY_STATUSES = [
  'ACTIVE',
  'DISCONTINUED',
  'PLACEHOLDER',
  'COMMUNITY',
] as const;

// ── Parsed row type ────────────────────────────────

export interface AccessoryCsvRowParsed {
  brandName: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string | null;
  status: AccessoryStatus;
}

// ── Schema ─────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const accessoryCsvRowSchema = z.object({
  brand_name: z.string().min(1, 'Required'),
  category_name: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  slug: z.string().optional(),
  description: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((v, ctx) => {
      const val = (v ?? 'ACTIVE').trim().toUpperCase();
      if (!ACCESSORY_STATUSES.includes(val as AccessoryStatus)) {
        ctx.addIssue({
          code: 'custom',
          message: `Must be one of: ${ACCESSORY_STATUSES.join(', ')}`,
        });
        return z.NEVER;
      }
      return val as AccessoryStatus;
    }),
});

// ── Row result types ───────────────────────────────

export interface AccessoryCsvRowResult {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: AccessoryCsvRowParsed;
  errors?: Record<string, string>;
}

export interface AccessoryCsvPreviewResult {
  rows: AccessoryCsvRowResult[];
  deduplicated: AccessoryCsvRowParsed[];
  totalInputRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
}

// ── Validation ─────────────────────────────────────

function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
): AccessoryCsvRowResult {
  const result = accessoryCsvRowSchema.safeParse(raw);

  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? String(issue.path[0]) : '_';
      if (!errors[path]) errors[path] = issue.message;
    }
    return { rowNumber, raw, errors };
  }

  const d = result.data;
  const derivedSlug = d.slug?.trim()
    ? slugify(d.slug.trim())
    : slugify(d.name.trim());

  const parsed: AccessoryCsvRowParsed = {
    brandName: d.brand_name.trim(),
    categoryName: d.category_name.trim(),
    name: d.name.trim(),
    slug: derivedSlug,
    description: d.description?.trim() || null,
    status: d.status as unknown as AccessoryStatus,
  };

  return { rowNumber, raw, parsed };
}

// ── Deduplication (by brand+slug) ──────────────────

function deduplicateAccessoryRows(rows: AccessoryCsvRowParsed[]): {
  deduplicated: AccessoryCsvRowParsed[];
  duplicateRows: number;
} {
  const seen = new Set<string>();
  const deduplicated: AccessoryCsvRowParsed[] = [];
  let duplicateRows = 0;

  for (const row of rows) {
    const key = `${row.brandName.toLowerCase()}|${row.slug}`;
    if (seen.has(key)) {
      duplicateRows++;
    } else {
      seen.add(key);
      deduplicated.push(row);
    }
  }

  return { deduplicated, duplicateRows };
}

// ── Main entry point ───────────────────────────────

export function validateAndPreviewAccessoryCsv(
  csvText: string,
): AccessoryCsvPreviewResult {
  const { records } = parseCsvToRecords(csvText);

  const rows: AccessoryCsvRowResult[] = records.map((raw, i) =>
    validateRow(raw, i + 2),
  );

  const validRows = rows.filter((r) => r.parsed);
  const errorRows = rows.filter((r) => r.errors);

  const { deduplicated, duplicateRows } = deduplicateAccessoryRows(
    validRows.map((r) => r.parsed!),
  );

  return {
    rows,
    deduplicated,
    totalInputRows: records.length,
    validRows: validRows.length,
    errorRows: errorRows.length,
    duplicateRows,
  };
}
