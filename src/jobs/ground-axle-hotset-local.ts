/**
 * Grounded "hot-set" spec backfill — AI web-grounding for the top tow rigs. [task #6/#11]
 *
 * Fills the axle-limit gap (and any other missing headline field) for the most
 * common AU tow vehicles by QLD-registration prevalence, using the grounded Claude
 * provider (Opus 4.8 + server-side web search). Results land in VariantSpecProvenance
 * as source=CLAUDE / status=ESTIMATE — they are reviewable per-field figures with
 * citations and DO NOT touch the VehicleVariant compliance columns or lift the
 * Rule-11 gate. The plate stays the only path to VERIFIED (VEHICLE_DATA_SOURCES.md).
 *
 * Trust precedence: a field that already carries a QLD_REGO or ROVER provenance row
 * is NEVER overwritten — grounding only fills empty fields (axles, tow-ball, overhangs,
 * fuel) or refreshes a prior CLAUDE row. So this is purely additive to the catalogue's
 * existing higher-trust data.
 *
 * RESUMABLE / NO DOUBLE-SPEND: each vehicle's provenance is written immediately in
 * one transaction after its fetch returns; a vehicle that already has ANY CLAUDE
 * provenance row is skipped. So a credit-out or crash mid-run never re-pays for a
 * completed vehicle — just re-run the same command to continue.
 *
 * Usage:
 *   # dry-run (default): list the selected targets + projected cost, NO API calls / spend
 *   DATABASE_URL=… npx tsx src/jobs/ground-axle-hotset-local.ts --top=25
 *   # spend: requires ANTHROPIC_API_KEY in env
 *   DATABASE_URL=… ANTHROPIC_API_KEY=… npx tsx src/jobs/ground-axle-hotset-local.ts --top=25 --write
 *   …--top=1 --write     # 1-vehicle smoke test (validate prompt/parse/cost before the full run)
 *   …--model=claude-sonnet-4-6   # cheaper model (~½ the token cost) if stretching budget
 *   …--budget=18                 # hard spend ceiling (USD); the loop stops before exceeding it
 *
 * Cost (measured, Opus 4.8 + web search): ~$0.65/vehicle. 25 ≈ $16. A --budget
 * ceiling (default $18) hard-stops the loop so a run can't blow past the credit.
 * NOTE: front/rear AXLE LIMITS are not web-published — grounding returns them null;
 * it fills gcm / overhangs / fuel / dimensions gaps. Axles need the owner's-manual
 * VLM path (Ollama). See the run findings in CATALOGUE_BUILD_HANDOVER.md.
 */
import { prisma } from '../lib/db';
import { toSlug } from '../lib/spec-fetch/rover/gvm-upgrade';
import { ClaudeSpecFetchProvider } from '../lib/spec-fetch/providers/claude';
import type { SpecFieldConfidence } from '@prisma/client';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const TOP = Number(
  args.find((a) => a.startsWith('--top='))?.slice('--top='.length) ?? '25',
);
const MODEL = args
  .find((a) => a.startsWith('--model='))
  ?.slice('--model='.length);
const DEBUG = args.includes('--debug');
// Hard spend ceiling (USD). The loop stops before a fetch that could exceed it,
// so a run can never blow past the credit on the account. Default leaves margin
// under a $20 balance. Override with --budget=.
const BUDGET = Number(
  args.find((a) => a.startsWith('--budget='))?.slice('--budget='.length) ??
    '18',
);
// Conservative per-vehicle cost guess used only to decide whether the NEXT fetch
// fits under BUDGET (Opus grounded ~$0.70; halve for Sonnet).
const EST_PER_VEHICLE = MODEL?.includes('sonnet') ? 0.35 : 0.7;
// Real "now" can't come from Date in workflow scripts, but this is a plain job —
// cap future-dated ROVER yearTo ranges so grounding targets the actual model year.
const CURRENT_YEAR = new Date().getFullYear();

/** ROVER variant names are often raw VIN/platform codes ("GUN227R-DTTMRQ", "307",
 * "469") that confuse grounding. Keep only human-readable names; drop pure codes
 * so the model grounds on make+model+year. */
function cleanVariantName(name: string): string | null {
  const n = name.trim();
  if (/^\d+$/.test(n)) return null; // bare number ("307")
  if (/^[A-Z0-9][A-Z0-9-]{4,}$/.test(n) && !/\s/.test(n)) return null; // code, no spaces
  return n;
}

// Opus 4.8 pricing ($/MTok) + web search ($/req) — for the cost estimate/report.
const PRICE_IN = MODEL?.includes('sonnet') ? 3 : 5;
const PRICE_OUT = MODEL?.includes('sonnet') ? 15 : 25;
const PRICE_SEARCH = 0.01;

interface Target {
  variantId: string;
  make: string;
  model: string;
  variantName: string;
  yearFrom: number;
  yearTo: number;
  prevalence: number;
}

/** Top tow nameplates by QLD registration prevalence → one current catalogue
 * variant each (the most recent yearTo). */
async function selectTargets(limit: number): Promise<Target[]> {
  // Prevalence by canonical make+model over tow bodies (QldFleetVehicle).
  const fleet = await prisma.qldFleetVehicle.groupBy({
    by: ['canonicalMake', 'canonicalModel'],
    where: {
      normStatus: 'AUTO',
      canonicalMake: { not: null },
      canonicalModel: { not: null },
      // Tow bodies only (dual cab / ute / cab-chassis / wagon / van) so prevalence
      // ranks the tow rigs, not sedan-heavy nameplates.
      OR: [
        { bodyShape: { contains: 'CAB', mode: 'insensitive' } },
        { bodyShape: { contains: 'UTIL', mode: 'insensitive' } },
        { bodyShape: { contains: 'UTE', mode: 'insensitive' } },
        { bodyShape: { contains: 'WAGON', mode: 'insensitive' } },
        { bodyShape: { contains: 'VAN', mode: 'insensitive' } },
      ],
    },
    _sum: { registrationCount: true },
  });
  // Rank by prevalence desc.
  const ranked = fleet
    .map((f) => ({
      make: f.canonicalMake as string,
      model: f.canonicalModel as string,
      prevalence: f._sum.registrationCount ?? 0,
    }))
    .filter((f) => f.prevalence > 0)
    .sort((a, b) => b.prevalence - a.prevalence);

  const targets: Target[] = [];
  const seenModel = new Set<string>();
  for (const r of ranked) {
    if (targets.length >= limit) break;
    const makeSlug = toSlug(r.make);
    const modelSlug = toSlug(r.model);
    const key = `${makeSlug}/${modelSlug}`;
    if (seenModel.has(key)) continue;
    seenModel.add(key);

    const model = await prisma.vehicleModel.findFirst({
      where: { slug: modelSlug, make: { slug: makeSlug } },
      select: {
        name: true,
        make: { select: { name: true } },
        variants: {
          orderBy: [{ yearTo: 'desc' }, { yearFrom: 'desc' }],
          take: 1,
          select: { id: true, name: true, yearFrom: true, yearTo: true },
        },
      },
    });
    const v = model?.variants[0];
    if (!model || !v) continue; // model in fleet but not (yet) in catalogue — skip
    targets.push({
      variantId: v.id,
      make: model.make.name,
      model: model.name,
      variantName: v.name,
      yearFrom: v.yearFrom,
      yearTo: v.yearTo,
      prevalence: r.prevalence,
    });
  }
  return targets;
}

async function main() {
  if (!Number.isFinite(TOP) || TOP < 1) {
    throw new Error(`--top must be a positive integer (got ${TOP})`);
  }
  const targets = await selectTargets(TOP);

  // Resume: which targets already have CLAUDE provenance (done) → skip on --write.
  const done = new Set(
    (
      await prisma.variantSpecProvenance.findMany({
        where: {
          source: 'CLAUDE',
          variantId: { in: targets.map((t) => t.variantId) },
        },
        select: { variantId: true },
        distinct: ['variantId'],
      })
    ).map((r) => r.variantId),
  );

  console.log(
    `\n=== HOT-SET GROUNDING (${WRITE ? 'WRITE' : 'dry-run'}) · model=${MODEL ?? 'claude-opus-4-8'} ===`,
  );
  console.log(
    `${targets.length} targets (top ${TOP} by QLD prevalence) · ${done.size} already grounded (will skip)\n`,
  );
  targets.forEach((t, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)}. ${t.make} ${t.model} — "${t.variantName}" (${t.yearFrom}-${t.yearTo})` +
        `  [${t.prevalence.toLocaleString()} regs]${done.has(t.variantId) ? '  ✓done' : ''}`,
    ),
  );

  if (!WRITE) {
    const todo = targets.length - done.size;
    console.log(
      `\n(dry-run — ${todo} would be grounded; est. cost ≈ $${(todo * 0.27).toFixed(2)} on Opus 4.8.` +
        ` Pass --write with ANTHROPIC_API_KEY set to spend.)`,
    );
    await prisma.$disconnect();
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — required for --write.');
  }

  const provider = new ClaudeSpecFetchProvider(MODEL ? { model: MODEL } : {});
  let spent = 0;
  let grounded = 0;
  let fieldsWritten = 0;

  for (const t of targets) {
    if (done.has(t.variantId)) continue;
    if (spent + EST_PER_VEHICLE > BUDGET) {
      console.log(
        `\n⚠ stopping: ~$${spent.toFixed(2)} spent, next vehicle could exceed the $${BUDGET} budget. ` +
          `Re-run to resume (already-grounded vehicles are skipped).`,
      );
      break;
    }
    process.stdout.write(
      `  → ${t.make} ${t.model} ${t.yearFrom}-${t.yearTo} … `,
    );

    let result;
    try {
      result = await provider.fetchVehicleSpec({
        makeName: t.make,
        modelName: t.model,
        variantName: cleanVariantName(t.variantName),
        yearFrom: t.yearFrom,
        // Cap a future-dated ROVER range to the real model year so grounding
        // targets a vehicle that actually exists on the web (never inverted).
        yearTo: Math.max(t.yearFrom, Math.min(t.yearTo, CURRENT_YEAR)),
        market: 'AU',
      });
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
      continue; // leave for the next run; nothing persisted for this vehicle
    }

    if (DEBUG) {
      console.log(
        `\n    [debug] raw=${JSON.stringify((result.raw as { recordInput?: unknown }).recordInput)}`,
      );
    }

    // Cost from usage.
    const u = (
      result.raw as {
        usage?: {
          input_tokens: number;
          output_tokens: number;
          web_search_requests: number;
        };
      }
    ).usage;
    const cost = u
      ? (u.input_tokens / 1e6) * PRICE_IN +
        (u.output_tokens / 1e6) * PRICE_OUT +
        u.web_search_requests * PRICE_SEARCH
      : 0;
    spent += cost;

    // Persist — fill empty fields or refresh prior CLAUDE rows; never clobber QLD/ROVER.
    const nonNull = result.fields.filter((f) => f.value !== null);
    let wrote = 0;
    if (nonNull.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const f of result.fields) {
          const existing = await tx.variantSpecProvenance.findUnique({
            where: {
              variantId_field: { variantId: t.variantId, field: f.field },
            },
            select: { source: true },
          });
          if (existing && existing.source !== 'CLAUDE') continue; // keep higher-trust value
          await tx.variantSpecProvenance.upsert({
            where: {
              variantId_field: { variantId: t.variantId, field: f.field },
            },
            create: {
              variantId: t.variantId,
              field: f.field,
              value: f.value,
              source: 'CLAUDE',
              status: 'ESTIMATE',
              confidence: (f.confidence as SpecFieldConfidence | null) ?? null,
              sourceUrl: f.sourceUrl,
            },
            update: {
              value: f.value,
              confidence: (f.confidence as SpecFieldConfidence | null) ?? null,
              sourceUrl: f.sourceUrl,
              asOf: new Date(),
            },
          });
          wrote += 1;
        }
      });
    }
    fieldsWritten += wrote;
    grounded += 1;
    const axle = result.fields.find(
      (f) => f.field === 'frontAxleLimitKg',
    )?.value;
    const raxle = result.fields.find(
      (f) => f.field === 'rearAxleLimitKg',
    )?.value;
    console.log(
      `ok (${wrote} fields, axle F/R ${axle ?? '—'}/${raxle ?? '—'}) ` +
        `$${cost.toFixed(3)} · running $${spent.toFixed(2)}`,
    );
  }

  console.log(
    `\n✓ grounded ${grounded} vehicles, ${fieldsWritten} provenance rows written, total ≈ $${spent.toFixed(2)} spent.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
