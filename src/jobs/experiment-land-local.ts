/**
 * Land the SEARCH-EXPERIMENT axle finds onto the catalogue — curated + GVM-keyed. [axle]
 *
 * The experiment PDFs are named by the vendor's filename (e.g. "ford ranger pj pk evsp v2"),
 * not by a VMAP dork-vehicle, so matching is done by an explicit, hand-curated rule table:
 * a name regex → catalogue make + candidate slugs. This keeps it Rule-11-safe — generic or
 * ambiguous names (vendor catalogues, cryptic codes) match NO rule and are skipped, never
 * guessed. Within a matched model, GVM (±5%) routes the value to the right generation.
 *
 * Lands axle (+ GCM/tow/tow-ball/dimensions when plausibly present), source=MANUAL /
 * status=ESTIMATE, Rule-11-gated, non-clobbering, sourceUrl = the vendor PDF.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/experiment-land-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/experiment-land-local.ts --write  # land
 */
import { readFileSync, existsSync } from 'node:fs';
import type { SpecProvenanceSource } from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');
const DATA = 'ops/n8n/.experiment-extracted.jsonl';

/** name-regex → catalogue make + candidate slugs (GVM routes to the right gen/sibling). */
interface Rule {
  re: RegExp;
  make: string;
  slugs: string[];
}
const RULES: Rule[] = [
  // Toyota
  { re: /land\s?cruiser|landcruiser/, make: 'Toyota', slugs: ['landcruiser'] },
  { re: /\bprado\b/, make: 'Toyota', slugs: ['prado'] },
  { re: /\bfortuner\b/, make: 'Toyota', slugs: ['fortuner'] },
  { re: /fj\s?cruiser/, make: 'Toyota', slugs: ['fj-cruiser'] },
  { re: /\bhilux\b|kun26r/, make: 'Toyota', slugs: ['hilux'] },
  // Nissan
  { re: /\bpatrol\b/, make: 'Nissan', slugs: ['patrol'] },
  { re: /pathfinder/, make: 'Nissan', slugs: ['pathfinder'] },
  { re: /\bnavara\b/, make: 'Nissan', slugs: ['navara'] },
  { re: /x[\s-]?trail/, make: 'Nissan', slugs: ['x-trail'] },
  // Ford / Holden / Isuzu
  { re: /\branger\b/, make: 'Ford', slugs: ['ranger'] },
  { re: /\bcolorado\b/, make: 'Holden', slugs: ['colorado'] },
  { re: /d[\s-]?max/, make: 'Isuzu', slugs: ['d-max'] },
  // Mitsubishi
  {
    re: /\btriton\b/,
    make: 'Mitsubishi',
    slugs: ['triton', 'triton-lb-lc'],
  },
  {
    re: /outlander/,
    make: 'Mitsubishi',
    slugs: ['outlander', 'outlander-gm-gn', 'outlander-phev-gn'],
  },
  { re: /\basx\b/, make: 'Mitsubishi', slugs: ['asx', 'asx-xjb'] },
  // Mazda
  { re: /cx[\s-]?5\b/, make: 'Mazda', slugs: ['cx-5', 'cx-5b', 'cx-5c'] },
  { re: /cx[\s-]?3\b/, make: 'Mazda', slugs: ['cx-3', 'cx-3b'] },
  // Honda / Hyundai / Subaru
  { re: /cr[\s-]?v\b/, make: 'Honda', slugs: ['cr-v'] },
  { re: /tucson/, make: 'Hyundai', slugs: ['tucson'] },
  { re: /forester/, make: 'Subaru', slugs: ['forester'] },
];

interface Specs {
  frontAxleLimitKg?: number | null;
  rearAxleLimitKg?: number | null;
  gcmKg?: number | null;
  maxTowingCapacityKg?: number | null;
  maxTowBallDownloadKg?: number | null;
  wheelbaseMm?: number | null;
  totalLengthMm?: number | null;
  frontOverhangMm?: number | null;
  rearOverhangMm?: number | null;
  gvmKg?: number | null;
}

function plausibleAxle(f: number, r: number, gvm: number): boolean {
  if (f < 700 || f > 3000 || r < 700 || r > 3500) return false;
  if (f > gvm || r > gvm) return false;
  const s = f + r;
  return s >= gvm * 0.85 && s <= gvm * 1.5;
}

/** non-axle fields + plausibility (mirrors brave-land). */
const FIELDS: {
  field: keyof Specs;
  label: string;
  ok: (v: number, gvm: number) => boolean;
}[] = [
  {
    field: 'gcmKg',
    label: 'gcm',
    ok: (v, g) => v > g && v <= g * 2.5 && v >= 3000 && v <= 12000,
  },
  {
    field: 'maxTowingCapacityKg',
    label: 'tow',
    ok: (v) => v >= 500 && v <= 4500,
  },
  {
    field: 'maxTowBallDownloadKg',
    label: 'tbm',
    ok: (v) => v >= 50 && v <= 500,
  },
  { field: 'wheelbaseMm', label: 'wb', ok: (v) => v >= 2000 && v <= 4500 },
  { field: 'totalLengthMm', label: 'len', ok: (v) => v >= 3500 && v <= 6800 },
  {
    field: 'frontOverhangMm',
    label: 'foh',
    ok: (v) => v >= 500 && v <= 1400,
  },
  {
    field: 'rearOverhangMm',
    label: 'roh',
    ok: (v) => v >= 600 && v <= 2200,
  },
];

async function landField(
  variantId: string,
  field: string,
  value: number,
  url: string,
): Promise<boolean> {
  const ex = await prisma.variantSpecProvenance.findUnique({
    where: { variantId_field: { variantId, field } },
    select: { source: true },
  });
  if (ex && ex.source !== 'MANUAL' && ex.source !== 'CLAUDE') return false;
  await prisma.variantSpecProvenance.upsert({
    where: { variantId_field: { variantId, field } },
    create: {
      variantId,
      field,
      value: String(value),
      source: 'MANUAL' as SpecProvenanceSource,
      status: 'ESTIMATE',
      sourceUrl: url,
      notes:
        'suspension/GVM-cert spec sheet (experiment) — pending Rule-11 sign-off',
    },
    update: { value: String(value), sourceUrl: url, asOf: new Date() },
  });
  return true;
}

interface Finding {
  name: string;
  url: string;
  specs: Specs;
  rule: Rule;
  gvm: number;
}

async function main() {
  if (!existsSync(DATA)) throw new Error(`${DATA} not found`);
  const raw = readFileSync(DATA, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { name: string; url: string; specs: Specs })
    .filter(
      (d) =>
        d.specs.frontAxleLimitKg != null && d.specs.rearAxleLimitKg != null,
    );

  console.log(
    `\n=== EXPERIMENT LAND (${WRITE ? 'WRITE' : 'dry-run'}) · ${raw.length} axle findings ===\n`,
  );

  // Resolve each finding to a rule + sanity-check; collect skips.
  const findings: Finding[] = [];
  const skipped: string[] = [];
  for (const d of raw) {
    const rule = RULES.find((R) => R.re.test(d.name.toLowerCase()));
    const gvm = d.specs.gvmKg;
    if (
      !rule ||
      gvm == null ||
      !plausibleAxle(d.specs.frontAxleLimitKg!, d.specs.rearAxleLimitKg!, gvm)
    ) {
      skipped.push(
        `  skip «${d.name}» (${!rule ? 'no rule' : gvm == null ? 'no gvm' : 'implausible axle'})`,
      );
      continue;
    }
    findings.push({ name: d.name, url: d.url, specs: d.specs, rule, gvm });
  }

  // Assign each catalogue variant to its SINGLE nearest-GVM finding (within ±5%), so a
  // multi-generation model (LandCruiser etc.) never gets two gens' axles written over
  // each other — each variant takes only the closest-GVM source.
  const modelKeys = new Map<string, { make: string; slugs: Set<string> }>();
  for (const f of findings) {
    const k = f.rule.make;
    const e = modelKeys.get(k) ?? { make: f.rule.make, slugs: new Set() };
    f.rule.slugs.forEach((s) => e.slugs.add(s));
    modelKeys.set(k, e);
  }

  let rows = 0;
  let landedVariants = 0;
  const usedFinding = new Set<string>();

  for (const { make, slugs } of modelKeys.values()) {
    const variants = await prisma.vehicleVariant.findMany({
      where: {
        gvmKg: { not: null },
        model: { make: { name: make }, slug: { in: [...slugs] } },
      },
      select: { id: true, gvmKg: true, model: { select: { slug: true } } },
    });
    for (const v of variants) {
      const gvm = v.gvmKg!;
      // eligible findings: same make, this variant's slug is in the finding's slug set, GVM ±5%
      const elig = findings.filter(
        (f) =>
          f.rule.make === make &&
          f.rule.slugs.includes(v.model.slug) &&
          Math.abs(f.gvm - gvm) <= gvm * 0.05,
      );
      if (elig.length === 0) continue;
      // nearest GVM wins
      elig.sort((a, b) => Math.abs(a.gvm - gvm) - Math.abs(b.gvm - gvm));
      const best = elig[0];
      usedFinding.add(best.name);
      landedVariants += 1;
      if (WRITE) {
        if (
          await landField(
            v.id,
            'frontAxleLimitKg',
            best.specs.frontAxleLimitKg!,
            best.url,
          )
        )
          rows += 1;
        if (
          await landField(
            v.id,
            'rearAxleLimitKg',
            best.specs.rearAxleLimitKg!,
            best.url,
          )
        )
          rows += 1;
        for (const cfg of FIELDS) {
          const val = best.specs[cfg.field];
          if (val != null && cfg.ok(val, best.gvm)) {
            if (await landField(v.id, cfg.field as string, val, best.url))
              rows += 1;
          }
        }
      }
    }
  }

  console.log(
    `findings used: ${usedFinding.size}/${findings.length} (the rest were out-of-GVM-range or lost the nearest-match tie-break)\n`,
  );
  console.log(`--- skipped (${skipped.length}) ---`);
  for (const s of skipped) console.log(s);
  console.log(
    `\n${landedVariants} variants assigned to a nearest-GVM source` +
      (WRITE ? ` · ${rows} rows written (MANUAL/ESTIMATE)` : ' (dry-run)'),
  );
  if (!WRITE) console.log('(pass --write to land)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
