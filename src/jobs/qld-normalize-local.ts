/**
 * Deterministic normalization pass over QldFleetVehicle (the QLD fleet seed).
 *
 * Canonicalises make + model and buckets every combo:
 *   - JUNK         = make not in the canonical map (rare import/typo tail, <1% of regos)
 *   - AUTO         = canonical make AND a confidently-named model (in KNOWN_MODELS or
 *                    corroborated by a ROVER approval) → ready to promote
 *   - NEEDS_REVIEW = canonical make but the model string is ambiguous/unknown → the
 *                    residue handed to the multi-agent name-resolution workflow
 *
 * The deterministic pass deliberately does NOT try to resolve every messy model string
 * (that's the AI workflow's job) — it confidently handles the tow-relevant + common +
 * ROVER-corroborated set and flags the rest. Writes canonicalMake/canonicalModel/
 * normStatus/roverMatched back to staging.
 *
 * Usage:  DATABASE_URL=… npx jiti src/jobs/qld-normalize-local.ts [--write] [--dry-run]
 *   --dry-run (default): classify + report the split, no DB write.
 *   --write:             persist canonical fields + normStatus to QldFleetVehicle.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const WRITE = process.argv.includes('--write');

// ---- canonical make map (covers ~99% of registrations; raw upper → display) ----
const MAKE_CANON: Record<string, string> = {
  TOYOTA: 'Toyota',
  MAZDA: 'Mazda',
  HOLDEN: 'Holden',
  MITSUBISHI: 'Mitsubishi',
  FORD: 'Ford',
  HYUNDAI: 'Hyundai',
  NISSAN: 'Nissan',
  HONDA: 'Honda',
  KIA: 'Kia',
  VOLKSWAGEN: 'Volkswagen',
  VW: 'Volkswagen',
  SUBARU: 'Subaru',
  'MERCEDES-BENZ': 'Mercedes-Benz',
  'MERCEDES BENZ': 'Mercedes-Benz',
  BMW: 'BMW',
  AUDI: 'Audi',
  SUZUKI: 'Suzuki',
  ISUZU: 'Isuzu',
  'ISUZU UTE': 'Isuzu',
  JEEP: 'Jeep',
  'LAND ROVER': 'Land Rover',
  LANDROVER: 'Land Rover',
  'RANGE ROVER': 'Land Rover',
  MG: 'MG',
  VOLVO: 'Volvo',
  LEXUS: 'Lexus',
  RENAULT: 'Renault',
  PEUGEOT: 'Peugeot',
  SKODA: 'Skoda',
  MINI: 'Mini',
  FIAT: 'Fiat',
  'ALFA ROMEO': 'Alfa Romeo',
  JAGUAR: 'Jaguar',
  PORSCHE: 'Porsche',
  TESLA: 'Tesla',
  GWM: 'GWM',
  'GREAT WALL': 'GWM',
  LDV: 'LDV',
  SSANGYONG: 'SsangYong',
  CHERY: 'Chery',
  BYD: 'BYD',
  RAM: 'RAM',
  CHEVROLET: 'Chevrolet',
  DODGE: 'Dodge',
  CITROEN: 'Citroen',
  GENESIS: 'Genesis',
  HAVAL: 'Haval',
  DAIHATSU: 'Daihatsu',
  PROTON: 'Proton',
  CHRYSLER: 'Chrysler',
  SAAB: 'Saab',
  ROVER: 'Rover',
  HSV: 'HSV',
  INFINITI: 'Infiniti',
  CUPRA: 'Cupra',
  POLESTAR: 'Polestar',
};

// ---- canonical-model allowlist (tow-relevant + common) per canonical make ----
const KNOWN_MODELS: Record<string, string[]> = {
  Toyota: [
    'HILUX',
    'LANDCRUISER',
    'PRADO',
    'FORTUNER',
    'RAV4',
    'KLUGER',
    'HIACE',
    'COROLLA',
    'CAMRY',
    'YARIS',
    'C-HR',
    'COROLLA CROSS',
    '86',
    'GR YARIS',
  ],
  Ford: [
    'RANGER',
    'EVEREST',
    'FALCON',
    'TERRITORY',
    'FOCUS',
    'FIESTA',
    'ESCAPE',
    'MUSTANG',
    'MONDEO',
    'PUMA',
    'F-150',
    'TRANSIT',
    'ENDURA',
  ],
  Isuzu: ['D-MAX', 'MU-X'],
  Mitsubishi: [
    'TRITON',
    'PAJERO',
    'PAJERO SPORT',
    'OUTLANDER',
    'ASX',
    'ECLIPSE CROSS',
    'LANCER',
    'MIRAGE',
  ],
  Nissan: [
    'NAVARA',
    'PATROL',
    'X-TRAIL',
    'PATHFINDER',
    'QASHQAI',
    'JUKE',
    'MURANO',
    'DUALIS',
  ],
  Mazda: [
    'BT-50',
    'CX-3',
    'CX-30',
    'CX-5',
    'CX-8',
    'CX-9',
    'CX-60',
    'CX-7',
    'CX-70',
    'CX-90',
    'MAZDA2',
    'MAZDA3',
    'MAZDA6',
    'MX-5',
    'TRIBUTE',
    '323',
    'B2500',
    'B2600',
  ],
  Volkswagen: [
    'AMAROK',
    'TIGUAN',
    'TOUAREG',
    'GOLF',
    'POLO',
    'T-CROSS',
    'T-ROC',
    'PASSAT',
  ],
  Holden: [
    'COLORADO',
    'TRAILBLAZER',
    'COMMODORE',
    'CAPTIVA',
    'COLORADO 7',
    'RODEO',
    'BARINA',
    'CRUZE',
    'ASTRA',
    'TRAX',
    'EQUINOX',
    'ACADIA',
  ],
  Hyundai: [
    'SANTA FE',
    'TUCSON',
    'KONA',
    'I30',
    'IX35',
    'PALISADE',
    'VENUE',
    'STARIA',
  ],
  Kia: [
    'SORENTO',
    'SPORTAGE',
    'CARNIVAL',
    'SELTOS',
    'CERATO',
    'PICANTO',
    'STONIC',
  ],
  Subaru: [
    'FORESTER',
    'OUTBACK',
    'XV',
    'IMPREZA',
    'LIBERTY',
    'WRX',
    'CROSSTREK',
  ],
  Jeep: ['GRAND CHEROKEE', 'CHEROKEE', 'WRANGLER', 'COMPASS', 'GLADIATOR'],
  'Land Rover': [
    'DISCOVERY',
    'DEFENDER',
    'RANGE ROVER',
    'DISCOVERY SPORT',
    'RANGE ROVER SPORT',
  ],
  GWM: ['CANNON', 'UTE', 'HAVAL H6', 'TANK 300'],
  LDV: ['T60', 'D90', 'G10'],
  SsangYong: ['MUSSO', 'REXTON'],
  RAM: ['1500', '2500', '3500'],
  Chevrolet: ['SILVERADO', 'SILVERADO 1500', 'SILVERADO 2500'],
};

const TOW_BODY_PREFIXES = [
  'DUAL CAB',
  'UTILITY',
  'UTE CAB',
  'CAB CHASSIS',
  'WAGON',
  'VAN',
  'CAMPERVAN',
];

const isTowBody = (body: string) =>
  TOW_BODY_PREFIXES.some((p) => body.toUpperCase().startsWith(p));

function canonModel(make: string, raw: string): string {
  let m = raw.toUpperCase().replace(/\s+/g, ' ').trim();
  if (make === 'Mazda') {
    if (/^[236]$/.test(m)) m = `MAZDA${m}`; // "3" → "MAZDA3"
    m = m.replace(/^(CX-\d{1,2})A$/, '$1'); // "CX-9A" → "CX-9"
  }
  return m;
}

interface Classification {
  canonicalMake: string | null;
  canonicalModel: string | null;
  normStatus: 'AUTO' | 'NEEDS_REVIEW' | 'JUNK';
  roverMatched: boolean;
}

function classify(
  rawMake: string,
  rawModel: string,
  roverSet: Set<string>,
  known: Record<string, Set<string>>,
): Classification {
  const canonicalMake = MAKE_CANON[rawMake.toUpperCase().trim()] ?? null;
  if (!canonicalMake) {
    return {
      canonicalMake: null,
      canonicalModel: null,
      normStatus: 'JUNK',
      roverMatched: false,
    };
  }
  const cm = canonModel(canonicalMake, rawModel);
  const roverMatched = roverSet.has(`${canonicalMake.toUpperCase()}|${cm}`);
  const isKnown = known[canonicalMake]?.has(cm) ?? false;
  if (isKnown || roverMatched) {
    return {
      canonicalMake,
      canonicalModel: cm,
      normStatus: 'AUTO',
      roverMatched,
    };
  }
  return {
    canonicalMake,
    canonicalModel: cm,
    normStatus: 'NEEDS_REVIEW',
    roverMatched,
  };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  // ROVER corroboration set (normalized make|model)
  const rover = await prisma.roverApprovalIndex.findMany({
    select: { make: true, model: true, baseMake: true, baseModel: true },
  });
  const roverSet = new Set<string>();
  for (const r of rover) {
    for (const [mk, mo] of [
      [r.baseMake, r.baseModel],
      [r.make, r.model],
    ] as const) {
      if (mk && mo)
        roverSet.add(`${mk.toUpperCase().trim()}|${mo.toUpperCase().trim()}`);
    }
  }
  // pre-build known-model Sets
  const known: Record<string, Set<string>> = {};
  for (const [mk, models] of Object.entries(KNOWN_MODELS))
    known[mk] = new Set(models);

  // distinct (make, model) pairs — classification depends only on these
  const pairs = await prisma.qldFleetVehicle.groupBy({
    by: ['make', 'model'],
    _count: true,
    _sum: { registrationCount: true },
  });
  console.error(`classifying ${pairs.length} distinct (make,model) pairs…`);

  const counts = { AUTO: 0, NEEDS_REVIEW: 0, JUNK: 0 };
  let rover_n = 0;
  const updates: { make: string; model: string; c: Classification }[] = [];
  for (const p of pairs) {
    const c = classify(p.make, p.model, roverSet, known);
    counts[c.normStatus] += 1;
    if (c.roverMatched) rover_n += 1;
    updates.push({ make: p.make, model: p.model, c });
  }

  if (WRITE) {
    let done = 0;
    const CONC = 16;
    for (let i = 0; i < updates.length; i += CONC) {
      await Promise.all(
        updates.slice(i, i + CONC).map((u) =>
          prisma.qldFleetVehicle.updateMany({
            where: { make: u.make, model: u.model },
            data: {
              canonicalMake: u.c.canonicalMake,
              canonicalModel: u.c.canonicalModel,
              normStatus: u.c.normStatus,
              roverMatched: u.c.roverMatched,
            },
          }),
        ),
      );
      done += Math.min(CONC, updates.length - i);
      if (done % 1600 === 0)
        console.error(`  updated ${done}/${updates.length} pairs`);
    }
    console.error(`written.`);
  }

  // ---- report (row-level, weighted by combos) ----
  const rowsByStatus = await (WRITE
    ? prisma.qldFleetVehicle.groupBy({ by: ['normStatus'], _count: true })
    : Promise.resolve(null));

  console.log(
    `\n=== normalization split (${pairs.length} distinct make/model pairs) ===`,
  );
  console.log(`  AUTO          ${counts.AUTO}`);
  console.log(`  NEEDS_REVIEW  ${counts.NEEDS_REVIEW}`);
  console.log(`  JUNK          ${counts.JUNK}`);
  console.log(`  (ROVER-corroborated pairs: ${rover_n})`);
  if (rowsByStatus) {
    console.log('\n=== row-level (all 43k combos) ===');
    for (const r of rowsByStatus) console.log(`  ${r.normStatus}: ${r._count}`);
  }

  // actionable residue: NEEDS_REVIEW that's tow-relevant (has GVM + tow body) — what
  // the multi-agent workflow should prioritise (the rest is mostly passenger cars).
  if (WRITE) {
    const nrTow = await prisma.qldFleetVehicle.findMany({
      where: { normStatus: 'NEEDS_REVIEW', factoryGvmKg: { not: null } },
      select: {
        canonicalMake: true,
        model: true,
        bodyShape: true,
        registrationCount: true,
      },
      orderBy: { registrationCount: 'desc' },
    });
    const towResidue = nrTow.filter((r) => isTowBody(r.bodyShape));
    console.log(
      `\n=== actionable AI residue (NEEDS_REVIEW, has GVM, tow-body): ${towResidue.length} combos ===`,
    );
    for (const r of towResidue.slice(0, 15)) {
      console.log(
        `  ${r.canonicalMake} · ${r.model.trim()} · ${r.bodyShape.trim()} · ${r.registrationCount} regos`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
