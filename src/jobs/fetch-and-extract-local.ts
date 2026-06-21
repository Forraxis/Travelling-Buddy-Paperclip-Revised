/**
 * Step 2 client: n8n VPN download → local extract core. [manual sourcing]
 *
 * Ties the two halves together: POST a manual/spec PDF URL to the n8n `manual-fetch`
 * webhook (which downloads it through the VPN, NOT this box), then run the returned
 * bytes through the free local extract core (docling → Qwen → validate). Egress stays
 * on the VPN; extraction stays free on .150.
 *
 * If the URL turns out to be an HTML/portal page (not a direct PDF), n8n flags it and
 * this reports `PORTAL` — the signal that it needs the headless-browser path (step 2b),
 * not this direct-fetch path.
 *
 * Usage:
 *   MANUAL_FETCH_WEBHOOK_URL=… DATABASE_URL=… npx tsx src/jobs/fetch-and-extract-local.ts \
 *     --url="https://…/manual.pdf" --gvm=3050 [--gcm=…]
 *   # MANUAL_FETCH_WEBHOOK_URL defaults to <N8N_BASE_URL>/webhook/manual-fetch
 */
import { extractManualSpecs } from '../lib/spec-fetch/manual/extract';

function flag(name: string): string | undefined {
  return process.argv
    .find((x) => x.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

async function main() {
  const url = flag('url');
  if (!url) throw new Error('--url=<pdf-or-page-url> is required');
  const known = {
    gvmKg: flag('gvm') ? Number(flag('gvm')) : undefined,
    gcmKg: flag('gcm') ? Number(flag('gcm')) : undefined,
  };

  const webhook =
    process.env.MANUAL_FETCH_WEBHOOK_URL ??
    (process.env.N8N_BASE_URL
      ? `${process.env.N8N_BASE_URL.replace(/\/$/, '')}/webhook/manual-fetch`
      : undefined);
  if (!webhook) {
    throw new Error(
      'MANUAL_FETCH_WEBHOOK_URL (or N8N_BASE_URL) must be set — downloads route through n8n/VPN, not this box.',
    );
  }

  console.log(`\n→ n8n fetch (via VPN): ${url}`);
  const resp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) throw new Error(`n8n webhook HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    ok?: boolean;
    isPdf?: boolean;
    base64?: string;
    bytes?: number;
    error?: string;
    note?: string;
  };

  if (!data.ok) throw new Error(`n8n fetch failed: ${data.error ?? 'unknown'}`);
  if (!data.isPdf) {
    console.log(`\nVERDICT: PORTAL — ${data.note ?? 'not a direct PDF'}`);
    console.log('(needs the headless-browser fetch path — step 2b)');
    return;
  }

  console.log(`  downloaded ${data.bytes} bytes (PDF). Extracting locally…`);
  const pdf = new Uint8Array(Buffer.from(data.base64 ?? '', 'base64'));
  const res = await extractManualSpecs(pdf, known);

  console.log(`\npages used: ${res.pagesUsed.join(', ') || 'none'}`);
  for (const [k, v] of Object.entries(res.specs)) {
    console.log(`  ${k.padEnd(22)} ${v ?? '—'}`);
  }
  console.log(`\nvalidation: ${JSON.stringify(res.validation)}`);
  console.log(`VERDICT: ${res.verdict}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
