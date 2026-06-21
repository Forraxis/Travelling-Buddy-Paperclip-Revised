/**
 * Verified manual discovery → extract → save. [manual sourcing — the integrated loop]
 *
 * The whole pipe for a small batch of vehicles, with the cost gates Tim specified:
 *   Claude web_search finds an owner's-manual PDF URL
 *     → VERIFY it free (HTTP 200 + real PDF)        — a 404/portal/HTML never costs more
 *     → download + PRE-SCREEN + extract + validate  — free, on .150
 *     → if axles found + GVM matches our known      — SAVE to VariantSpecProvenance
 *   ↑ up to MAX_ATTEMPTS Claude tries per vehicle (a bad URL → ask for another), then move on.
 *
 * SAVE is Rule-11-safe: extracted axles land as source=MANUAL / status=ESTIMATE on the
 * matched variant (NOT auto-promoted to CONFIRMED — that's Tim's sign-off), non-clobbering,
 * with the manual URL as provenance. NO catalogue columns are touched, no gate is lifted.
 *
 * NO REDO: every vehicle's outcome is cached to ops/n8n/.manual-discovery.jsonl; a re-run
 * skips vehicles with a terminal outcome, so we never re-pay Claude for a done vehicle.
 *
 * Egress note: Claude web_search runs on Anthropic's side; the URL verify + PDF download
 * happen in-here (home IP) per Tim's call for these benign OEM/aggregator fetches.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=… DATABASE_URL=… npx tsx src/jobs/discover-manuals-local.ts          # dry-run (no save/spend)
 *   ANTHROPIC_API_KEY=… DATABASE_URL=… npx tsx src/jobs/discover-manuals-local.ts --write   # discover + spend + save
 *   …--slugs=hilux,ranger,d-max,triton,navara   # which models (default these 5)
 *   …--budget=5                                  # hard USD ceiling
 */
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import type { SpecProvenanceSource } from '@prisma/client';
import { prisma } from '../lib/db';
import { extractManualSpecs } from '../lib/spec-fetch/manual/extract';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const SLUGS = (
  args.find((a) => a.startsWith('--slugs='))?.slice('--slugs='.length) ??
  'hilux,ranger,d-max,triton,navara'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const BUDGET = Number(
  args.find((a) => a.startsWith('--budget='))?.slice('--budget='.length) ?? '5',
);

const MODEL = 'claude-opus-4-8';
const MAX_ATTEMPTS = 2; // Claude tries per vehicle before giving up
const MAX_SEARCH = 3;
const FETCH_TIMEOUT_MS = 25_000; // a real OEM PDF downloads fast; slow = skip
const CACHE = 'ops/n8n/.manual-discovery.jsonl';
const PROGRESS = 'ops/n8n/.manual-progress.log';

/** Append a progress line immediately (survives buffered-stdout kills) + echo. */
function progress(msg: string): void {
  try {
    appendFileSync(PROGRESS, `${new Date().toISOString()}  ${msg}\n`);
  } catch {
    /* ignore */
  }
  console.log(msg);
}
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

interface Target {
  variantId: string;
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  knownGvm: number;
}

const RECORD = {
  name: 'record_manual',
  description:
    "Record the best owner's-manual PDF URL you actually found via search.",
  input_schema: {
    type: 'object',
    properties: {
      manualUrl: {
        type: ['string', 'null'],
        description:
          "A DIRECT, downloadable .pdf URL to the OWNER'S manual (not a workshop/service/repair manual, not a spec brochure, not a portal page). null if you could not find/verify one.",
      },
      notes: { type: ['string', 'null'] },
    },
    required: ['manualUrl'],
    additionalProperties: false,
  },
} as const;

/** One Claude call: find a candidate owner's-manual PDF URL, avoiding tried ones. */
async function askClaude(
  client: Anthropic,
  t: Target,
  tried: string[],
): Promise<{ url: string | null; cost: number }> {
  const avoid = tried.length
    ? ` Do NOT return any of these (already tried, dead or wrong): ${tried.join(' , ')}.`
    : '';
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `Find a DIRECT, downloadable PDF of the official Australian OWNER'S MANUAL for the ` +
        `${t.yearFrom} ${t.make} ${t.model}. It must be the owner's manual (the glovebox booklet) — ` +
        `NOT a workshop/service/repair manual, NOT a spec sheet/brochure — and contain the ` +
        `"Vehicle specifications / Weights" section (GVM, GCM, front/rear axle capacity). ` +
        `Only return a URL you actually opened via web_search and confirmed resolves to a .pdf.${avoid} ` +
        `Then call record_manual (manualUrl=null if you cannot confirm one). Do not answer in prose.`,
    },
  ];
  let url: string | null = null;
  let inTok = 0,
    outTok = 0,
    searches = 0;
  for (let turn = 0; turn < 3 && url === null; turn += 1) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [
        {
          type: 'web_search_20260209',
          name: 'web_search',
          max_uses: MAX_SEARCH,
        },
        RECORD,
      ] as unknown as Anthropic.ToolUnion[],
      tool_choice:
        turn >= 1 ? { type: 'tool', name: 'record_manual' } : { type: 'auto' },
      messages,
    });
    inTok += resp.usage.input_tokens ?? 0;
    outTok += resp.usage.output_tokens ?? 0;
    searches += resp.usage.server_tool_use?.web_search_requests ?? 0;
    const rec = resp.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'record_manual',
    );
    if (rec) {
      const v = (rec.input as { manualUrl?: unknown }).manualUrl;
      url = typeof v === 'string' && v.startsWith('http') ? v : null;
      break;
    }
    messages.push({ role: 'assistant', content: resp.content });
    if (resp.stop_reason !== 'pause_turn')
      messages.push({ role: 'user', content: 'Call record_manual now.' });
  }
  const cost = (inTok / 1e6) * 5 + (outTok / 1e6) * 25 + searches * 0.01;
  return { url, cost };
}

/** Verify + download in one fetch. Returns the bytes only if it's a real PDF. */
async function fetchPdf(url: string): Promise<{
  ok: boolean;
  status: number;
  isPdf: boolean;
  bytes?: Uint8Array;
  note: string;
}> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!r.ok)
      return {
        ok: false,
        status: r.status,
        isPdf: false,
        note: `http ${r.status}`,
      };
    const ct = (r.headers.get('content-type') ?? '').toLowerCase();
    const buf = new Uint8Array(await r.arrayBuffer());
    const magic = Buffer.from(buf.slice(0, 5)).toString('latin1');
    const isPdf = ct.includes('pdf') || magic === '%PDF-';
    if (!isPdf)
      return {
        ok: true,
        status: r.status,
        isPdf: false,
        note: `not a pdf (${ct || 'no ct'})`,
      };
    return {
      ok: true,
      status: r.status,
      isPdf: true,
      bytes: buf,
      note: `pdf ${buf.length}b`,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      isPdf: false,
      note: (e as Error).message.slice(0, 80),
    };
  }
}

async function loadTargets(): Promise<Target[]> {
  const out: Target[] = [];
  for (const slug of SLUGS) {
    const m = await prisma.vehicleModel.findFirst({
      where: { slug },
      select: {
        name: true,
        make: { select: { name: true } },
        variants: {
          where: { gvmKg: { not: null } },
          orderBy: { yearTo: 'desc' },
          take: 1,
          select: { id: true, yearFrom: true, yearTo: true, gvmKg: true },
        },
      },
    });
    const v = m?.variants[0];
    if (m && v && v.gvmKg != null)
      out.push({
        variantId: v.id,
        make: m.make.name,
        model: m.name,
        yearFrom: v.yearFrom,
        yearTo: v.yearTo,
        knownGvm: v.gvmKg,
      });
  }
  return out;
}

function cachedTerminal(): Set<string> {
  const done = new Set<string>();
  if (!existsSync(CACHE)) return done;
  for (const line of readFileSync(CACHE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as { variantId: string };
      done.add(r.variantId);
    } catch {
      /* skip */
    }
  }
  return done;
}

async function saveAxles(
  t: Target,
  specs: { frontAxleLimitKg: number | null; rearAxleLimitKg: number | null },
  url: string,
): Promise<number> {
  let wrote = 0;
  const fields: [string, number | null][] = [
    ['frontAxleLimitKg', specs.frontAxleLimitKg],
    ['rearAxleLimitKg', specs.rearAxleLimitKg],
  ];
  for (const [field, value] of fields) {
    if (value == null) continue;
    const existing = await prisma.variantSpecProvenance.findUnique({
      where: { variantId_field: { variantId: t.variantId, field } },
      select: { source: true },
    });
    // Don't clobber a higher-trust source; refresh our own MANUAL/CLAUDE estimates.
    if (
      existing &&
      existing.source !== 'MANUAL' &&
      existing.source !== 'CLAUDE'
    )
      continue;
    await prisma.variantSpecProvenance.upsert({
      where: { variantId_field: { variantId: t.variantId, field } },
      create: {
        variantId: t.variantId,
        field,
        value: String(value),
        source: 'MANUAL' as SpecProvenanceSource,
        status: 'ESTIMATE',
        sourceUrl: url,
        notes:
          'owner-manual VLM extract (docling+qwen) — pending Rule-11 sign-off',
      },
      update: { value: String(value), sourceUrl: url, asOf: new Date() },
    });
    wrote += 1;
  }
  return wrote;
}

async function main() {
  const targets = await loadTargets();
  const done = cachedTerminal();
  console.log(
    `\n=== MANUAL DISCOVERY (${WRITE ? 'WRITE' : 'dry-run'}) · ${targets.length} targets ===`,
  );
  for (const t of targets)
    console.log(
      `  ${t.make} ${t.model} ${t.yearFrom}-${t.yearTo} (known GVM ${t.knownGvm})${done.has(t.variantId) ? '  ✓cached' : ''}`,
    );
  if (!WRITE) {
    console.log(
      `\n(dry-run — pass --write with ANTHROPIC_API_KEY to discover + save. Budget $${BUDGET}.)`,
    );
    await prisma.$disconnect();
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY)
    throw new Error('ANTHROPIC_API_KEY required for --write');

  const client = new Anthropic({ timeout: 180_000, maxRetries: 2 });
  let spent = 0;
  for (const t of targets) {
    if (done.has(t.variantId)) continue;
    if (spent >= BUDGET) {
      console.log(
        `\n⚠ budget $${BUDGET} reached — stopping (re-run to resume).`,
      );
      break;
    }
    progress(`→ ${t.make} ${t.model} ${t.yearFrom} (known GVM ${t.knownGvm})`);
    const tried: string[] = [];
    const attempts: {
      url: string;
      status: number;
      isPdf: boolean;
      verdict?: string;
    }[] = [];
    let finalVerdict = 'NO_URL';
    let savedFields = 0;

    for (let a = 0; a < MAX_ATTEMPTS && spent < BUDGET; a += 1) {
      progress(`   attempt ${a + 1}: asking Claude…`);
      const { url, cost } = await askClaude(client, t, tried);
      spent += cost;
      if (!url) {
        progress(
          `   attempt ${a + 1}: no URL ($${cost.toFixed(3)} · running $${spent.toFixed(2)})`,
        );
        break;
      }
      tried.push(url);
      progress(
        `   attempt ${a + 1}: ${url}  (claude $${cost.toFixed(3)} · running $${spent.toFixed(2)})`,
      );
      const f = await fetchPdf(url);
      progress(`     verify → ${f.note}`);
      const rec: (typeof attempts)[number] = {
        url,
        status: f.status,
        isPdf: f.isPdf,
      };
      if (!f.isPdf || !f.bytes) {
        attempts.push(rec);
        continue; // bad URL — ask Claude for another
      }
      const res = await extractManualSpecs(f.bytes, { gvmKg: t.knownGvm });
      rec.verdict = res.verdict;
      attempts.push(rec);
      finalVerdict = res.verdict;
      progress(
        `     extract: verdict=${res.verdict} gvm=${res.specs.gvmKg ?? '—'} axleF/R=${res.specs.frontAxleLimitKg ?? '—'}/${res.specs.rearAxleLimitKg ?? '—'}`,
      );
      if (res.verdict === 'CONFIRMED' || res.verdict === 'REVIEW') {
        savedFields = await saveAxles(t, res.specs, url);
        progress(
          `     ✓ saved ${savedFields} axle field(s) → VariantSpecProvenance (MANUAL/ESTIMATE)`,
        );
        break; // got the data — done with this vehicle
      }
      // NO_AXLE / NO_WEIGHTS / EMPTY / REJECT → try another source
    }

    appendFileSync(
      CACHE,
      JSON.stringify({
        variantId: t.variantId,
        make: t.make,
        model: t.model,
        year: t.yearFrom,
        finalVerdict,
        savedFields,
        attempts,
        at: new Date().toISOString(),
      }) + '\n',
    );
  }

  console.log(
    `\n=== done. total ≈ $${spent.toFixed(2)} spent. cache: ${CACHE} ===`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
