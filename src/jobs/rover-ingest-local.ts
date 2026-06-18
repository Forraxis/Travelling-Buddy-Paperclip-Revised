/**
 * Local ROVER ingest — parse every PDF in docs/RVD/, pair each RVD with its Approval
 * Notice by VTA, archive all document versions, and create per-variant catalogue
 * candidates (from the LATEST RVD per VTA). Idempotent: safe to re-run.
 *
 * Usage:  DATABASE_URL=… npx tsx src/jobs/rover-ingest-local.ts
 *
 * Writes real ROVER candidates (status PENDING) to the dev DB so they can be reviewed
 * in Admin → Catalogue → Spec Fetch. No promotion (gate level still Tim-pending).
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../lib/db';
import {
  extractPdfText,
  parseRvdText,
  parseApprovalNoticeText,
  storeRvdDocument,
  ingestRvd,
  type RvdDocument,
  type ApprovalNotice,
} from '../lib/spec-fetch/rover';
import { evaluatePromotionGate } from '../lib/spec-fetch/gating';

const DIR = 'docs/RVD';

async function main() {
  const files = (await readdir(DIR))
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();

  const rvds: { file: string; doc: RvdDocument }[] = [];
  const notices = new Map<string, ApprovalNotice>();

  for (const file of files) {
    const buf = await readFile(join(DIR, file));
    const { text } = await extractPdfText(new Uint8Array(buf));
    if (/^Approval Notice/i.test(file)) {
      const n = parseApprovalNoticeText(text);
      if (n.vtaNumber) notices.set(n.vtaNumber, n);
    } else {
      rvds.push({ file, doc: parseRvdText(text) });
    }
  }

  // Group RVD versions by VTA; newest (by generatedDate) drives the candidates,
  // older versions are still archived for history.
  const byVta = new Map<string, { file: string; doc: RvdDocument }[]>();
  for (const r of rvds) {
    const vta = r.doc.vtaNumber;
    if (!vta) continue;
    if (!byVta.has(vta)) byVta.set(vta, []);
    byVta.get(vta)!.push(r);
  }

  let totalVariants = 0;
  for (const [vta, versions] of byVta) {
    versions.sort((a, b) =>
      (b.doc.generatedDate ?? '').localeCompare(a.doc.generatedDate ?? ''),
    );
    const [latest, ...older] = versions;
    // Archive older versions for history (candidates come from latest only).
    for (const o of older) await storeRvdDocument(o.doc, o.file);

    // Archive older versions FIRST so amendment detection in ingestRvd can find
    // the prior version when it ingests the latest.
    const notice = notices.get(vta) ?? null;
    const res = await ingestRvd(latest.doc, notice, { rvd: latest.file });
    totalVariants += res.variantsCreated + res.variantsRefreshed;
    const amend = res.amendment
      ? `  [${res.amendment.status}${
          res.amendment.changes.length
            ? `: ${res.amendment.changes
                .map((c) => `${c.variant}.${c.field} ${c.from}→${c.to}`)
                .join(', ')}`
            : ''
        }]`
      : '';
    console.log(
      `${vta}  ${latest.doc.make}/${latest.doc.model}  [${notice?.categoryFine ?? latest.doc.categoryBroad ?? '—'}]  ` +
        `→ ${res.variantsCreated} new / ${res.variantsRefreshed} refreshed  (${older.length} older version(s) archived)${amend}`,
    );
  }

  // Verify one candidate clears the gate with no override (auto-corroborated criticals).
  const sample = await prisma.vehicleSpecCandidate.findFirst({
    where: { provider: 'ROVER' },
    include: { fields: true },
    orderBy: { createdAt: 'desc' },
  });
  if (sample) {
    const gate = evaluatePromotionGate(
      sample.fields.map((f) => ({
        field: f.field,
        value: f.value,
        corroborated: f.corroborated,
      })),
      false,
    );
    console.log(
      `\nGATE CHECK on ${sample.makeName} ${sample.modelName} / ${sample.variantName}: ` +
        `allowed=${gate.allowed} blocking=[${gate.blockingFields.join(', ')}]`,
    );
  }

  const docCount = await prisma.roverDocument.count();
  const candCount = await prisma.vehicleSpecCandidate.count({
    where: { provider: 'ROVER' },
  });
  console.log(
    `\n✅ archive: ${docCount} RoverDocument rows · candidates: ${candCount} ROVER · variants this run: ${totalVariants}`,
  );
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
