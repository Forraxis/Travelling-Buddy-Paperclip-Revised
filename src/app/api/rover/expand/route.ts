/**
 * ROVER expand-on-select trigger — the admin-driven counterpart to the weekly
 * crawl (ops/n8n/rover-crawl.json). An admin picks an UNFETCHED index row in the
 * Data Hub and asks for it to be expanded *now*; this route looks the row up and
 * fires the n8n "rover-expand" webhook, which (on the VPN / AU egress) does the
 * actual ROVER VTADetails fetch and POSTs the HTML back to /api/rover/ingest.
 *
 * CRITICAL: the app NEVER fetches rover.infrastructure.gov.au itself — that would
 * egress via the wrong IP. We only TRIGGER n8n. If the webhook URL is unconfigured
 * we 503 (we do not fall back to a direct fetch).
 *
 * Idempotent:
 *   • already EXPANDED  → ok, alreadyExpanded:true (no trigger).
 *   • SKIPPED           → 409 (intentionally not expanded; un-skip first).
 *   • UNFETCHED         → trigger n8n, return triggered:true.
 */
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/modules/admin/lib/auth';
import { prisma } from '@/lib/db';

interface ExpandBody {
  approvalId?: unknown;
  vtaNumber?: unknown;
}

export async function POST(req: Request) {
  // 1. Admin/moderator only.
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Body — need either an approvalId or a vtaNumber to find the row.
  let body: ExpandBody;
  try {
    body = (await req.json()) as ExpandBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const approvalId =
    typeof body.approvalId === 'string' && body.approvalId.trim()
      ? body.approvalId.trim()
      : null;
  const vtaNumber =
    typeof body.vtaNumber === 'string' && body.vtaNumber.trim()
      ? body.vtaNumber.trim()
      : null;
  if (!approvalId && !vtaNumber) {
    return NextResponse.json(
      { error: 'Body must include `approvalId` or `vtaNumber`.' },
      { status: 400 },
    );
  }

  // 3. Look up the index row (vtaNumber is unique; otherwise by approvalId).
  const row = vtaNumber
    ? await prisma.roverApprovalIndex.findUnique({ where: { vtaNumber } })
    : await prisma.roverApprovalIndex.findFirst({
        where: { approvalId: approvalId! },
      });
  if (!row) {
    return NextResponse.json(
      { error: 'No ROVER index row found for that approval.' },
      { status: 404 },
    );
  }

  // 4. Idempotency / state gate.
  if (row.expandState === 'EXPANDED') {
    return NextResponse.json({
      ok: true,
      vtaNumber: row.vtaNumber,
      triggered: false,
      alreadyExpanded: true,
    });
  }
  if (row.expandState === 'SKIPPED') {
    return NextResponse.json(
      {
        error:
          'This approval is marked SKIPPED (intentionally not expanded). ' +
          'Un-skip it before expanding.',
      },
      { status: 409 },
    );
  }

  // 5. Trigger n8n — never fetch ROVER from the app.
  const webhookUrl = process.env.ROVER_EXPAND_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      {
        error:
          'Expand webhook not configured (ROVER_EXPAND_WEBHOOK_URL is unset). ' +
          'The app cannot fetch ROVER directly — it must trigger n8n.',
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvalId: row.approvalId,
        vtaNumber: row.vtaNumber,
        // n8n blocks $env in Code nodes, so the app supplies the config it reads from
        // its own process.env — this keeps the n8n workflow secret-free.
        appBaseUrl:
          process.env.APP_BASE_URL ??
          process.env.NEXT_PUBLIC_SITE_URL ??
          'https://tbr.dev.ragebots.me',
        ingestToken: process.env.ROVER_INGEST_TOKEN,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      return NextResponse.json(
        {
          error: `Expand webhook returned ${res.status}.`,
          detail: detail || undefined,
        },
        { status: 502 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: 'Failed to reach the expand webhook.',
        detail: e instanceof Error ? e.message : undefined,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    vtaNumber: row.vtaNumber,
    approvalId: row.approvalId,
    triggered: true,
  });
}
