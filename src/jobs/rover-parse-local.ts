/**
 * Local ROVER corpus parser — parses every PDF in docs/RVD/ (RVDs + Approval
 * Notices), prints a summary, and writes the full structured output to
 * docs/RVD/_parsed.json as the source-of-truth archive snapshot.
 *
 * Usage:  npx tsx src/jobs/rover-parse-local.ts
 *
 * No DB, no network — just proves the deterministic parse end-to-end on the real
 * documents before any catalogue ingest.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractPdfText } from '../lib/spec-fetch/rover/pdf';
import { parseRvdText } from '../lib/spec-fetch/rover/rvd-parser';
import { parseApprovalNoticeText } from '../lib/spec-fetch/rover/approval-notice-parser';

const DIR = 'docs/RVD';

async function main() {
  const files = (await readdir(DIR))
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();

  const rvds: unknown[] = [];
  const notices: unknown[] = [];

  for (const f of files) {
    const buf = await readFile(join(DIR, f));
    const { text, totalPages } = await extractPdfText(new Uint8Array(buf));

    if (/^Approval Notice/i.test(f)) {
      const n = parseApprovalNoticeText(text);
      notices.push({ file: f, ...n, rawText: undefined });
      console.log(`\n[notice] ${f} (${totalPages}p)`);
      console.log(`  ${n.vehicleType}  [${n.categoryFine}]  ${n.vtaNumber}`);
      console.log(
        `  valid ${n.validFrom} · variation ${n.variationValidFrom ?? '—'} · expires ${n.expiresOn}`,
      );
      console.log(`  holder: ${n.approvalHolder}`);
      console.log(`  variants: ${n.variants.length}`);
      continue;
    }

    const d = parseRvdText(text);
    rvds.push({ file: f, ...d, rawText: undefined });
    console.log(`\n📄 ${f} (${totalPages}p)`);
    console.log(
      `  ${d.make} / ${d.model} (${d.marketingDesignation ?? '—'})  [${d.categoryBroad ?? 'no category'}]  ${d.vtaNumber}  gen:${d.generatedDate}`,
    );
    console.log(
      `  hash:${d.contentHash.slice(0, 12)}  remarks axle F/R: ${d.remarksFrontAxleKg ?? '—'}/${d.remarksRearAxleKg ?? '—'}`,
    );
    console.log(`  variants: ${d.variants.length}`);
    for (const v of d.variants.slice(0, 4)) {
      console.log(
        `    • ${v.name}: GVM ${v.gvmKg ?? '—'}, tare ${v.tareKg ?? '—'}, tow(b) ${v.towBrakedKg ?? '—'}, GCM ${v.gcmKg ?? '—'}, WB ${v.wheelbaseMm ?? '—'}`,
      );
    }
    if (d.variants.length > 4)
      console.log(`    … +${d.variants.length - 4} more`);
  }

  await writeFile(
    join(DIR, '_parsed.json'),
    JSON.stringify({ rvds, notices }, null, 2),
    'utf8',
  );
  console.log(
    `\n✅ wrote ${DIR}/_parsed.json  (${rvds.length} RVDs, ${notices.length} notices)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
