/**
 * ROVER report parsers, behind the `RoverReportParser` interface.
 *
 *  - `SyntheticRoverParser` — consumes pre-extracted label/value rows. Drives the
 *    tests and the gated crawl skeleton end-to-end with NO real document, so the
 *    candidate-creation + auto-corroboration + dedupe wiring is proven now.
 *  - `PdfRoverParser` — the real path (pdfplumber-primary, Tesseract + Qwen-VLM
 *    fallback). A STUB that throws until a real consumer-report sample lands in
 *    fixtures/rover/ — implement it against the actual document shape then.
 *
 * Both obey null-not-guess: a label we map but whose cell has no number yields a
 * null-valued field (recorded as "the report doesn't state it"), never 0.
 */
import { SPEC_FIELD_BY_KEY } from '../fields';
import { extractNumeric, fieldForLabel } from './field-map';
import type {
  RoverParseResult,
  RoverParsedField,
  RoverReportParser,
  RoverReportSource,
} from './types';

export class SyntheticRoverParser implements RoverReportParser {
  readonly id = 'synthetic-rover-parser';

  async parse(source: RoverReportSource): Promise<RoverParseResult> {
    const { ref, rows } = source;
    if (!rows) {
      throw new Error(
        'SyntheticRoverParser requires pre-extracted `rows`; got a source with ' +
          'none (a real PDF needs PdfRoverParser, which is not implemented yet).',
      );
    }

    // First mapped row per field wins; later duplicates are ignored so a footnote
    // restating a figure can't overwrite the primary cell.
    const seen = new Set<string>();
    const fields: RoverParsedField[] = [];
    for (const row of rows) {
      const field = fieldForLabel(row.label);
      if (!field || seen.has(field)) continue;
      seen.add(field);

      const def = SPEC_FIELD_BY_KEY[field];
      const value =
        def?.kind === 'enum'
          ? row.value.trim().toUpperCase() || null
          : extractNumeric(row.value);
      fields.push({ field, value, sourceLabel: row.label });
    }

    // Confidence here is structural: how many of the report's mapped rows yielded a
    // value. The real parser will derive this from table-detection quality; the
    // synthetic one reports a high baseline so the crawl-health floor isn't tripped.
    const withValue = fields.filter((f) => f.value !== null).length;
    const extractionConfidence =
      fields.length === 0 ? 0 : withValue / fields.length;

    return {
      vtaNumber: ref.vtaNumber,
      reportUrl: ref.reportUrl,
      category: ref.category,
      fields,
      extractionConfidence,
      raw: { parser: this.id, rows },
    };
  }
}

export class PdfRoverParser implements RoverReportParser {
  readonly id = 'pdf-rover-parser';

  async parse(_source: RoverReportSource): Promise<RoverParseResult> {
    void _source;
    throw new Error(
      'PdfRoverParser is not implemented yet — drop a real ROVER consumer-report ' +
        'PDF into fixtures/rover/ and implement the deterministic table parse ' +
        '(pdfplumber primary, Tesseract + Qwen-VLM fallback) against its actual ' +
        'layout. Until then the synthetic-rows path proves the ingestion wiring.',
    );
  }
}
