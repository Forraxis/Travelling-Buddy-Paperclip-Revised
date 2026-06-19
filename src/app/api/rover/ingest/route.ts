/**
 * ROVER ingest webhook — the n8n target (VEHICLE_DATA_FETCH.md decision 8: "n8n
 * fetches, the parser extracts, the app gates"). n8n GETs a VTADetails page and
 * POSTs its HTML here; this route does the extraction + trust half:
 *
 *     extractRoverDocuments(html)         // regex the inline base64 PDFs out
 *       → extractPdfText / parseRvdText   // deterministic, no LLM in the number
 *       → parseApprovalNoticeText
 *         → ingestRvd(rvd, notice)        // archive + per-variant PENDING candidates
 *
 * SAFETY — the endpoint stays invisible until deliberately switched on:
 *   • ROVER_INGEST_TOKEN unset  → 404 (looks like it doesn't exist).
 *   • token set, bearer mismatch → 401.
 * Candidates land PENDING (no auto-promote — gate level is Tim's Rule-11 call).
 *
 * One VTADetails page embeds every RVD version inline; we archive the older ones
 * for history and ingest the latest (by generated date), mirroring the local
 * runner (src/jobs/rover-ingest-local.ts).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  extractRoverDocuments,
  extractPdfText,
  parseRvdText,
  parseApprovalNoticeText,
  storeRvdDocument,
  ingestRvd,
  type RvdDocument,
} from '@/lib/spec-fetch/rover';

interface IngestBody {
  detailHtml?: unknown;
}

export async function POST(req: Request) {
  // 1. Token gate — unset means "this endpoint does not exist".
  const token = process.env.ROVER_INGEST_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Body.
  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const detailHtml = body.detailHtml;
  if (typeof detailHtml !== 'string' || detailHtml.length === 0) {
    return NextResponse.json(
      { error: 'Body must include a non-empty `detailHtml` string.' },
      { status: 400 },
    );
  }

  // 3. Pull every inline PDF; we need at least one RVD to ingest.
  const docs = extractRoverDocuments(detailHtml);
  const rvdDocs = docs.filter((d) => d.docType === 'RVD');
  const noticeDoc = docs.find((d) => d.docType === 'APPROVAL_NOTICE');
  if (rvdDocs.length === 0) {
    return NextResponse.json(
      {
        error:
          'No Road Vehicle Descriptor found in the page. ' +
          `Documents seen: ${docs.map((d) => d.filename).join(', ') || 'none'}.`,
      },
      { status: 422 },
    );
  }

  try {
    // Parse every RVD version; newest (by generated date) drives candidates, the
    // older versions are archived for history (same policy as the local runner).
    const parsed: { filename: string; doc: RvdDocument }[] = [];
    for (const d of rvdDocs) {
      const { text } = await extractPdfText(d.bytes);
      parsed.push({ filename: d.filename, doc: parseRvdText(text) });
    }
    parsed.sort((a, b) =>
      (b.doc.generatedDate ?? '').localeCompare(a.doc.generatedDate ?? ''),
    );
    const [latest, ...older] = parsed;

    if (!latest.doc.vtaNumber) {
      return NextResponse.json(
        {
          error:
            'The Road Vehicle Descriptor has no VTA number — cannot ingest.',
        },
        { status: 422 },
      );
    }

    const notice = noticeDoc
      ? parseApprovalNoticeText((await extractPdfText(noticeDoc.bytes)).text)
      : null;

    for (const o of older) await storeRvdDocument(o.doc, o.filename);

    const result = await ingestRvd(latest.doc, notice, {
      rvd: latest.filename,
      notice: noticeDoc?.filename,
    });

    // Flip the skeleton index row to EXPANDED (whether this came from the crawl or
    // an on-demand expand) so the Data Hub reflects that its data has been fetched.
    await prisma.roverApprovalIndex.updateMany({
      where: { vtaNumber: result.vtaNumber },
      data: { expandState: 'EXPANDED' },
    });

    return NextResponse.json({
      ok: true,
      vtaNumber: result.vtaNumber,
      variantsCreated: result.variantsCreated,
      variantsRefreshed: result.variantsRefreshed,
      archivedRvdId: result.archivedRvdId,
      archivedNoticeId: result.archivedNoticeId,
      olderVersionsArchived: older.length,
      // Amendment classification vs the prior archived version (null on first
      // import): NO_FIGURE_CHANGE = admin re-issue (no candidate churn),
      // FIGURE_CHANGED carries the list of figures that moved for review.
      amendment: result.amendment,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Ingest failed' },
      { status: 500 },
    );
  }
}
