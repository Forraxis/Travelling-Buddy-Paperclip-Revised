/**
 * SYNTHETIC ROVER fixture — NOT REAL DATA.
 *
 * These rows are an invented stand-in for a consumer report's table, shaped to
 * exercise the parser + verifier + ingest wiring end-to-end before a real sample
 * exists. The VTA number is fictitious and the figures are illustrative only —
 * nothing here may be promoted as authoritative. When a real 2021+ consumer-report
 * PDF lands in fixtures/rover/, build the PdfRoverParser against it and retire this
 * as a pure unit-test fixture.
 *
 * The label wording deliberately varies (GVM spelled out, "Tare", "Braked towing
 * capacity", a "N/A" cell, a non-mapped row) so the field-map + null-not-guess
 * paths are both covered.
 */
import type { RoverApprovalRef, RoverReportRow } from './types';

/** Fictitious approval reference — a synthetic NA-category dual-cab ute. */
export const SYNTHETIC_APPROVAL_REF: RoverApprovalRef = {
  vtaNumber: 'VTA-SYNTHETIC-0001',
  reportUrl: 'https://rover.example.invalid/consumer-report/VTA-SYNTHETIC-0001',
  category: 'NA',
  makeName: 'Synthetic',
  modelName: 'TestUte',
  variantName: 'XLT (synthetic)',
  yearFrom: 2022,
  yearTo: null,
  bodyType: 'DUAL_CAB_UTE',
  publishedOn: '2022-03-15',
};

/** Synthetic consumer-report rows (label → value), as a parser would extract them. */
export const SYNTHETIC_REPORT_ROWS: readonly RoverReportRow[] = [
  { label: 'Gross Vehicle Mass (GVM)', value: '3,230 kg' },
  { label: 'Gross Combination Mass (GCM)', value: '6,400 kg' },
  { label: 'Front axle maximum mass', value: '1,480 kg' },
  { label: 'Rear axle maximum mass', value: '1,950 kg' },
  { label: 'Maximum braked towing capacity', value: '3,500 kg' },
  { label: 'Maximum tow-ball download', value: '350 kg' },
  { label: 'Tare mass', value: '2,250 kg' },
  { label: 'Fuel type', value: 'Diesel' },
  // A stated-but-empty cell → must become a null field, not 0.
  { label: 'Fuel tank capacity', value: 'N/A' },
  // A row we don't map → ignored, never invents a field.
  { label: 'ANCAP safety rating', value: '5 stars' },
];
