/**
 * Road Vehicle Descriptor (RVD) parser — deterministic, pure (text in → structured
 * out). Extracts the per-variant figures ROVER actually publishes: GVM, tare,
 * braked + non-braked towing, GCM (usually empty), dimensions, body style, seating,
 * axle code. Front/rear axle limits and GCM are mostly absent — see
 * VEHICLE_DATA_FETCH.md "Document-boundary findings"; the rare free-text axle figure
 * in "Remarks" is captured at document level only.
 *
 * Robustness notes:
 *  - The extracted text interleaves a running page header
 *    ("VTA-… | Page n of m Generated: dd/mm/yyyy hh:mm"); we capture the generated
 *    date from it, then strip it so it can't sit between a label and its value.
 *  - One VTA spans many variants (Navara 25, Hilux 30). We split on
 *    "Variant information for <name>" and parse each block independently, taking the
 *    first occurrence of each label in the block (the variant-details table sits at
 *    the block start, before the per-variant engine/brake/tyre listings).
 *  - null = "not stated in the document", never 0 (the same invariant as the LLM path).
 */
import { createHash } from 'node:crypto';

export interface RvdVariant {
  /** Full variant identifier as printed, e.g. "DC PU 2WD AT ST-X (#030)". */
  name: string;
  /** The "#NNN" code if the name carries one, else null. */
  variantCode: string | null;
  bodyStyle: string | null;
  tareKg: number | null;
  gvmKg: number | null;
  gcmKg: number | null;
  towBrakedKg: number | null;
  towUnbrakedKg: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  wheelbaseMm: number | null;
  runningClearanceMm: number | null;
  seatingOptions: string | null;
  axleCode: string | null;
}

export interface RvdDocument {
  vtaNumber: string | null;
  make: string | null;
  model: string | null;
  marketingDesignation: string | null;
  /** Broad ADR category as the RVD states it, e.g. "N - Goods Vehicles" (null if blank). */
  categoryBroad: string | null;
  /** RVD generation/download date, ISO yyyy-mm-dd (from the page header). */
  generatedDate: string | null;
  /** Free-text axle limits from "Remarks" (rare; document-level, not per-variant). */
  remarksFrontAxleKg: number | null;
  remarksRearAxleKg: number | null;
  variants: RvdVariant[];
  /** sha256 of the raw extracted text — the version/change key. */
  contentHash: string;
  /** Verbatim extracted text — retained as the source-of-truth archive. */
  rawText: string;
}

// The running page header is "VTA-… <make model> | Page n of m Generated: dd/mm/yyyy hh:mm".
// The make/model segment never contains a colon, so [^|:]* stops this from greedily
// bridging from the approval-number value (also "VTA-… 20241202 …") across the colon-laden
// General Information block to the next page's "|" — which would delete make/model/category.
const PAGE_HEADER =
  /VTA-\d+\s+\d{8}\s+[^|:]*\|\s*Page\s+\d+\s+of\s+\d+\s+Generated:\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/g;

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m && m[1] !== undefined ? m[1].trim() : null;
}

/** Parse an integer figure (comma-tolerant). Empty/absent → null (never 0). */
function num(text: string, re: RegExp): number | null {
  const m = text.match(re);
  if (!m || m[1] === undefined) return null;
  const n = parseInt(m[1].replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** dd/mm/yyyy → yyyy-mm-dd (string-only; no Date construction). */
function toIso(ddmmyyyy: string | null): string | null {
  if (!ddmmyyyy) return null;
  const m = ddmmyyyy.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parseVariantBlock(name: string, block: string): RvdVariant {
  const codeMatch = name.match(/\(#?([\w-]+)\)\s*$/);
  return {
    name: name.trim(),
    variantCode: codeMatch ? codeMatch[1] : null,
    bodyStyle: firstMatch(
      block,
      /Body style:\s*(.+?)\s+(?:NSW body code|Seating|Max\.)/,
    ),
    tareKg: num(block, /Tare mass \(kg\):\s*([\d,]+)/),
    gvmKg: num(block, /Gross vehicle mass \(kg\):\s*([\d,]+)/),
    gcmKg: num(block, /Gross combination mass \(kg\):\s*([\d,]+)/),
    towBrakedKg: num(
      block,
      /Maximum towing mass \(braked trailer\) \(kg\):\s*([\d,]+)/,
    ),
    towUnbrakedKg: num(
      block,
      /Maximum towing mass \(non-braked trailer\) \(kg\):\s*([\d,]+)/,
    ),
    lengthMm: num(block, /Vehicle length \(mm\):\s*([\d,]+)/),
    widthMm: num(block, /Vehicle width \(mm\):\s*([\d,]+)/),
    heightMm: num(block, /Vehicle height \(mm\):\s*([\d,]+)/),
    wheelbaseMm: num(block, /Wheelbase \(mm\):\s*([\d,]+)/),
    runningClearanceMm: num(block, /Running clearance \(mm\):\s*([\d,]+)/),
    seatingOptions: firstMatch(
      block,
      /Seating options:\s*(.+?)\s+(?:Max\.|No\. of)/,
    ),
    axleCode: firstMatch(block, /Axle code:\s*(.+?)\s+Tare mass/),
  };
}

export function parseRvdText(rawText: string): RvdDocument {
  const generatedDate = toIso(
    firstMatch(rawText, /Generated:\s*(\d{2}\/\d{2}\/\d{4})/),
  );
  const contentHash = createHash('sha256').update(rawText).digest('hex');

  // Strip running page headers so they can't split a label from its value.
  const text = rawText.replace(PAGE_HEADER, ' ').replace(/\s+/g, ' ');

  const vtaNumber = firstMatch(
    text,
    /Vehicle type approval number:\s*(VTA-\d+)/,
  );
  const make = firstMatch(text, /Make:\s*(.+?)\s+Model:/);
  const model = firstMatch(text, /Model:\s*(.+?)\s+Marketing designation:/);
  const marketingDesignation = firstMatch(
    text,
    /Marketing designation:\s*(.+?)\s+Category:/,
  );
  const categoryBroad = firstMatch(
    text,
    /Category:\s*([MNL][A-Z]?\d?\s*-\s*[A-Za-z ]+?)\s+(?:Secure|List of|Variant)/,
  );

  // Remarks axle limits (rare, document-level).
  const remarksFrontAxleKg = num(text, /FRONT AXLE:\s*([\d,]+)\s*kg/i);
  const remarksRearAxleKg = num(text, /REAR AXLE:\s*([\d,]+)\s*kg/i);

  // Split into per-variant blocks.
  const markers = [
    ...text.matchAll(/Variant information for\s+(.+?)\s+Front 3\/4 image:/g),
  ];
  const variants: RvdVariant[] = markers.map((m, i) => {
    const start = m.index ?? 0;
    const end =
      i + 1 < markers.length
        ? (markers[i + 1].index ?? text.length)
        : text.length;
    return parseVariantBlock(m[1], text.slice(start, end));
  });

  return {
    vtaNumber,
    make,
    model,
    marketingDesignation,
    categoryBroad,
    generatedDate,
    remarksFrontAxleKg,
    remarksRearAxleKg,
    variants,
    contentHash,
    rawText,
  };
}
