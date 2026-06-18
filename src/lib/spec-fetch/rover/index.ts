/**
 * ROVER ingestion — public surface. The "clean data" route (VEHICLE_DATA_FETCH.md
 * §3): the directory IS the list and each consumer report IS the data, parsed
 * deterministically (no LLM in the number) → auto-corroborated candidates.
 *
 * Scaffolded + synthetic-proven only. No live crawl runs until the real parser is
 * built against a sample and Tim approves (gate level + access).
 */
export * from './types';
export { fieldForLabel, extractNumeric } from './field-map';
export { SyntheticRoverParser, PdfRoverParser } from './parser';
export {
  RoverVerifier,
  draftGateableFields,
  type RoverCandidateField,
  type RoverCandidateDraft,
} from './verifier';
export { createRoverCandidate, type IngestRoverResult } from './ingest';
export {
  SyntheticRoverCrawler,
  type RoverDirectoryCrawler,
  type RoverHighWaterMark,
} from './crawl';
export { SYNTHETIC_APPROVAL_REF, SYNTHETIC_REPORT_ROWS } from './fixtures';

// ── Real document pipeline (RVD + Approval Notice) ──
export { extractPdfText, type ExtractedPdf } from './pdf';
export { parseRvdText, type RvdDocument, type RvdVariant } from './rvd-parser';
export {
  parseApprovalNoticeText,
  type ApprovalNotice,
} from './approval-notice-parser';
export { roverVariantFields, type RoverVariantField } from './variant-fields';
export {
  storeRvdDocument,
  storeApprovalNotice,
  type ArchiveResult,
} from './archive';
export { ingestRvd, type IngestRvdResult } from './ingest-rvd';
export {
  extractRoverDocuments,
  classifyRoverDoc,
  type RoverInlineDocument,
  type RoverDocType,
} from './extract-detail';
export {
  diffRvdFigures,
  type RvdFigureDiff,
  type RvdFigureChange,
  type RvdFigureChangeStatus,
} from './amendment';
