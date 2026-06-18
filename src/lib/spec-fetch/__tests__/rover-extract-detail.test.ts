import { describe, it, expect } from 'vitest';
import {
  extractRoverDocuments,
  classifyRoverDoc,
} from '../rover/extract-detail';

/** Encode some bytes the way the ROVER page does — base64 of the raw PDF. */
function b64(content: string): string {
  return Buffer.from(content).toString('base64');
}

/**
 * Synthetic VTADetails markup. Each document appears TWICE (a desktop button and
 * a mobile button with identical base64), exactly like the real portal — the
 * extractor must dedupe by filename.
 */
function fixtureHtml(): string {
  const rvd = b64('%PDF-1.4 fake RVD bytes');
  const notice = b64('%PDF-1.4 fake Approval Notice bytes');
  const letter = b64('%PDF-1.4 fake Letter of advice bytes');
  const file = (b: string, name: string) =>
    `<button onclick="downloadPdfFile('${b}', '${name}')">Download</button>`;
  return `
    <div class="desktop">
      ${file(rvd, 'Road Vehicle Descriptor - VTA-047155 20250701.pdf')}
      ${file(notice, 'Approval Notice - VTA-047155.pdf')}
      ${file(letter, 'Letter of advice - VTA-047155.pdf')}
    </div>
    <div class="mobile">
      ${file(rvd, 'Road Vehicle Descriptor - VTA-047155 20250701.pdf')}
      ${file(notice, 'Approval Notice - VTA-047155.pdf')}
      ${file(letter, 'Letter of advice - VTA-047155.pdf')}
    </div>
  `;
}

describe('classifyRoverDoc', () => {
  it('classifies by the stable document title', () => {
    expect(
      classifyRoverDoc('Road Vehicle Descriptor - VTA-047155 20250701.pdf'),
    ).toBe('RVD');
    expect(classifyRoverDoc('Approval Notice - VTA-047155.pdf')).toBe(
      'APPROVAL_NOTICE',
    );
    expect(classifyRoverDoc('Letter of advice - VTA-047155.pdf')).toBe('OTHER');
  });

  it('is case-insensitive', () => {
    expect(classifyRoverDoc('ROAD VEHICLE DESCRIPTOR - x.pdf')).toBe('RVD');
  });
});

describe('extractRoverDocuments', () => {
  it('dedupes the desktop + mobile buttons down to one doc per filename', () => {
    const docs = extractRoverDocuments(fixtureHtml());
    expect(docs).toHaveLength(3);
    expect(docs.map((d) => d.filename)).toEqual([
      'Road Vehicle Descriptor - VTA-047155 20250701.pdf',
      'Approval Notice - VTA-047155.pdf',
      'Letter of advice - VTA-047155.pdf',
    ]);
  });

  it('classifies each document and decodes the base64 back to the PDF bytes', () => {
    const docs = extractRoverDocuments(fixtureHtml());
    const rvd = docs.find((d) => d.docType === 'RVD');
    expect(rvd).toBeDefined();
    expect(Buffer.from(rvd!.bytes).toString('utf8')).toBe(
      '%PDF-1.4 fake RVD bytes',
    );
    // The %PDF- magic survives the base64 round-trip (JVBERi0 = "%PDF-").
    expect(Buffer.from(rvd!.bytes).toString('utf8').startsWith('%PDF-')).toBe(
      true,
    );
    expect(docs.find((d) => d.docType === 'APPROVAL_NOTICE')).toBeDefined();
    expect(docs.find((d) => d.docType === 'OTHER')).toBeDefined();
  });

  it('tolerates whitespace between the call arguments', () => {
    const html = `downloadPdfFile(  '${b64('%PDF-x')}' ,  'Road Vehicle Descriptor - x.pdf' )`;
    const docs = extractRoverDocuments(html);
    expect(docs).toHaveLength(1);
    expect(docs[0].docType).toBe('RVD');
  });

  it('returns nothing for a page with no download calls', () => {
    expect(extractRoverDocuments('<div>no documents here</div>')).toEqual([]);
  });
});
