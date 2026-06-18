/**
 * Extract the inline PDF documents from a ROVER VTADetails page.
 *
 * The VTADetails page (`/PublishedApprovals/VTADetails/?id=<guid>`) is a Microsoft
 * Power Pages portal that embeds EVERY document inline as base64 — there is no
 * separate download URL. Each document is rendered as a button:
 *
 *     onclick="downloadPdfFile('<base64 PDF bytes>', '<filename>.pdf')"
 *
 * so "download" = regex the calls out of the HTML and `Buffer.from(b64,'base64')`.
 * One detail-page GET yields the Approval Notice + every RVD version + Letter of
 * advice, all inline (see VEHICLE_DATA_FETCH.md "ROVER portal crawl mechanism").
 *
 * Pure (HTML in → bytes out): no network, trivially unit-testable. n8n does the
 * actual GET and POSTs the HTML to /api/rover/ingest, which calls this.
 *
 * Each document has BOTH a desktop and a mobile button (identical base64), so we
 * dedupe by filename — the same file must not be parsed twice.
 */

export type RoverDocType = 'RVD' | 'APPROVAL_NOTICE' | 'OTHER';

export interface RoverInlineDocument {
  filename: string;
  docType: RoverDocType;
  bytes: Uint8Array;
}

// Single-quoted call: downloadPdfFile('<base64>', '<name>.pdf'). The base64 blob
// is a long, unbroken [A-Za-z0-9+/=] run; the filename is any non-quote text
// ending in .pdf (case-insensitive). Whitespace between the args is tolerated.
const DOWNLOAD_CALL =
  /downloadPdfFile\(\s*'([A-Za-z0-9+/=]+)'\s*,\s*'([^']+?\.pdf)'\s*\)/gi;

/** Classify by filename — the ROVER document titles are stable. */
export function classifyRoverDoc(filename: string): RoverDocType {
  const lower = filename.toLowerCase();
  if (lower.includes('road vehicle descriptor')) return 'RVD';
  if (lower.includes('approval notice')) return 'APPROVAL_NOTICE';
  return 'OTHER';
}

/**
 * Pull every inline PDF out of a VTADetails HTML page, deduped by filename.
 * Returns them in first-seen order (the desktop button comes first in the markup).
 */
export function extractRoverDocuments(html: string): RoverInlineDocument[] {
  const seen = new Set<string>();
  const docs: RoverInlineDocument[] = [];

  for (const match of html.matchAll(DOWNLOAD_CALL)) {
    const base64 = match[1];
    const filename = match[2].trim();
    if (seen.has(filename)) continue; // desktop + mobile button → same file
    seen.add(filename);
    docs.push({
      filename,
      docType: classifyRoverDoc(filename),
      bytes: new Uint8Array(Buffer.from(base64, 'base64')),
    });
  }

  return docs;
}
