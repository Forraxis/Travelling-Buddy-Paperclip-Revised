/**
 * QLD "Vehicle registrations — Light Vehicles" fleet ingest → QldFleetVehicle staging.
 *
 * Source: data.qld.gov.au open data (CKAN, NO API KEY for read). The Light-Vehicles
 * fleet carries plated **GVM + TARE/kerb** for the full registered fleet incl. utes.
 * We aggregate `GROUP BY make, model, year, body` and derive:
 *   - factoryGvmKg   = the GVM value seen on the MOST registrations (mode = factory)
 *   - kerbTareKg     = the TARE most common at that factory GVM
 *   - registrationCount = prevalence (real on-road popularity)
 *   - gvm spread + upgradeSignal = outlier GVMs above the mode == real GVM upgrades in the wild
 *
 * Caveats baked into the source (see VEHICLE_DATA_SOURCES.md): no badge, GCM column
 * blank, no axle limits, trailing-whitespace values (`trim()` is blocked in CKAN SQL).
 * Everything here is an identity + GVM/kerb SEED — it is NOT the live catalogue and is
 * NOT verified (plate stays the only green). ROVER/AI/manual layer on GCM/badge/axle.
 *
 * Usage:
 *   # dry run, no DB — fetch + aggregate + print the resulting catalogue:
 *   npx jiti src/jobs/qld-fleet-ingest-local.ts --dry-run --body="DUAL CAB"
 *   npx jiti src/jobs/qld-fleet-ingest-local.ts --dry-run            # all bodies (heavy)
 *   # write to staging (run the FULL pull via n8n/VPN, not the sandbox — home-IP rule):
 *   DATABASE_URL=… npx jiti src/jobs/qld-fleet-ingest-local.ts --write
 *
 * Flags: --dry-run | --write · --body="DUAL CAB" (LIKE prefix) · --make=TOYOTA
 *        --parts=1,2,3,4,5 · --page=20000 · --top=40 (dry-run print rows)
 */

const CKAN = 'https://www.data.qld.gov.au/api/3/action/datastore_search_sql';

// "Vehicle registrations" dataset 6632a3a0-… → Light Vehicles Parts 1–5
const LIGHT_VEHICLE_PARTS: Record<string, string> = {
  '1': '16352b55-fc97-442b-a741-52276d18ff30',
  '2': '2d5d94d7-ef80-4293-8c0f-437735dbf6f6',
  '3': '46da194e-d4cd-4066-81ad-6fab40e0fcfc',
  '4': 'edd505f7-70da-451d-b4cc-6d91f01714d9',
  '5': 'f4427a2b-e666-4f30-9212-91750fcb765b',
};

// ---- args ----------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, def = ''): string => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const DRY = flag('dry-run') || !flag('write');
const BODY_LIKE = opt('body'); // e.g. "DUAL CAB" (handles trailing whitespace via LIKE 'X%')
const MAKE = opt('make');
const PARTS = (opt('parts') || '1,2,3,4,5').split(',').map((s) => s.trim());
const PAGE = parseInt(opt('page') || '20000', 10);
const TOP = parseInt(opt('top') || '40', 10);

// ---- minimal normalizer (starter — full pass reuses the ROVER normalizer) -
const MAKE_ALIASES: Record<string, string> = {
  'ISUZU UTE': 'ISUZU',
  VW: 'VOLKSWAGEN',
  'MERCEDES BENZ': 'MERCEDES-BENZ',
  LANDROVER: 'LAND ROVER',
};
const norm = (s: unknown): string =>
  String(s ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
const normMake = (s: unknown): string => {
  const n = norm(s);
  return MAKE_ALIASES[n] ?? n;
};
const toInt = (s: unknown): number | null => {
  const n = parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// ---- CKAN fetch ----------------------------------------------------------
interface Row {
  mk: string;
  mo: string;
  yr: string;
  body: string;
  fuel: string;
  cyl: string;
  gvm: string;
  tare: string;
  n: string;
}

function buildSql(rid: string, limit: number, offset: number): string {
  const where: string[] = [];
  // NB: Make/Body values carry trailing whitespace in the CKAN datastore, and
  // `trim()` is not whitelisted — match with LIKE 'X%' (server) + normalize (client).
  if (BODY_LIKE)
    where.push(`"Body Shape" LIKE '${BODY_LIKE.replace(/'/g, "''")}%'`);
  if (MAKE) where.push(`"Make" LIKE '${MAKE.replace(/'/g, "''")}%'`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return (
    `SELECT "Make" mk, "Model" mo, "Year of Manufacture" yr, "Body Shape" body, ` +
    `"Fuel Type" fuel, "Number of Cylinders" cyl, "GVM Weight" gvm, "TARE Weight" tare, ` +
    `count(*) n FROM "${rid}" ${w} GROUP BY 1,2,3,4,5,6,7,8 ` +
    `ORDER BY 1,2,3,4,7 LIMIT ${limit} OFFSET ${offset}`
  );
}

async function fetchPart(part: string): Promise<Row[]> {
  const rid = LIGHT_VEHICLE_PARTS[part];
  if (!rid) throw new Error(`unknown part ${part}`);
  const out: Row[] = [];
  let offset = 0;
  for (;;) {
    const url = `${CKAN}?${new URLSearchParams({ sql: buildSql(rid, PAGE, offset) })}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`part ${part} HTTP ${res.status}`);
    const json = (await res.json()) as {
      success: boolean;
      error?: unknown;
      result?: { records: Row[] };
    };
    if (!json.success)
      throw new Error(`part ${part} CKAN error: ${JSON.stringify(json.error)}`);
    const recs = json.result?.records ?? [];
    out.push(...recs);
    process.stderr.write(
      `  part ${part}: +${recs.length} (total ${out.length})\n`,
    );
    if (recs.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

// ---- aggregation ---------------------------------------------------------
interface Combo {
  make: string;
  model: string;
  year: number;
  body: string;
  fuel: string | null;
  cylinders: number | null;
  prevalence: number;
  gvmCounts: Map<number, number>; // gvm → registrations
  tareAtGvm: Map<number, Map<number, number>>; // gvm → (tare → count)
}

function aggregate(rows: Row[]): Combo[] {
  const map = new Map<string, Combo>();
  for (const r of rows) {
    const year = toInt(r.yr);
    if (!year || year < 1950 || year > 2030) continue;
    const make = normMake(r.mk);
    const model = norm(r.mo);
    const body = norm(r.body);
    if (!make || !model) continue;
    const key = `${make}|${model}|${year}|${body}`;
    let c = map.get(key);
    if (!c) {
      c = {
        make,
        model,
        year,
        body,
        fuel: norm(r.fuel) || null,
        cylinders: toInt(r.cyl),
        prevalence: 0,
        gvmCounts: new Map(),
        tareAtGvm: new Map(),
      };
      map.set(key, c);
    }
    const n = toInt(r.n) ?? 0;
    const gvm = toInt(r.gvm);
    const tare = toInt(r.tare);
    c.prevalence += n;
    if (gvm) {
      c.gvmCounts.set(gvm, (c.gvmCounts.get(gvm) ?? 0) + n);
      if (tare) {
        const tm = c.tareAtGvm.get(gvm) ?? new Map<number, number>();
        tm.set(tare, (tm.get(tare) ?? 0) + n);
        c.tareAtGvm.set(gvm, tm);
      }
    }
  }
  return [...map.values()];
}

interface Derived {
  make: string;
  model: string;
  year: number;
  body: string;
  fuel: string | null;
  cylinders: number | null;
  factoryGvmKg: number | null;
  kerbTareKg: number | null;
  registrationCount: number;
  gvmDistinctCount: number;
  gvmMinKg: number | null;
  gvmMaxKg: number | null;
  gvmUpgradeSignal: boolean;
  gvmDistribution: { gvm: number; n: number }[];
}

const modeOf = (m: Map<number, number>): number | null => {
  let best: number | null = null;
  let bestN = -1;
  for (const [v, n] of m) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
};

function derive(combos: Combo[]): Derived[] {
  return combos.map((c) => {
    const factoryGvmKg = modeOf(c.gvmCounts);
    const tm = factoryGvmKg ? c.tareAtGvm.get(factoryGvmKg) : undefined;
    const kerbTareKg = tm ? modeOf(tm) : null;
    const gvms = [...c.gvmCounts.keys()].sort((a, b) => a - b);
    const dist = [...c.gvmCounts.entries()]
      .map(([gvm, n]) => ({ gvm, n }))
      .sort((a, b) => b.n - a.n);
    // upgrade signal: a GVM ≥5% above the factory mode, with real registrations.
    const upgrade =
      !!factoryGvmKg &&
      gvms.some(
        (g) => g >= factoryGvmKg * 1.05 && (c.gvmCounts.get(g) ?? 0) >= 2,
      );
    return {
      make: c.make,
      model: c.model,
      year: c.year,
      body: c.body,
      fuel: c.fuel,
      cylinders: c.cylinders,
      factoryGvmKg,
      kerbTareKg,
      registrationCount: c.prevalence,
      gvmDistinctCount: gvms.length,
      gvmMinKg: gvms[0] ?? null,
      gvmMaxKg: gvms[gvms.length - 1] ?? null,
      gvmUpgradeSignal: upgrade,
      gvmDistribution: dist,
    };
  });
}

// ---- main ----------------------------------------------------------------
async function main() {
  console.error(
    `QLD fleet ingest — ${DRY ? 'DRY RUN (no DB)' : 'WRITE'} · parts=${PARTS.join(',')}` +
      `${BODY_LIKE ? ` · body~"${BODY_LIKE}"` : ''}${MAKE ? ` · make=${MAKE}` : ''}`,
  );
  const rows: Row[] = [];
  for (const p of PARTS) rows.push(...(await fetchPart(p)));
  console.error(`fetched ${rows.length} grouped source rows; aggregating…`);

  const combos = aggregate(rows);
  const derived = derive(combos).sort(
    (a, b) => b.registrationCount - a.registrationCount,
  );

  const withGvm = derived.filter((d) => d.factoryGvmKg).length;
  const upgrades = derived.filter((d) => d.gvmUpgradeSignal).length;
  console.error(
    `\n→ ${derived.length} distinct (make·model·year·body) combos · ` +
      `${withGvm} with factory GVM · ${upgrades} show GVM-upgrade spread\n`,
  );

  if (DRY) {
    const pad = (s: unknown, n: number) =>
      String(s ?? '')
        .padEnd(n)
        .slice(0, n);
    console.log(
      pad('MAKE', 12) +
        pad('MODEL', 16) +
        pad('YR', 5) +
        pad('BODY', 12) +
        pad('GVM', 6) +
        pad('KERB', 6) +
        pad('REGOS', 7) +
        'GVM SPREAD (mode→outliers)',
    );
    console.log('-'.repeat(96));
    for (const d of derived.slice(0, TOP)) {
      const spread = d.gvmDistribution
        .slice(0, 4)
        .map((x) => `${x.gvm}×${x.n}`)
        .join(' ');
      console.log(
        pad(d.make, 12) +
          pad(d.model, 16) +
          pad(d.year, 5) +
          pad(d.body, 12) +
          pad(d.factoryGvmKg ?? '—', 6) +
          pad(d.kerbTareKg ?? '—', 6) +
          pad(d.registrationCount, 7) +
          (d.gvmUpgradeSignal ? '⚠ ' : '  ') +
          spread,
      );
    }
    console.log(
      `\n(showing top ${Math.min(TOP, derived.length)} of ${derived.length} by prevalence; ` +
        `⚠ = GVM-upgrade spread in the wild)`,
    );
    return;
  }

  // ---- write path: construct own PrismaClient (Prisma 7 + PrismaPg adapter) ----
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const toRow = (d: Derived) => ({
    make: d.make,
    model: d.model,
    yearOfManufacture: d.year,
    bodyShape: d.body,
    fuelType: d.fuel,
    cylinders: d.cylinders,
    factoryGvmKg: d.factoryGvmKg,
    kerbTareKg: d.kerbTareKg,
    registrationCount: d.registrationCount,
    gvmDistinctCount: d.gvmDistinctCount,
    gvmMinKg: d.gvmMinKg,
    gvmMaxKg: d.gvmMaxKg,
    gvmUpgradeSignal: d.gvmUpgradeSignal,
    gvmDistribution: d.gvmDistribution,
  });

  if (!MAKE && !BODY_LIKE) {
    // Full snapshot refresh — fastest path: clear the prior QLD snapshot, then
    // bulk-insert in chunks (a fleet pull replaces the previous snapshot wholesale).
    await prisma.qldFleetVehicle.deleteMany({
      where: { source: 'QLD_LIGHT_VEHICLE_FLEET' },
    });
    const CHUNK = 1000;
    let n = 0;
    for (let i = 0; i < derived.length; i += CHUNK) {
      const batch = derived.slice(i, i + CHUNK).map(toRow);
      await prisma.qldFleetVehicle.createMany({ data: batch });
      n += batch.length;
      console.error(`  inserted ${n}/${derived.length}`);
    }
    console.error(`done — full refresh, inserted ${n} QldFleetVehicle rows.`);
  } else {
    // Filtered write (e.g. one make/body) — upsert so it doesn't clobber the rest.
    let n = 0;
    for (const d of derived) {
      const row = toRow(d);
      await prisma.qldFleetVehicle.upsert({
        where: {
          make_model_yearOfManufacture_bodyShape: {
            make: d.make,
            model: d.model,
            yearOfManufacture: d.year,
            bodyShape: d.body,
          },
        },
        create: row,
        update: row,
      });
      if (++n % 500 === 0) console.error(`  upserted ${n}/${derived.length}`);
    }
    console.error(`done — upserted ${n} QldFleetVehicle rows.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
