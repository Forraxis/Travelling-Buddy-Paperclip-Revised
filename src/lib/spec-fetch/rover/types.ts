/**
 * ROVER ingestion types.
 *
 * ROVER (the federal RVSA approvals portal) publishes an Approval Consumer Report
 * per Vehicle Type Approval (VTA). The report is pure engineering data — factory
 * tare, max GVM/GCM, front/rear axle capacities, braked towing. The architectural
 * principle (see VEHICLE_DATA_FETCH.md §3): the LLM only *locates* the document,
 * a deterministic parser *extracts* the figure. The model never states a
 * compliance number, so a ROVER-parsed field carries no transcription-hallucination
 * risk and **auto-corroborates** the promotion gate.
 *
 * These types describe the ingestion shape only — the synthetic parser proves the
 * wiring; the real pdfplumber/VLM parser drops in behind `RoverReportParser` when
 * a real consumer-report sample lands in fixtures/rover/.
 */
import type { VehicleBodyType } from '@prisma/client';
import type { VehicleSpecFieldKey } from '../types';

/**
 * ROVER vehicle category → maps to our VehicleBodyType targeting (see §3):
 *  - MC  = off-road passenger 4WDs (LandCruiser/Patrol/Prado/Everest)
 *  - NA  = ≤3.5 t utes + light vans (Hilux/Ranger/D-Max/79-series/HiAce)
 *  - NB1 = 3.5–4.5 t (RAM/Silverado/F-truck + Sprinter/Crafter camper bases)
 */
export type RoverCategory = 'MC' | 'NA' | 'NB1';

export const ROVER_CATEGORIES: readonly RoverCategory[] = ['MC', 'NA', 'NB1'];

/**
 * One approval as the directory crawl enumerates it — enough to fetch + identify
 * the consumer report and target a catalogue make/model/variant. The crawler
 * produces these; the verifier turns each into a candidate.
 */
export interface RoverApprovalRef {
  /** Vehicle Type Approval number, e.g. "VTA-061234" — the idempotency key. */
  vtaNumber: string;
  /** Consumer-report document URL (the PDF the parser reads). */
  reportUrl: string;
  category: RoverCategory;
  makeName: string;
  modelName: string;
  variantName?: string | null;
  yearFrom: number;
  yearTo?: number | null;
  bodyType?: VehicleBodyType | null;
  /**
   * Publish/approval date as an ISO string (YYYY-MM-DD) — the high-water mark the
   * incremental crawl sorts + advances on. String form keeps the pure code free of
   * Date construction.
   */
  publishedOn: string;
}

/**
 * The source document handed to a parser. Exactly one extraction path is present:
 *  - `rows`: pre-extracted label→value pairs (the synthetic fixture, or an
 *    already-OCR'd report) — what `SyntheticRoverParser` consumes.
 *  - `pdf`:  raw consumer-report bytes — what the real `PdfRoverParser` will read.
 */
export interface RoverReportSource {
  ref: RoverApprovalRef;
  rows?: readonly RoverReportRow[];
  pdf?: Uint8Array;
}

/** A single label/value pair as it appears in (or is extracted from) the report. */
export interface RoverReportRow {
  label: string;
  value: string;
}

/**
 * One field the parser extracted from the document. `value` is canonical string
 * form, or null when the report does not state it (null = "not in the report",
 * never 0 / a guess — same invariant as the LLM path).
 */
export interface RoverParsedField {
  field: VehicleSpecFieldKey;
  value: string | null;
  /** The exact document label the value came from — the audit trail. */
  sourceLabel: string;
}

export interface RoverParseResult {
  vtaNumber: string;
  reportUrl: string;
  category: RoverCategory;
  fields: RoverParsedField[];
  /**
   * Extraction confidence 0..1 — feeds crawl-health monitoring (a parser that
   * suddenly returns low confidence is probably broken against a changed
   * document), NOT the promotion gate. A ROVER figure is trusted because it came
   * from the government document, not because the parser felt good about it.
   */
  extractionConfidence: number;
  /** Verbatim parser output (store raw, derive later). */
  raw: unknown;
}

/**
 * The pluggable extractor. Today: `SyntheticRoverParser` over `rows`. Tomorrow:
 * a pdfplumber-primary parser with the existing Tesseract + Qwen-VLM pipeline as
 * fallback, behind this same interface — callers don't change.
 */
export interface RoverReportParser {
  readonly id: string;
  parse(source: RoverReportSource): Promise<RoverParseResult>;
}
