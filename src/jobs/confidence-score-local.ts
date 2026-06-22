/**
 * Backfill per-value CONFIDENCE (HIGH/MEDIUM/LOW) + corroboratingCount on the landed
 * spec provenance, so the calculator can SHOW every value labelled by how much we trust
 * it (+ a "help us verify" CTA) instead of hard-hiding ESTIMATEs.
 *
 * This does NOT change `status` (the compliance gate) — confidence is the display grade;
 * status→VERIFIED still only happens on a plate/user confirm. It scores the source-driven
 * estimates (MANUAL = our Brave/Lovells/vendor landings; CLAUDE = grounded AI). Authoritative
 * ROVER/QLD rows are left alone (their CONFIRMED status already speaks for them).
 *
 * Signal → tier:
 *   - HIGH   : manufacturer (OEM) spec sheet, recognised GVM-cert certifier (Lovells), OR
 *              ≥2 independent sources agree (corroboration).
 *   - MEDIUM : a single credible AU vendor (.com.au suspension / 4x4 / dealer spec sheet).
 *   - LOW    : a single foreign / aggregator / unknown source — show but flag "unverified".
 * Every landed value is already GVM-validated (that was the land criterion), so that isn't a
 * differentiator here; authority + corroboration are.
 *
 * Corroboration is recovered best-effort from the scratch extract files that still exist
 * (.brave-extracted / .experiment-extracted) — where a run's file was overwritten the count
 * is conservative (won't falsely promote), so authority carries those.
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/confidence-score-local.ts          # dry-run (distribution)
 *   DATABASE_URL=… npx tsx src/jobs/confidence-score-local.ts --write  # persist
 */
import { readFileSync, existsSync } from 'node:fs';
import type { SpecFieldConfidence } from '@prisma/client';
import { prisma } from '../lib/db';

const WRITE = process.argv.includes('--write');

/** Manufacturer official domains (any market — it's the OEM's own GAWR, GVM-validated). */
const OEM = [
  'toyota.com.au',
  'toyota.com',
  'ford.com.au',
  'ford.com',
  'fordmedia.com.au',
  'nissan.com.au',
  'nissan-cdn.net',
  'nissannews.com',
  'mitsubishi-motors.com.au',
  'mitsubishicars.com',
  'mazda.com.au',
  'mazdausa.com',
  'isuzuute.com.au',
  'hyundai.com.au',
  'hyundai.com',
  'kia.com.au',
  'kia.com',
  'honda.com.au',
  'honda.co.uk',
  'subaru.com.au',
  'subaru.com',
  'volkswagen.com.au',
  'volkswagen-vans.com.au',
  'vw.com',
  'vwcommercial.com.au',
  'mercedes-benz.com.au',
  'fiat.com.au',
  'fiatprofessional.com',
  'peugeot.com.au',
  'renault.com.au',
  'ldvautomotive.com.au',
  'gwm.com.au',
  'gwmanz.com.au',
  'ssangyong.com.au',
  'jeep.com.au',
  'ramtrucks.com.au',
  'chevrolet.com',
  'holden.com.au',
  'landrover.com.au',
  'suzuki.com.au',
];
/** Recognised GVM-upgrade certifiers that cite the FACTORY axle to baseline their kit. */
const CERT = [
  'lovells.com.au',
  'lovellsadelaide.com.au',
  'lovellssprings.com.au',
];

type Authority = 'oem' | 'cert' | 'au-vendor' | 'foreign';

function hostOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).host.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}
const matches = (host: string, domains: string[]) =>
  domains.some((d) => host === d || host.endsWith('.' + d));

function authorityOf(host: string): Authority {
  if (matches(host, OEM)) return 'oem';
  if (matches(host, CERT)) return 'cert';
  if (
    host.endsWith('.com.au') ||
    host.endsWith('.net.au') ||
    host.endsWith('.au')
  )
    return 'au-vendor';
  return 'foreign';
}

/** field|value|gvmBucket → set of hosts that reported it (recovered from scratch files). */
function loadCorroboration(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (key: string, host: string) => {
    (map.get(key) ?? map.set(key, new Set()).get(key)!).add(host);
  };
  for (const f of [
    'ops/n8n/.brave-extracted.jsonl',
    'ops/n8n/.experiment-extracted.jsonl',
  ]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
      let d: { host?: string; specs?: Record<string, number | null> };
      try {
        d = JSON.parse(line);
      } catch {
        continue;
      }
      const host = (d.host ?? '').replace(/^www\./, '');
      const specs = d.specs ?? {};
      const gvm = specs.gvmKg;
      const bucket = gvm ? Math.round(gvm / 100) : NaN;
      for (const [field, val] of Object.entries(specs)) {
        if (val == null || field === 'gvmKg') continue;
        add(`${field}|${val}|${bucket}`, host);
      }
    }
  }
  return map;
}

/** distinct hosts agreeing on this field+value at this variant's GVM (±1 bucket). */
function corroboration(
  corr: Map<string, Set<string>>,
  field: string,
  value: string,
  gvm: number | null,
): number {
  if (gvm == null) return 0;
  const b = Math.round(gvm / 100);
  const hosts = new Set<string>();
  for (const db of [b - 1, b, b + 1])
    for (const h of corr.get(`${field}|${value}|${db}`) ?? []) hosts.add(h);
  return hosts.size;
}

function tier(auth: Authority, corrob: number): SpecFieldConfidence {
  if (corrob >= 2) return 'HIGH';
  if (auth === 'oem' || auth === 'cert') return 'HIGH';
  if (auth === 'au-vendor') return 'MEDIUM';
  return 'LOW';
}

async function main() {
  const corr = loadCorroboration();
  console.log(
    `\n=== CONFIDENCE BACKFILL (${WRITE ? 'WRITE' : 'dry-run'}) · corroboration index: ${corr.size} keys ===\n`,
  );

  const rows = await prisma.variantSpecProvenance.findMany({
    // Only real values get a display grade — skip the `value=null` "known-absent"
    // markers (confidence in an absence isn't a number we show).
    where: { source: { in: ['MANUAL', 'CLAUDE'] }, value: { not: null } },
    select: {
      id: true,
      field: true,
      value: true,
      source: true,
      sourceUrl: true,
      variant: { select: { gvmKg: true } },
    },
  });

  const dist: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byAuth: Record<string, number> = {};
  let corrobBumps = 0;
  const samples: Record<string, string[]> = { HIGH: [], MEDIUM: [], LOW: [] };
  const updates: {
    id: string;
    confidence: SpecFieldConfidence;
    corr: number;
  }[] = [];

  for (const r of rows) {
    const host = hostOf(r.sourceUrl);
    const auth = authorityOf(host);
    const c = corroboration(corr, r.field, r.value ?? '', r.variant.gvmKg);
    const t = tier(auth, c);
    if (c >= 2 && auth !== 'oem' && auth !== 'cert') corrobBumps += 1;
    dist[t] += 1;
    byAuth[auth] = (byAuth[auth] ?? 0) + 1;
    if (samples[t].length < 4)
      samples[t].push(
        `      ${r.field}=${r.value} ${host || '(no url)'} [${auth}${c >= 2 ? `, ${c}× corrob` : ''}]`,
      );
    updates.push({ id: r.id, confidence: t, corr: c });
  }

  console.log(`scored ${rows.length} MANUAL/CLAUDE rows`);
  console.log(
    `\n  by tier:  HIGH ${dist.HIGH} · MEDIUM ${dist.MEDIUM} · LOW ${dist.LOW}`,
  );
  console.log(
    `  by source authority:  ${Object.entries(byAuth)
      .sort((a, b) => b[1] - a[1])
      .map(([a, n]) => `${a} ${n}`)
      .join(' · ')}`,
  );
  console.log(`  corroboration bumps to HIGH (≥2 sources): ${corrobBumps}`);
  for (const t of ['HIGH', 'MEDIUM', 'LOW'] as const) {
    console.log(`\n  ${t} samples:`);
    for (const s of samples[t]) console.log(s);
  }

  // axle-only view (the differentiator field)
  const axle = updates.filter((_, i) =>
    ['frontAxleLimitKg', 'rearAxleLimitKg'].includes(rows[i].field),
  );
  const axleDist = axle.reduce<Record<string, number>>((a, u) => {
    a[u.confidence] = (a[u.confidence] ?? 0) + 1;
    return a;
  }, {});
  console.log(
    `\n  AXLE rows only: HIGH ${axleDist.HIGH ?? 0} · MEDIUM ${axleDist.MEDIUM ?? 0} · LOW ${axleDist.LOW ?? 0}`,
  );

  if (WRITE) {
    let n = 0;
    for (const u of updates) {
      await prisma.variantSpecProvenance.update({
        where: { id: u.id },
        data: { confidence: u.confidence, corroboratingCount: u.corr },
      });
      if (++n % 500 === 0) console.log(`  …${n}/${updates.length}`);
    }
    console.log(
      `\n✓ wrote confidence + corroboratingCount on ${updates.length} rows`,
    );
  } else {
    console.log('\n(dry-run — pass --write to persist)');
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
