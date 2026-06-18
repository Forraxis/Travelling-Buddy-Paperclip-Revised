/**
 * @deprecated Superseded by the real RVD pipeline + n8n ingest path
 *   (`rvd-parser.ts` / `variant-fields.ts` / `ingest-rvd.ts` → `POST /api/rover/ingest`).
 *   Retained for reference only — no longer registered or run. NOTE: the
 *   `draftGateableFields` export is still imported by `rover-variant-fields.test.ts`;
 *   keep it until that test is migrated. See ROVER_OVERNIGHT_BUILD.md Phase 4.
 *
 * RoverVerifier — the ingestion module behind the parser interface.
 *
 * Parses a consumer report (via whichever `RoverReportParser` it's given) and
 * turns the result into a candidate draft whose present fields are **auto-
 * corroborated**. This is the crux of the ROVER trust model (VEHICLE_DATA_FETCH.md
 * §1): a figure parsed directly from a structured authoritative document came from
 * the source with no LLM transcription step, so it satisfies the compliance-critical
 * promotion gate without an admin tick — unlike anything a model *states*.
 *
 * Pure: no DB, no network. `createRoverCandidate` (./ingest) persists the draft.
 */
import { isComplianceCriticalField } from '../fields';
import type { VehicleSpecFieldKey } from '../types';
import type { GateableField } from '../gating';
import type {
  RoverApprovalRef,
  RoverReportParser,
  RoverReportSource,
} from './types';

export interface RoverCandidateField {
  field: VehicleSpecFieldKey;
  /** Canonical string value, or null when the report doesn't state it. */
  value: string | null;
  /** The consumer-report URL — every ROVER field is sourced to its document. */
  sourceUrl: string;
  /** The exact document label the value came from (audit trail). */
  sourceLabel: string;
  isComplianceCritical: boolean;
  /**
   * Auto-corroborated when a value is present: the number was parsed from the
   * government document, not transcribed by a model. A null field carries no
   * corroboration (there's nothing to trust).
   */
  corroborated: boolean;
}

export interface RoverCandidateDraft {
  ref: RoverApprovalRef;
  parserId: string;
  extractionConfidence: number;
  fields: RoverCandidateField[];
  raw: unknown;
}

export class RoverVerifier {
  constructor(private readonly parser: RoverReportParser) {}

  async verify(source: RoverReportSource): Promise<RoverCandidateDraft> {
    const result = await this.parser.parse(source);

    const fields: RoverCandidateField[] = result.fields.map((f) => ({
      field: f.field,
      value: f.value,
      sourceUrl: result.reportUrl,
      sourceLabel: f.sourceLabel,
      isComplianceCritical: isComplianceCriticalField(f.field),
      // Structured-parse auto-corroboration — present value only.
      corroborated: f.value !== null,
    }));

    return {
      ref: source.ref,
      parserId: this.parser.id,
      extractionConfidence: result.extractionConfidence,
      fields,
      raw: result.raw,
    };
  }
}

/**
 * Project a draft's fields onto the promotion-gate shape. A ROVER draft passes the
 * gate with no override because its critical fields are auto-corroborated — this
 * helper lets the gate be asserted in tests + the ingest path without duplicating
 * the mapping.
 */
export function draftGateableFields(
  draft: RoverCandidateDraft,
): GateableField[] {
  return draft.fields.map((f) => ({
    field: f.field,
    value: f.value,
    corroborated: f.corroborated,
  }));
}
