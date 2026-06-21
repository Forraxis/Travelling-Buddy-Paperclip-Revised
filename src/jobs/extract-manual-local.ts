/**
 * CLI for the local manual-extract core (step 1). [manual sourcing]
 *
 * Runs a PDF through the free local pipeline (docling → Qwen → validate) and prints
 * the extracted weights + the validation verdict. No Claude, no egress.
 *
 * Usage:
 *   npx tsx src/jobs/extract-manual-local.ts --pdf="docs/RVD/….pdf" --gvm=4250 [--gcm=…] [--max-pages=3]
 *   DOCLING_BASE_URL=… QWEN_BASE_URL=… …    # override endpoints (default .150:8085/:8082)
 */
import { readFileSync } from 'node:fs';
import { extractManualSpecs } from '../lib/spec-fetch/manual/extract';

function flag(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a?.slice(name.length + 3);
}

async function main() {
  const pdfPath = flag('pdf');
  if (!pdfPath) throw new Error('--pdf=<path> is required');
  const known = {
    gvmKg: flag('gvm') ? Number(flag('gvm')) : undefined,
    gcmKg: flag('gcm') ? Number(flag('gcm')) : undefined,
  };
  const maxPages = flag('max-pages') ? Number(flag('max-pages')) : 3;

  const data = new Uint8Array(readFileSync(pdfPath));
  console.log(`\nExtracting: ${pdfPath}`);
  console.log(
    `Known (for validation): GVM=${known.gvmKg ?? '—'} GCM=${known.gcmKg ?? '—'}\n`,
  );

  const t0 = Date.now();
  const res = await extractManualSpecs(data, known, { maxPages });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(
    `pre-screen: hasWeightData=${res.prescreen.hasWeightData}` +
      ` signals=[${res.prescreen.signals.join(', ') || 'none'}]` +
      (res.prescreen.scannedFallback ? ' (thin text → VLM fallback)' : ''),
  );
  if (res.verdict === 'NO_WEIGHTS') {
    console.log(
      `VERDICT: NO_WEIGHTS — wrong document type (no weight-rating terms); extraction skipped (free).`,
    );
    return;
  }
  console.log(
    `pages used (weights-relevant): ${res.pagesUsed.join(', ') || 'none'}`,
  );
  console.log(`extracted specs:`);
  for (const [k, v] of Object.entries(res.specs)) {
    console.log(`  ${k.padEnd(22)} ${v ?? '—'}`);
  }
  console.log(`\nvalidation: ${JSON.stringify(res.validation)}`);
  console.log(`VERDICT: ${res.verdict}   (${secs}s, free/local)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
