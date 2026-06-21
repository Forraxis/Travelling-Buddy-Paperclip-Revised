/**
 * Lovells GVM-upgrade harvest — the axle source. [task: source axle limits]
 *
 * Lovells (an Australian engineering certifier) publishes, per popular tow rig, the
 * FACTORY front/rear axle ratings + GVM + GCM (cited from the OEM to baseline their
 * GVM upgrade) AND the upgraded figures + CPA kit codes. This is the public, AU,
 * free source for the factory axle limits that web search and owner's manuals could
 * NOT give us — and it self-validates (their factory GVM matches our catalogue GVM).
 *
 * This job crawls the ~37 Lovells vehicle pages (in-here; benign commercial pages),
 * parses the labelled factory figures deterministically (no AI, no VLM), validates
 * the factory GVM against our catalogue, and:
 *   - dry-run: reports each vehicle's factory axle/GVM/GCM + whether it matches a
 *     catalogue variant, and writes the raw dataset to ops/n8n/.lovells.jsonl.
 *   - --write: lands the factory front/rear axle on the matched variant as
 *     VariantSpecProvenance source=MANUAL / status=ESTIMATE (Rule-11-gated — Tim signs
 *     off to promote; the GVM-match is the corroboration), non-clobbering, with the
 *     Lovells page as sourceUrl.
 *
 * (Upgrade-kit axles → GvmUpgrade overlays is a deliberate follow-up; this pass nails
 * the factory base axle gap first.)
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/lovells-harvest-local.ts           # dry-run
 *   DATABASE_URL=… npx tsx src/jobs/lovells-harvest-local.ts --write   # land matched factory axles
 */
import { writeFileSync } from 'node:fs';
import type { SpecProvenanceSource } from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');
const LIST_URL = 'https://www.lovells.com.au/gvm-upgrades';
const OUT = 'ops/n8n/.lovells.jsonl';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function getText(url: string): Promise<string[]> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`http ${r.status}`);
  const html = await r.text();
  return html
    .replace(/<[^>]+>/g, '\n')
    .replace(/&#?\w+;/g, ' ')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Last kg integer in a string ("1450kg.../1480kg on" → 1480; "1700kg" → 1700). */
function lastKg(s: string): number | null {
  const all = [...s.matchAll(/([\d,]{3,5})\s*kg/gi)].map((m) =>
    parseInt(m[1].replace(/,/g, ''), 10),
  );
  const valid = all.filter((n) => Number.isFinite(n) && n >= 800 && n <= 9000);
  return valid.length ? valid[valid.length - 1] : null;
}

/** Value = the first kg-bearing line within a few lines after a matching label. */
function valueAfter(lines: string[], labelRe: RegExp): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue;
    for (let j = i; j < Math.min(i + 4, lines.length); j++) {
      const v = lastKg(lines[j]);
      if (v != null) return v;
    }
  }
  return null;
}

interface Harvested {
  url: string;
  title: string;
  frontAxleKg: number | null;
  rearAxleKg: number | null;
  gvmKg: number | null;
  gcmKg: number | null;
}

function parseVehicle(url: string, lines: string[]): Harvested {
  // Page title line (first non-schema occurrence).
  const title =
    lines.find(
      (l) => /GVM Upgrade/i.test(l) && !l.includes('{') && l.length < 120,
    ) ?? url;
  return {
    url,
    title: title.replace(/\s*\|\s*GVM Upgrades.*/i, '').trim(),
    frontAxleKg: valueAfter(lines, /OE[M]?\b[^a-z]*front\s*axle/i),
    rearAxleKg: valueAfter(lines, /OE[M]?\b[^a-z]*rear\s*axle/i),
    gvmKg: valueAfter(lines, /\bOE[M]?\b[^a-z]*GVM\b/i),
    gcmKg: valueAfter(lines, /\bOE[M]?\b[^a-z]*GCM\b/i),
  };
}

/** Crude make+model keyword from the Lovells title, for catalogue matching. */
function modelKeyword(title: string): { make: string; kw: string } | null {
  const t = title.toLowerCase();
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

async function main() {
  console.log(`\n=== LOVELLS HARVEST (${WRITE ? 'WRITE' : 'dry-run'}) ===`);
  const listLines = await getText(LIST_URL);
  // Re-fetch the raw listing for hrefs (getText strips tags, so grab the raw HTML).
  const rawList = await (
    await fetch(LIST_URL, { headers: { 'User-Agent': UA } })
  ).text();
  const urls = [
    ...new Set(
      [
        ...rawList.matchAll(
          /https:\/\/lovells\.com\.au\/vehicle\/[a-z0-9-]+\//g,
        ),
      ].map((m) => m[0]),
    ),
  ];
  console.log(
    `found ${urls.length} vehicle pages (listing had ${listLines.length} lines)\n`,
  );

  const harvested: Harvested[] = [];
  for (const url of urls) {
    try {
      const v = parseVehicle(url, await getText(url));
      harvested.push(v);
    } catch (e) {
      console.log(`  ! ${url} — ${(e as Error).message}`);
    }
  }
  writeFileSync(OUT, harvested.map((h) => JSON.stringify(h)).join('\n') + '\n');

  // Match + report.
  let withAxle = 0;
  let matched = 0;
  let landed = 0;
  for (const h of harvested) {
    const hasAxle = h.frontAxleKg != null && h.rearAxleKg != null;
    if (hasAxle) withAxle += 1;
    const mk = modelKeyword(h.title);
    let matchNote = '';
    let matchVariantId: string | null = null;
    if (mk && h.gvmKg != null) {
      // Find a catalogue variant under this make+model whose GVM matches (±3%).
      const variants = await prisma.vehicleVariant.findMany({
        where: {
          gvmKg: {
            gte: Math.round(h.gvmKg * 0.97),
            lte: Math.round(h.gvmKg * 1.03),
          },
          model: { slug: mk.kw, make: { name: mk.make } },
        },
        orderBy: { yearTo: 'desc' },
        select: { id: true, name: true, yearFrom: true, yearTo: true },
      });
      if (variants.length) {
        matched += 1;
        matchVariantId = variants[0].id;
        matchNote = ` → ${mk.make} ${mk.kw} "${variants[0].name}" (${variants[0].yearFrom}-${variants[0].yearTo})${variants.length > 1 ? ` [+${variants.length - 1} more GVM matches]` : ''}`;
      } else {
        matchNote = ` → no ${mk.make}/${mk.kw} variant at GVM≈${h.gvmKg}`;
      }
    }
    console.log(
      `  ${h.title.slice(0, 52).padEnd(52)} F/R ${String(h.frontAxleKg ?? '—').padStart(4)}/${String(h.rearAxleKg ?? '—').padStart(4)} GVM ${h.gvmKg ?? '—'} GCM ${h.gcmKg ?? '—'}${matchNote}`,
    );

    if (WRITE && hasAxle && matchVariantId) {
      for (const [field, value] of [
        ['frontAxleLimitKg', h.frontAxleKg],
        ['rearAxleLimitKg', h.rearAxleKg],
      ] as [string, number][]) {
        const existing = await prisma.variantSpecProvenance.findUnique({
          where: { variantId_field: { variantId: matchVariantId, field } },
          select: { source: true },
        });
        if (
          existing &&
          existing.source !== 'MANUAL' &&
          existing.source !== 'CLAUDE'
        )
          continue;
        await prisma.variantSpecProvenance.upsert({
          where: { variantId_field: { variantId: matchVariantId, field } },
          create: {
            variantId: matchVariantId,
            field,
            value: String(value),
            source: 'MANUAL' as SpecProvenanceSource,
            status: 'ESTIMATE',
            sourceUrl: h.url,
            notes:
              'Lovells OEM factory axle rating (GVM-validated) — pending Rule-11 sign-off',
          },
          update: { value: String(value), sourceUrl: h.url, asOf: new Date() },
        });
        landed += 1;
      }
    }
  }

  console.log(
    `\n${harvested.length} vehicles harvested · ${withAxle} with front+rear axle · ${matched} matched a catalogue variant by GVM` +
      (WRITE
        ? ` · ${landed} axle provenance rows written (MANUAL/ESTIMATE)`
        : ''),
  );
  console.log(`raw dataset: ${OUT}`);
  if (!WRITE)
    console.log(`(dry-run — pass --write to land matched factory axles)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
