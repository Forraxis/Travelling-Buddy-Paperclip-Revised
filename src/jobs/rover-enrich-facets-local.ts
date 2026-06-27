/**
 * ROVER held-data facet enrichment — fill cabType from the stored RVD bodyStyle.
 * CATALOGUE_GRANULARITY_PLAN.md milestone 2, step 2 (local, no crawl).
 *
 * The ROVER crawl already ran: all 1,321 approvals are EXPANDED and their RVDs are
 * archived in RoverDocument (parsed JSON). The federal RVD names ute variants by
 * OEM code (e.g. "GUN125R-BTFLXQ3") with NO drive/badge/trim — so it can't produce
 * a clean "SR5 4x4" name — but it DOES carry a per-variant `bodyStyle`
 * ("Single Cab Chassis", "Dual Cab"). The name-token backfill missed cabType on the
 * coded variants (their NAME has no cab word); this reads it from the authoritative
 * RVD body style so the Single/Dual/King cab chips work for those models too.
 *
 * Scope: cabType only, ute cab styles only (Single/Dual/King). Wagon bodies are
 * skipped (a "Wagon" cab is redundant + invisible — the chip auto-collapses).
 * GCM/axle/drive/badge are NOT in the RVD per-variant, so they're out of reach here.
 *
 * Join: VehicleVariant ← (resultingVariantId) ← VehicleSpecCandidate (provider=ROVER,
 * APPROVED, sourceVtaNumber + variantName) → RoverDocument RVD parsed.variants[].name.
 *
 * FILL-EMPTIES-ONLY + idempotent. Writes cabType column + a VariantSpecProvenance
 * row (source=ROVER, status=CONFIRMED — body style is authoritative federal data).
 *
 * Usage:
 *   DATABASE_URL=… npx jiti src/jobs/rover-enrich-facets-local.ts          # dry-run
 *   DATABASE_URL=… npx jiti src/jobs/rover-enrich-facets-local.ts --write  # commit
 */
import { prisma } from '../lib/db';
import type { CabType } from '@prisma/client';

const WRITE = process.argv.includes('--write');
const DRY = !WRITE;

/** RVD body style → ute cab type. Ute cab counts only; everything else → null. */
function cabFromBodyStyle(bs: string | null | undefined): CabType | null {
  if (!bs) return null;
  const s = bs.toLowerCase();
  if (s.includes('nsw body code')) return null; // RVD parser mis-grab
  if (/dual cab|double cab|crew cab/.test(s)) return 'DUAL_CAB';
  if (
    /king cab|extra cab|space cab|super cab|freestyle|club cab|x-?tra cab/.test(
      s,
    )
  )
    return 'KING_CAB';
  if (/single cab/.test(s)) return 'SINGLE_CAB';
  return null;
}

interface RvdVariantLite {
  name?: string;
  bodyStyle?: string | null;
}

async function main() {
  console.error(
    `ROVER facet enrichment (cabType ← RVD bodyStyle) — ${DRY ? 'DRY RUN' : 'WRITE'}`,
  );

  // 1) Build (vtaNumber|variantName) → bodyStyle, preferring the richest doc parse.
  const docs = await prisma.roverDocument.findMany({
    where: { docType: 'RVD' },
    select: { vtaNumber: true, parsed: true, variantCount: true },
  });
  const bodyByKey = new Map<string, { bodyStyle: string | null; vc: number }>();
  for (const d of docs) {
    const variants =
      (d.parsed as { variants?: RvdVariantLite[] } | null)?.variants ?? [];
    for (const v of variants) {
      if (!v?.name) continue;
      const key = `${d.vtaNumber}|${v.name}`;
      const prev = bodyByKey.get(key);
      const vc = d.variantCount ?? 0;
      if (!prev || vc > prev.vc)
        bodyByKey.set(key, { bodyStyle: v.bodyStyle ?? null, vc });
    }
  }
  console.error(
    `  indexed ${bodyByKey.size} RVD variant records from ${docs.length} RVDs`,
  );

  // 2) ROVER candidates linked to a live variant that still has no cabType.
  const candidates = await prisma.vehicleSpecCandidate.findMany({
    where: {
      provider: 'ROVER',
      status: 'APPROVED',
      resultingVariantId: { not: null },
      sourceVtaNumber: { not: null },
      variantName: { not: null },
      resultingVariant: { cabType: null },
    },
    select: {
      sourceVtaNumber: true,
      variantName: true,
      resultingVariantId: true,
    },
  });

  const stat: Record<string, number> = {
    DUAL_CAB: 0,
    KING_CAB: 0,
    SINGLE_CAB: 0,
  };
  let noMatch = 0;
  let noCab = 0;
  const seen = new Set<string>();
  const updates: { variantId: string; cab: CabType }[] = [];

  for (const c of candidates) {
    const id = c.resultingVariantId!;
    if (seen.has(id)) continue; // one fill per variant
    const hit = bodyByKey.get(`${c.sourceVtaNumber}|${c.variantName}`);
    if (!hit) {
      noMatch++;
      continue;
    }
    const cab = cabFromBodyStyle(hit.bodyStyle);
    if (!cab) {
      noCab++;
      continue;
    }
    seen.add(id);
    stat[cab]++;
    updates.push({ variantId: id, cab });
  }

  console.error(
    `  candidates: ${candidates.length} (cabType null) · matched RVD: ${candidates.length - noMatch} · ute-cab resolvable: ${updates.length}`,
  );
  console.error(
    `  → DUAL_CAB ${stat.DUAL_CAB} · KING_CAB ${stat.KING_CAB} · SINGLE_CAB ${stat.SINGLE_CAB} (skipped: ${noCab} non-ute bodies, ${noMatch} unmatched)`,
  );

  if (!DRY) {
    let n = 0;
    for (const u of updates) {
      await prisma.vehicleVariant.update({
        where: { id: u.variantId },
        data: { cabType: u.cab },
      });
      await prisma.variantSpecProvenance.upsert({
        where: {
          variantId_field: { variantId: u.variantId, field: 'cabType' },
        },
        update: {
          value: u.cab,
          source: 'ROVER',
          status: 'CONFIRMED',
          asOf: new Date(),
          notes: 'cab type read from ROVER RVD body style',
        },
        create: {
          variantId: u.variantId,
          field: 'cabType',
          value: u.cab,
          source: 'ROVER',
          status: 'CONFIRMED',
          corroboratingCount: 1,
          asOf: new Date(),
          notes: 'cab type read from ROVER RVD body style',
        },
      });
      n++;
    }
    console.error(`\n✓ wrote cabType for ${n} variants (+ provenance)`);
  } else {
    console.error(
      '\nDRY RUN — nothing written. Re-run with --write to commit.',
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
