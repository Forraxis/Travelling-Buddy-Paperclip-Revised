/**
 * Land the Brave-discovered spec findings onto the catalogue — GVM-keyed. [spec source]
 *
 * Reads ops/n8n/.brave-extracted.jsonl (front/rear axle + GCM + towing + tow-ball +
 * dimensions extracted from the spec PDFs the dork search surfaced) and writes each
 * finding onto the catalogue variants whose GVM matches — because, within a make+model,
 * GVM is the generation discriminator (different gens carry different GVM), so a GVM-match
 * lands on the right generation without needing year ranges (which these PDFs don't carry).
 *
 * Fields landed (non-clobbering — only fills a gap or refreshes an existing MANUAL/CLAUDE
 * estimate, never overwrites ROVER/QLD/PLATE/COMMUNITY):
 *   - frontAxleLimitKg / rearAxleLimitKg  (the axle differentiator; front+rear validated together)
 *   - gcmKg, maxTowingCapacityKg, maxTowBallDownloadKg  (towing-compliance weights)
 *   - wheelbaseMm, totalLengthMm, frontOverhangMm, rearOverhangMm  (CoG-beam geometry)
 *
 * Trust: prefers AU-market (.com.au) sources, and only lands a field when the GVM-matched
 * findings AGREE on the value (within a per-field tolerance; conflicting values at the same
 * GVM → skip that field, ambiguous). Lands source=MANUAL / status=ESTIMATE, Rule-11-gated,
 * sourceUrl = the spec PDF. (Same trust treatment as the Lovells landing.)
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/brave-land-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/brave-land-local.ts --write  # land
 */
import { readFileSync, existsSync } from 'node:fs';
import type { SpecProvenanceSource } from '@prisma/client';
import { prisma } from '../lib/db';
import { VMAP } from '../lib/spec-fetch/brave-vmap';

const WRITE = process.argv.includes('--write');
const DATA = 'ops/n8n/.brave-extracted.jsonl';

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

interface Finding {
  make: string;
  slug: string;
  host: string;
  au: boolean;
  gvm: number;
  specs: Specs;
}

/** Reject axle parse glitches: each axle < GVM, the sum brackets the GVM, sane ranges. */
function plausibleAxle(front: number, rear: number, gvm: number): boolean {
  if (front < 700 || front > 3000 || rear < 700 || rear > 3500) return false;
  if (front > gvm || rear > gvm) return false;
  const s = front + rear;
  return s >= gvm * 0.85 && s <= gvm * 1.5;
}

/** Non-axle fields landed by per-field GVM-consensus. `tol` = agreement bucket size
 * (so 4,475 and 4,480 wheelbase count as one value); `ok` is the sanity gate. */
interface FieldCfg {
  field: keyof Specs;
  label: string;
  tol: number;
  ok: (v: number, gvm: number) => boolean;
}
const FIELDS: FieldCfg[] = [
  {
    field: 'gcmKg',
    label: 'GCM',
    tol: 1,
    // GCM = GVM + towing, so it must exceed the GVM and stay below ~2.5× it.
    ok: (v, gvm) => v > gvm && v <= gvm * 2.5 && v >= 3000 && v <= 12000,
  },
  {
    field: 'maxTowingCapacityKg',
    label: 'towing',
    tol: 1,
    ok: (v) => v >= 500 && v <= 4500,
  },
  {
    field: 'maxTowBallDownloadKg',
    label: 'tow-ball',
    tol: 1,
    ok: (v) => v >= 50 && v <= 500,
  },
  {
    field: 'wheelbaseMm',
    label: 'wheelbase',
    tol: 20,
    ok: (v) => v >= 2000 && v <= 4500,
  },
  {
    field: 'totalLengthMm',
    label: 'length',
    tol: 25,
    ok: (v) => v >= 3500 && v <= 6800,
  },
  {
    field: 'frontOverhangMm',
    label: 'front-overhang',
    tol: 20,
    ok: (v) => v >= 500 && v <= 1400,
  },
  {
    field: 'rearOverhangMm',
    label: 'rear-overhang',
    tol: 25,
    ok: (v) => v >= 600 && v <= 2200,
  },
];

/** From the AU-preferred matched findings, return the agreed value or null (ambiguous). */
function consensus(vals: number[], tol: number): number | null {
  if (vals.length === 0) return null;
  const buckets = new Set(vals.map((v) => Math.round(v / tol)));
  if (buckets.size !== 1) return null; // conflicting values at this GVM → don't guess
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

async function main() {
  if (!existsSync(DATA))
    throw new Error(`${DATA} not found — run brave-extract-local.ts first.`);
  const findings: Finding[] = [];
  for (const line of readFileSync(DATA, 'utf8').split('\n').filter(Boolean)) {
    const d = JSON.parse(line) as {
      vehicle: string;
      host: string;
      specs: Specs;
    };
    const v = VMAP[d.vehicle];
    const g = d.specs.gvmKg;
    if (!v || g == null) continue; // GVM is the gen key — no GVM, can't place it
    // Fan out to every candidate model slug; GVM-matching routes to the right gen.
    for (const slug of v.slugs) {
      findings.push({
        make: v.make,
        slug,
        host: d.host,
        au: d.host.endsWith('.com.au'),
        gvm: g,
        specs: d.specs,
      });
    }
  }
  console.log(
    `\n=== BRAVE LAND (${WRITE ? 'WRITE' : 'dry-run'}) · ${findings.length} GVM-anchored findings ===\n`,
  );

  const byModel = new Map<string, Finding[]>();
  for (const f of findings) {
    const k = `${f.make}::${f.slug}`;
    (byModel.get(k) ?? byModel.set(k, []).get(k)!).push(f);
  }

  const landedRows: Record<string, number> = {};
  const variantsTouched = new Set<string>();
  let axleVariants = 0;
  const report: string[] = [];

  for (const [key, fs] of byModel) {
    const [make, slug] = key.split('::');
    const variants = await prisma.vehicleVariant.findMany({
      where: { model: { slug, make: { name: make } }, gvmKg: { not: null } },
      select: { id: true, name: true, gvmKg: true },
    });
    let modelAxle = 0;
    const fieldHits: Record<string, number> = {};
    const samples: string[] = [];

    for (const v of variants) {
      const gvm = v.gvmKg!;
      const cand = fs.filter((f) => Math.abs(f.gvm - gvm) <= gvm * 0.05);
      if (cand.length === 0) continue;
      const auTier = cand.some((c) => c.au) ? cand.filter((c) => c.au) : cand;

      // ---- axle (front+rear validated together) ----
      const axleTier = auTier.filter(
        (c) =>
          c.specs.frontAxleLimitKg != null &&
          c.specs.rearAxleLimitKg != null &&
          plausibleAxle(
            c.specs.frontAxleLimitKg,
            c.specs.rearAxleLimitKg,
            c.gvm,
          ),
      );
      const fronts = consensus(
        axleTier.map((c) => c.specs.frontAxleLimitKg!),
        1,
      );
      const rears = consensus(
        axleTier.map((c) => c.specs.rearAxleLimitKg!),
        1,
      );
      if (fronts != null && rears != null) {
        modelAxle += 1;
        if (samples.length < 2)
          samples.push(
            `      e.g. "${v.name}" (GVM ${gvm}) → F/R ${fronts}/${rears} [${axleTier.find((c) => c.au)?.host ?? axleTier[0].host}]`,
          );
        await landField(v.id, 'frontAxleLimitKg', fronts, axleTier, WRITE);
        await landField(v.id, 'rearAxleLimitKg', rears, axleTier, WRITE);
        if (WRITE) {
          landedRows.axle = (landedRows.axle ?? 0) + 2;
          variantsTouched.add(v.id);
        }
      }

      // ---- other fields (per-field consensus) ----
      for (const cfg of FIELDS) {
        const tier = auTier.filter((c) => {
          const val = c.specs[cfg.field];
          return val != null && cfg.ok(val, c.gvm);
        });
        const val = consensus(
          tier.map((c) => c.specs[cfg.field]!),
          cfg.tol,
        );
        if (val == null) continue;
        fieldHits[cfg.label] = (fieldHits[cfg.label] ?? 0) + 1;
        await landField(v.id, cfg.field as string, val, tier, WRITE);
        if (WRITE) {
          landedRows[cfg.label] = (landedRows[cfg.label] ?? 0) + 1;
          variantsTouched.add(v.id);
        }
      }
    }

    axleVariants += modelAxle;
    if (modelAxle > 0 || Object.keys(fieldHits).length) {
      const extra = Object.entries(fieldHits)
        .map(([l, n]) => `${l}:${n}`)
        .join(' ');
      report.push(
        `  ${make} ${slug}: axle ${modelAxle}/${variants.length}${extra ? `  · ${extra}` : ''}\n${samples.join('\n')}`,
      );
    }
  }

  for (const l of report.sort()) console.log(l);
  console.log(
    `\n${axleVariants} variants got axle · ${variantsTouched.size} variants touched total` +
      (WRITE
        ? `\nrows written: ${Object.entries(landedRows)
            .map(([k, n]) => `${k}=${n}`)
            .join(' ')}`
        : ''),
  );
  if (!WRITE) console.log('(dry-run — pass --write to land)');
  await prisma.$disconnect();
}

/** Non-clobbering upsert: only fills a gap or refreshes an existing MANUAL/CLAUDE row. */
async function landField(
  variantId: string,
  field: string,
  value: number,
  tier: Finding[],
  write: boolean,
): Promise<void> {
  if (!write) return;
  const host = tier.find((c) => c.au)?.host ?? tier[0].host;
  const ex = await prisma.variantSpecProvenance.findUnique({
    where: { variantId_field: { variantId, field } },
    select: { source: true },
  });
  if (ex && ex.source !== 'MANUAL' && ex.source !== 'CLAUDE') return;
  await prisma.variantSpecProvenance.upsert({
    where: { variantId_field: { variantId, field } },
    create: {
      variantId,
      field,
      value: String(value),
      source: 'MANUAL' as SpecProvenanceSource,
      status: 'ESTIMATE',
      sourceUrl: `https://${host}`,
      notes: 'spec-PDF (Brave dork, GVM-matched) — pending Rule-11 sign-off',
    },
    update: {
      value: String(value),
      sourceUrl: `https://${host}`,
      asOf: new Date(),
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
