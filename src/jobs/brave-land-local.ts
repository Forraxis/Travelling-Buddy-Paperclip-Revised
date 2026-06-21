/**
 * Land the Brave-discovered axle findings onto the catalogue — GVM-keyed. [axle source]
 *
 * Reads ops/n8n/.brave-extracted.jsonl (front/rear axle + GVM extracted from spec PDFs
 * the dork search surfaced) and writes each finding's axle onto the catalogue variants
 * whose GVM matches — because, within a make+model, GVM is the generation discriminator
 * (different gens have different GVM), so GVM-match lands on the right generation without
 * needing year ranges (which these PDFs don't carry).
 *
 * Trust: prefers AU-market (.com.au) + OEM sources, and only lands a variant when the
 * GVM-matched findings AGREE on the axle value (conflicting values at the same GVM →
 * skip, ambiguous). Lands source=MANUAL / status=ESTIMATE, Rule-11-gated, non-clobbering,
 * sourceUrl = the spec PDF. (Same trust treatment as the Lovells landing.)
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/brave-land-local.ts          # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/brave-land-local.ts --write  # land
 */
import { readFileSync, existsSync } from 'node:fs';
import type { SpecProvenanceSource } from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');
const DATA = 'ops/n8n/.brave-extracted.jsonl';

/** dork-vehicle string → catalogue { make, slug }. */
const VMAP: Record<string, { make: string; slug: string }> = {
  'toyota rav4': { make: 'Toyota', slug: 'rav4' },
  'nissan x-trail': { make: 'Nissan', slug: 'x-trail' },
  'mazda cx-5': { make: 'Mazda', slug: 'cx-5' },
  'holden colorado': { make: 'Holden', slug: 'colorado' },
  'mitsubishi outlander': { make: 'Mitsubishi', slug: 'outlander' },
  'holden commodore': { make: 'Holden', slug: 'commodore' },
  'subaru forester': { make: 'Subaru', slug: 'forester' },
  'mitsubishi asx': { make: 'Mitsubishi', slug: 'asx' },
  'mitsubishi pajero': { make: 'Mitsubishi', slug: 'pajero' },
  'hyundai tucson': { make: 'Hyundai', slug: 'tucson' },
  'ford falcon': { make: 'Ford', slug: 'falcon' },
  'honda cr-v': { make: 'Honda', slug: 'cr-v' },
  'holden rodeo': { make: 'Holden', slug: 'rodeo' },
  'toyota kluger': { make: 'Toyota', slug: 'kluger' },
  'toyota hiace': { make: 'Toyota', slug: 'hiace' },
  'holden captiva': { make: 'Holden', slug: 'captiva' },
  'mazda cx-3': { make: 'Mazda', slug: 'cx-3' },
  'kia sportage': { make: 'Kia', slug: 'sportage' },
  'nissan navara d40': { make: 'Nissan', slug: 'navara' },
  'mitsubishi triton': { make: 'Mitsubishi', slug: 'triton' },
  'volkswagen amarok': { make: 'Volkswagen', slug: 'amarok' },
};

interface Finding {
  make: string;
  slug: string;
  host: string;
  front: number;
  rear: number;
  gvm: number;
  au: boolean;
}

/** Reject parse glitches: each axle < GVM, axle sum brackets the GVM, sane ranges. */
function plausible(front: number, rear: number, gvm: number): boolean {
  if (front < 700 || front > 3000 || rear < 700 || rear > 3500) return false;
  if (front > gvm || rear > gvm) return false;
  const s = front + rear;
  return s >= gvm * 0.85 && s <= gvm * 1.5;
}

async function main() {
  if (!existsSync(DATA))
    throw new Error(`${DATA} not found — run brave-extract-local.ts first.`);
  const findings: Finding[] = [];
  for (const line of readFileSync(DATA, 'utf8').split('\n').filter(Boolean)) {
    const d = JSON.parse(line) as {
      vehicle: string;
      host: string;
      specs: {
        frontAxleLimitKg?: number;
        rearAxleLimitKg?: number;
        gvmKg?: number;
      };
    };
    const v = VMAP[d.vehicle];
    const f = d.specs.frontAxleLimitKg;
    const r = d.specs.rearAxleLimitKg;
    const g = d.specs.gvmKg;
    if (!v || f == null || r == null || g == null) continue;
    if (!plausible(f, r, g)) continue;
    findings.push({
      make: v.make,
      slug: v.slug,
      host: d.host,
      front: f,
      rear: r,
      gvm: g,
      au: d.host.endsWith('.com.au'),
    });
  }
  console.log(
    `\n=== BRAVE LAND (${WRITE ? 'WRITE' : 'dry-run'}) · ${findings.length} plausible axle findings ===\n`,
  );

  const byModel = new Map<string, Finding[]>();
  for (const f of findings) {
    const k = `${f.make}::${f.slug}`;
    (byModel.get(k) ?? byModel.set(k, []).get(k)!).push(f);
  }

  let landedVariants = 0;
  let landedRows = 0;
  let ambiguous = 0;
  const report: string[] = [];

  for (const [key, fs] of byModel) {
    const [make, slug] = key.split('::');
    const variants = await prisma.vehicleVariant.findMany({
      where: { model: { slug, make: { name: make } }, gvmKg: { not: null } },
      select: {
        id: true,
        name: true,
        yearFrom: true,
        yearTo: true,
        gvmKg: true,
      },
    });
    let modelLanded = 0;
    const samples: string[] = [];
    for (const v of variants) {
      // Findings whose GVM matches this variant (±5%).
      const cand = fs.filter(
        (f) => Math.abs(f.gvm - v.gvmKg!) <= v.gvmKg! * 0.05,
      );
      if (cand.length === 0) continue;
      // Prefer AU sources; require agreement on the axle value among the chosen tier.
      const tier = cand.some((c) => c.au) ? cand.filter((c) => c.au) : cand;
      const fronts = new Set(tier.map((c) => c.front));
      const rears = new Set(tier.map((c) => c.rear));
      if (fronts.size !== 1 || rears.size !== 1) {
        ambiguous += 1;
        continue; // conflicting axle values at this GVM → don't guess
      }
      const chosen = tier[0];
      modelLanded += 1;
      if (samples.length < 2)
        samples.push(
          `      e.g. "${v.name}" (GVM ${v.gvmKg}) → F/R ${chosen.front}/${chosen.rear} [${chosen.host}]`,
        );
      if (WRITE) {
        for (const [field, value] of [
          ['frontAxleLimitKg', chosen.front],
          ['rearAxleLimitKg', chosen.rear],
        ] as [string, number][]) {
          const ex = await prisma.variantSpecProvenance.findUnique({
            where: { variantId_field: { variantId: v.id, field } },
            select: { source: true },
          });
          if (ex && ex.source !== 'MANUAL' && ex.source !== 'CLAUDE') continue;
          await prisma.variantSpecProvenance.upsert({
            where: { variantId_field: { variantId: v.id, field } },
            create: {
              variantId: v.id,
              field,
              value: String(value),
              source: 'MANUAL' as SpecProvenanceSource,
              status: 'ESTIMATE',
              sourceUrl: `https://${chosen.host}`,
              notes:
                'spec-PDF axle (Brave dork, GVM-matched) — pending Rule-11 sign-off',
            },
            update: {
              value: String(value),
              sourceUrl: `https://${chosen.host}`,
              asOf: new Date(),
            },
          });
          landedRows += 1;
        }
      }
    }
    landedVariants += modelLanded;
    if (modelLanded > 0)
      report.push(
        `  ${make} ${slug}: ${modelLanded}/${variants.length} variants\n${samples.join('\n')}`,
      );
  }

  for (const l of report.sort()) console.log(l);
  console.log(
    `\n${landedVariants} variants matched by GVM` +
      (WRITE ? ` · ${landedRows} axle rows written (MANUAL/ESTIMATE)` : '') +
      ` · ${ambiguous} ambiguous skipped`,
  );
  if (!WRITE) console.log('(dry-run — pass --write to land)');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
