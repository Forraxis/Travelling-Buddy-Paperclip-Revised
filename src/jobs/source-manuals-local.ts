/**
 * Owner's-manual URL discovery (POC). [task #6/#11 — manual sourcing]
 *
 * Step 1 of the manual pipeline, run TIGHT and small: for a handful of hot-set tow
 * rigs, use Claude + web_search to resolve a direct, downloadable owner's-manual PDF
 * URL (the AU-market manual that should carry the Weights/axle section). It does NOT
 * download anything (that's the n8n/VPN step) — it only finds + reports the URLs so we
 * can eyeball whether discovery actually works before scaling or spending on download.
 *
 * Output per vehicle: the PDF URL, whether it's a direct .pdf vs a portal page, the
 * source (OEM vs aggregator), where the axle/weights data is, and a confidence — plus
 * the search cost. Nothing is written to the DB.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=… npx tsx src/jobs/source-manuals-local.ts          # default 5 targets
 *   …--targets="Toyota HiLux 2024,Ford Ranger 2024"                       # custom list
 *
 * Cost: ~$0.05–0.15 / vehicle (a few searches each, capped).
 */
import { appendFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const OUT = '/tmp/rover-run/manual-urls.jsonl';
const arg = process.argv.find((a) => a.startsWith('--targets='));
const TARGETS = (
  arg?.slice('--targets='.length) ??
  // The core tow utes whose axle limits web-grounding could NOT find — the ones a
  // manual is the right source for.
  'Toyota HiLux 2024,Ford Ranger 2024,Nissan Navara 2024,Isuzu D-Max 2024,Mitsubishi Triton 2024'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MODEL = 'claude-opus-4-8';
const MAX_SEARCH = 4;

const RECORD = {
  name: 'record_manual',
  description:
    'Record the best owner-manual PDF you found for this vehicle (AU market).',
  input_schema: {
    type: 'object',
    properties: {
      manualUrl: {
        type: ['string', 'null'],
        description:
          'Direct URL to the owner-manual PDF, or null if none found.',
      },
      isDirectPdf: {
        type: ['boolean', 'null'],
        description:
          'true if manualUrl is a direct .pdf download, false if a portal/landing page.',
      },
      source: {
        type: ['string', 'null'],
        description:
          'OEM (manufacturer site) or AGGREGATOR (ManualsLib etc.) or OTHER.',
      },
      carriesAxle: {
        type: ['string', 'null'],
        description:
          'Does the manual state front/rear axle limits? YES / NO / UNKNOWN, with the section name if known.',
      },
      confidence: {
        type: ['string', 'null'],
        enum: ['HIGH', 'MEDIUM', 'LOW', null],
      },
      notes: { type: ['string', 'null'] },
    },
    required: ['manualUrl'],
    additionalProperties: false,
  },
} as const;

async function findManual(
  client: Anthropic,
  target: string,
): Promise<{ result: unknown; cost: number }> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `Find the official Australian-market OWNER'S MANUAL (PDF) for the ${target}. ` +
        `Prefer a direct .pdf link from the manufacturer; a reputable aggregator (ManualsLib etc.) is acceptable. ` +
        `The goal is the manual section that lists vehicle WEIGHTS — GVM, GCM, and especially FRONT/REAR AXLE capacity. ` +
        `Use web_search, then call record_manual with the best URL you found (null if none). Do not answer in prose.`,
    },
  ];
  let recordInput: unknown = null;
  let inTok = 0,
    outTok = 0,
    searches = 0;
  for (let turn = 0; turn < 3 && recordInput === null; turn += 1) {
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
      recordInput = rec.input;
      break;
    }
    messages.push({ role: 'assistant', content: resp.content });
    if (resp.stop_reason !== 'pause_turn') {
      messages.push({
        role: 'user',
        content: 'Now call record_manual with what you found.',
      });
    }
  }
  const cost = (inTok / 1e6) * 5 + (outTok / 1e6) * 25 + searches * 0.01;
  return { result: recordInput, cost };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required.');
  }
  const client = new Anthropic({ timeout: 180_000, maxRetries: 2 });
  console.log(
    `\n=== MANUAL URL DISCOVERY (${TARGETS.length} targets, model=${MODEL}) ===\n`,
  );
  let spent = 0;
  for (const t of TARGETS) {
    process.stdout.write(`→ ${t} … `);
    try {
      const { result, cost } = await findManual(client, t);
      spent += cost;
      const r = (result ?? {}) as Record<string, unknown>;
      // Append immediately so progress/results survive a buffered-stdout kill.
      appendFileSync(
        OUT,
        JSON.stringify({ target: t, cost: Number(cost.toFixed(3)), ...r }) +
          '\n',
      );
      console.log(`$${cost.toFixed(3)}`);
      console.log(`    url:    ${r.manualUrl ?? '— none found —'}`);
      console.log(
        `    type:   ${r.isDirectPdf ? 'direct PDF' : 'portal/page'} · source: ${r.source ?? '?'} · axle: ${r.carriesAxle ?? '?'} · conf: ${r.confidence ?? '?'}`,
      );
      if (r.notes) console.log(`    notes:  ${r.notes}`);
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
    }
    console.log('');
  }
  console.log(`Total ≈ $${spent.toFixed(2)} for ${TARGETS.length} lookups.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
