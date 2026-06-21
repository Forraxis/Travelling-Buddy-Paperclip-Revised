/**
 * Land the harvested Lovells factory axle data onto the catalogue — generation-aware.
 * [task: source axle limits]
 *
 * Reads the Lovells dataset (ops/n8n/.lovells.jsonl, produced by lovells-harvest-local)
 * and writes each generation's FACTORY front/rear axle onto the catalogue variants of
 * THAT generation — matched by year-range overlap, with GVM as the tiebreaker. It never
 * guesses: a variant that matches two Lovells generations ambiguously is skipped and
 * reported, not landed wrong (the failure mode of a GVM-only match).
 *
 * Lands as VariantSpecProvenance source=MANUAL / status=ESTIMATE (Rule-11-gated — these
 * are an engineering-certifier's stated OEM figures, strong but ESTIMATE until you sign
 * off / a plate confirms), non-clobbering, with the Lovells page as sourceUrl.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/lovells-land-local.ts          # dry-run: show what would land
 *   DATABASE_URL=… npx tsx src/jobs/lovells-land-local.ts --write  # land it
 */
import { readFileSync, existsSync } from 'node:fs';
import type { SpecProvenanceSource } from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');
const DATA = 'ops/n8n/.lovells.jsonl';

interface Row {
  url: string;
  title: string;
  frontAxleKg: number | null;
  rearAxleKg: number | null;
  gvmKg: number | null;
  gcmKg: number | null;
}

interface Gen extends Row {
  make: string;
  kw: string;
  yearFrom: number;
  yearTo: number | null; // null = open ("on")
}

function modelKeyword(s: string): { make: string; kw: string } | null {
  const t = s.toLowerCase();
  const map: [string, string, string][] = [
    ['hilux', 'Toyota', 'hilux'],
    ['landcruiser', 'Toyota', 'landcruiser'],
    ['prado', 'Toyota', 'prado'],
    ['ranger', 'Ford', 'ranger'],
    ['everest', 'Ford', 'everest'],
    ['d-max', 'Isuzu', 'd-max'],
    ['mu-x', 'Isuzu', 'mu-x'],
    ['bt50', 'Mazda', 'bt-50'],
    ['bt-50', 'Mazda', 'bt-50'],
    ['patrol', 'Nissan', 'patrol'],
    ['ram', 'RAM', 'ram'],
  ];
  for (const [needle, make, kw] of map)
    if (t.includes(needle)) return { make, kw };
  return null;
}

/** Parse the generation year range from the Lovells URL slug, which reliably carries
 * it ("...10-15-on..." → 2015→open; "...11-2007-03-2021..." → 2007-2021). */
function parseYears(url: string): { from: number; to: number | null } | null {
  const slug = url.toLowerCase();
  const years = new Set<number>();
  for (const m of slug.matchAll(/\b(19|20)\d{2}\b/g))
    years.add(parseInt(m[0], 10));
  // MM-YY tokens (e.g. "10-15", "01-24") → 20YY, only plausible recent years.
  for (const m of slug.matchAll(/\b(0[1-9]|1[0-2])-(\d{2})\b/g)) {
    const yy = parseInt(m[2], 10);
    if (yy >= 5 && yy <= 30) years.add(2000 + yy);
  }
  if (years.size === 0) return null;
  const arr = [...years].sort((a, b) => a - b);
  const open = /-on\b|-onwards\b/.test(slug);
  return { from: arr[0], to: open ? null : arr[arr.length - 1] };
}

/** Factory axle sanity — rejects parse glitches (a rear value that's really the GVM). */
function plausibleAxle(
  front: number,
  rear: number,
  gvm: number | null,
): boolean {
  if (front < 800 || front > 3000 || rear < 800 || rear > 3500) return false;
  if (gvm == null) return true;
  if (front > gvm || rear > gvm) return false; // a single axle can't exceed total mass
  const sum = front + rear;
  return sum >= gvm * 0.85 && sum <= gvm * 1.45; // axle sum brackets the GVM
}

function overlaps(
  v: { yf: number; yt: number },
  g: { from: number; to: number | null },
): boolean {
  return v.yf <= (g.to ?? 9999) && v.yt >= g.from;
}

async function main() {
  if (!existsSync(DATA))
    throw new Error(`${DATA} not found — run lovells-harvest-local.ts first.`);
  const rows = readFileSync(DATA, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  // Build clean generation records (years parsed, axle plausible).
  const gens: Gen[] = [];
  for (const r of rows) {
    const mk = modelKeyword(r.url + ' ' + r.title);
    const yrs = parseYears(r.url);
    if (!mk || !yrs || r.frontAxleKg == null || r.rearAxleKg == null) continue;
    if (!plausibleAxle(r.frontAxleKg, r.rearAxleKg, r.gvmKg)) continue;
    gens.push({
      ...r,
      make: mk.make,
      kw: mk.kw,
      yearFrom: yrs.from,
      yearTo: yrs.to,
    });
  }
  console.log(
    `\n=== LOVELLS LAND (${WRITE ? 'WRITE' : 'dry-run'}) · ${gens.length}/${rows.length} usable generations ===\n`,
  );

  const byModel = new Map<string, Gen[]>();
  for (const g of gens) {
    const k = `${g.make}::${g.kw}`;
    (byModel.get(k) ?? byModel.set(k, []).get(k)!).push(g);
  }

  let landedVariants = 0;
  let landedRows = 0;
  let ambiguous = 0;
  const perModel: string[] = [];

  for (const [key, modelGens] of byModel) {
    const [make, kw] = key.split('::');
    const variants = await prisma.vehicleVariant.findMany({
      where: { model: { slug: kw, make: { name: make } } },
      select: {
        id: true,
        name: true,
        yearFrom: true,
        yearTo: true,
        gvmKg: true,
      },
    });
    let modelLanded = 0;
    let modelAmbig = 0;
    const modelSamples: string[] = [];
    for (const v of variants) {
      let cands = modelGens.filter((g) =>
        overlaps(
          { yf: v.yearFrom, yt: v.yearTo },
          { from: g.yearFrom, to: g.yearTo },
        ),
      );
      // If a variant overlaps multiple generations, use GVM to pick the right one.
      if (cands.length > 1 && v.gvmKg != null) {
        const byGvm = cands
          .filter((g) => g.gvmKg != null)
          .map((g) => ({ g, d: Math.abs(g.gvmKg! - v.gvmKg!) }))
          .filter((x) => x.d <= v.gvmKg! * 0.06)
          .sort((a, b) => a.d - b.d);
        cands = byGvm.length ? [byGvm[0].g] : cands;
      }
      if (cands.length !== 1) {
        if (cands.length > 1) modelAmbig += 1;
        continue;
      }
      const g = cands[0];
      modelLanded += 1;
      if (modelSamples.length < 3)
        modelSamples.push(
          `      e.g. "${v.name}" (${v.yearFrom}-${v.yearTo}, GVM ${v.gvmKg ?? '—'}) → F/R ${g.frontAxleKg}/${g.rearAxleKg} [${g.yearFrom}-${g.yearTo ?? 'on'}]`,
        );
      if (WRITE) {
        for (const [field, value] of [
          ['frontAxleLimitKg', g.frontAxleKg!],
          ['rearAxleLimitKg', g.rearAxleKg!],
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
              sourceUrl: g.url,
              notes:
                'Lovells OEM factory axle (gen+GVM matched) — pending Rule-11 sign-off',
            },
            update: {
              value: String(value),
              sourceUrl: g.url,
              asOf: new Date(),
            },
          });
          landedRows += 1;
        }
      }
    }
    landedVariants += modelLanded;
    ambiguous += modelAmbig;
    perModel.push(
      `  ${make} ${kw}: ${modelLanded}/${variants.length} variants matched a generation` +
        (modelAmbig ? ` (${modelAmbig} ambiguous, skipped)` : '') +
        ` · ${modelGens.length} Lovells gens\n` +
        modelSamples.join('\n'),
    );
  }

  for (const l of perModel.sort()) console.log(l);
  console.log(
    `\n${landedVariants} variants matched a single Lovells generation` +
      (WRITE
        ? ` · ${landedRows} axle provenance rows written (MANUAL/ESTIMATE)`
        : '') +
      ` · ${ambiguous} ambiguous skipped`,
  );
  if (!WRITE) console.log(`(dry-run — pass --write to land)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
