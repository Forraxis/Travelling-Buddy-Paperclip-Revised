/**
 * Pure-Node PDF text extraction (unpdf → pdf.js under the hood). Kept separate
 * from the parsers so the parsing logic stays pure (text in, structured out) and
 * unit-testable without a PDF. The RVD/Approval-Notice parsers operate on the
 * returned text.
 *
 * unpdf runs in plain Node (no system poppler/python), so the worker is
 * single-runtime and deploys anywhere (the Qwen-VLM fallback is only for scans /
 * layouts that defeat text extraction — see VEHICLE_DATA_FETCH.md decision 1).
 */
import { extractText, getDocumentProxy } from 'unpdf';

export interface ExtractedPdf {
  text: string;
  totalPages: number;
}

export async function extractPdfText(data: Uint8Array): Promise<ExtractedPdf> {
  const pdf = await getDocumentProxy(data);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return {
    text: Array.isArray(text) ? text.join('\n') : text,
    totalPages,
  };
}
