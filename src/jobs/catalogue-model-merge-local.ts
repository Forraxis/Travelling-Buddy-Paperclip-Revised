/**
 * Consolidate fragmented nameplate models (QLD ↔ ROVER merge).  [task #12]
 *
 * QLD promotion creates clean nameplates ("HiLux", "LandCruiser", "Ranger") while
 * ROVER promotion mints models from the RVD's raw platform/generation strings
 * ("Hilux 8GEN", "Hilux AN2", "Landcruiser 300 J30T", "D23 Navara", "RANGER 3 NB1",
 * "RAV4 XA5", "Corolla XG1TJ"). The same vehicle therefore appears as several
 * VehicleModels, which breaks "one model per nameplate" and clean search.
 *
 * This job folds every fragmented model back onto its canonical nameplate, WITHIN
 * the same make, by stripping trailing/leading platform-code + generation-number +
 * second-stage-noise tokens and grouping by the cleaned slug. It then:
 *   - picks the canonical target = the clean nameplate the catalogue already holds
 *     (the QLD "HiLux"); groups with no such anchor are reported, never merged,
 *   - re-points every variant of the other models onto the target (modelId update;
 *     re-slugs on the rare (modelId, slug) collision so nothing is lost),
 *   - leaves GvmUpgrade overlays untouched — they reference baseVariantId, so moving
 *     the variant carries its overlay onto the canonical model automatically,
 *   - deletes the emptied source models.
 *
 * SAFETY: a group only merges when its canonical key matches an EXISTING sibling
 * model's slug — a real nameplate the catalogue already holds ("Navara", onto which
 * "D23 Navara" + "D27 Navara" fold). Anything with no such anchor (platform-code-only
 * models like Audi "F1C"/BMW "X Series - G05"; ambiguous Polestar 2/3/4) is NEVER
 * merged blindly — it is reported as residue for Tim's review.
 *
 * No data is lost — variants and overlays move, only empty model shells are deleted.
 * Everything stays ESTIMATE-pending-plate (this touches identity, not spec trust).
 *
 * Usage:
 *   DATABASE_URL=… npx tsx src/jobs/catalogue-model-merge-local.ts            # dry-run (default)
 *   DATABASE_URL=… npx tsx src/jobs/catalogue-model-merge-local.ts --write    # apply
 *   …--make="Toyota"        # restrict to one make
 *
 * Lone fragments with no clean anchor ("Supra J29", "Tesla Model 3") and multi-
 * fragment groups with no anchor (Polestar 2/3/4, BMW N-Series) are REPORTED for
 * Tim, never auto-merged — stripping a trailing number is sometimes a generation
 * (HiLux 8GEN) and sometimes a distinct sub-nameplate (Model 3). Editorial call.
 *
 * Idempotent — a second run is a no-op (canonical models clean themselves).
 */
import { prisma } from '../lib/db';
import { toSlug } from '../lib/spec-fetch/rover/gvm-upgrade';

// --- args ---------------------------------------------------------------------
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const MAKE_FILTER = args
  .find((a) => a.startsWith('--make='))
  ?.slice('--make='.length)
  .toLowerCase();

// --- canonicalisation ---------------------------------------------------------

/** Second-stage / up-spec noise that rides along in the model column. Kept tight
 * on purpose — body/drive words live on the variant, and over-stripping would
 * mangle real nameplates ("Yaris Cross", "Grand Cherokee"). */
const STRIP_WORDS = new Set([
  'ssm',
  'gvm',
  'gvm1',
  'gvm2',
  'plus',
  'upgrade',
  'high',
  'std',
  'wide',
  'narrow',
  'ser',
  'od',
  'awd',
  'fwd',
  'rwd',
]);

/** An alphanumeric platform/generation code: mixes letters and digits
 * (AN2, 8GEN, J30T, XA5, G05, D23, XG1TJ). */
function isPlatformCode(tok: string): boolean {
  return /[a-z]/.test(tok) && /[0-9]/.test(tok);
}

/** A token we can shave off the head/tail of a model name without losing the
 * nameplate: a bare generation number ("300", "3"), a platform code, or a known
 * noise word. Empty/punctuation tokens are strippable too (dangling "-"). */
function isStrippable(tok: string): boolean {
  const n = tok.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n === '') return true;
  if (/^\d+$/.test(n)) return true;
  if (isPlatformCode(n)) return true;
  if (STRIP_WORDS.has(n)) return true;
  return false;
}

/** Strip leading + trailing strippable tokens, never reducing to empty. Returns
 * the cleaned display name (original casing of surviving tokens preserved). */
function canonicalName(name: string): string {
  const tokens = name.split(/[\s/]+/).filter((t) => t.length > 0);
  let lo = 0;
  let hi = tokens.length - 1;
  while (hi > lo && isStrippable(tokens[hi])) hi -= 1;
  while (lo < hi && isStrippable(tokens[lo])) lo += 1;
  const kept = tokens.slice(lo, hi + 1);
  return kept.join(' ').trim() || name.trim();
}

// --- types --------------------------------------------------------------------
interface VariantRow {
  id: string;
  slug: string;
  name: string;
  yearFrom: number;
  yearTo: number;
}

interface ModelRow {
  id: string;
  name: string;
  slug: string;
  variants: VariantRow[];
  overlays: number;
}

/** Nullable spec scalars coalesced when two identical variants merge — the dropped
 * duplicate fills any field the survivor leaves null (QLD gvm/kerb ⊕ ROVER gcm). */
const SPEC_FIELDS = [
  'gvmKg',
  'gcmKg',
  'kerbWeightKg',
  'maxTowingCapacityKg',
  'frontAxleLimitKg',
  'rearAxleLimitKg',
  'wheelbaseMm',
  'frontOverhangMm',
  'rearOverhangMm',
  'totalLengthMm',
  'maxTowBallDownloadKg',
  'maxRoofLoadKg',
  'fuelTankCapacityL',
  'fuelType',
] as const;

interface Group {
  canonicalSlug: string;
  canonicalDisplay: string;
  members: ModelRow[];
}

// --- main ---------------------------------------------------------------------
async function main() {
  const makes = await prisma.vehicleMake.findMany({
    select: {
      id: true,
      name: true,
      models: {
        select: {
          id: true,
          name: true,
          slug: true,
          variants: {
            select: {
              id: true,
              slug: true,
              name: true,
              yearFrom: true,
              yearTo: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Overlay counts per model (GvmUpgrade → baseVariant → modelId).
  const overlayByModel = new Map<string, number>();
  for (const m of makes.flatMap((mk) => mk.models)) overlayByModel.set(m.id, 0);
  const overlays = await prisma.gvmUpgrade.findMany({
    select: { baseVariant: { select: { modelId: true } } },
  });
  for (const o of overlays) {
    const id = o.baseVariant.modelId;
    overlayByModel.set(id, (overlayByModel.get(id) ?? 0) + 1);
  }

  type Plan = {
    make: string;
    target: ModelRow;
    sources: ModelRow[];
    canonicalDisplay: string;
    moves: number;
    overlaysMoved: number;
    collisions: number;
  };
  const plans: Plan[] = [];
  const residue: { make: string; name: string; variants: number }[] = [];
  const loneRenames: { make: string; from: string; to: string }[] = [];

  for (const make of makes) {
    if (MAKE_FILTER && make.name.toLowerCase() !== MAKE_FILTER) continue;

    const rows: ModelRow[] = make.models.map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      variants: m.variants,
      overlays: overlayByModel.get(m.id) ?? 0,
    }));

    // Group by canonical slug.
    const groups = new Map<string, Group>();
    for (const r of rows) {
      const disp = canonicalName(r.name);
      const cslug = toSlug(disp);
      let g = groups.get(cslug);
      if (!g) {
        g = { canonicalSlug: cslug, canonicalDisplay: disp, members: [] };
        groups.set(cslug, g);
      }
      g.members.push(r);
    }

    for (const g of groups.values()) {
      // A clean-nameplate member = a model whose own slug already equals the
      // canonical slug (the QLD nameplate, e.g. "HiLux"). We ONLY fold fragments
      // onto such an anchor. Without one we never guess: the trailing token may be
      // a generation ("HiLux 8GEN") or a distinct sub-nameplate ("Polestar 2" vs
      // "3", "Tesla Model 3", "BMW 5 Series") — that's Tim's editorial call.
      const clean = g.members
        .filter((m) => m.slug === g.canonicalSlug)
        .sort((a, b) => b.variants.length - a.variants.length);

      if (clean.length === 0) {
        if (g.members.length < 2) {
          // Lone fragment whose name carries a strippable code, no anchor → report.
          const m = g.members[0];
          if (m.slug !== g.canonicalSlug) {
            loneRenames.push({
              make: make.name,
              from: m.name,
              to: g.canonicalDisplay,
            });
          }
        } else {
          // Multi-member group with no clean anchor → needs review, never auto-merged.
          for (const m of g.members) {
            residue.push({
              make: make.name,
              name: m.name,
              variants: m.variants.length,
            });
          }
        }
        continue;
      }

      const target = clean[0];
      const sources = g.members.filter((m) => m.id !== target.id);
      if (sources.length === 0) continue; // only the clean nameplate, nothing to fold
      const overlaysMoved = sources.reduce((n, s) => n + s.overlays, 0);
      const targetSlugs = new Set(target.variants.map((v) => v.slug));
      let moves = 0;
      let collisions = 0;
      for (const s of sources) {
        for (const v of s.variants) {
          moves += 1;
          if (targetSlugs.has(v.slug)) collisions += 1;
          else targetSlugs.add(v.slug);
        }
      }

      plans.push({
        make: make.name,
        target,
        sources,
        canonicalDisplay: g.canonicalDisplay,
        moves,
        overlaysMoved,
        collisions,
      });
    }
  }

  // --- report -----------------------------------------------------------------
  plans.sort((a, b) => b.moves - a.moves || a.make.localeCompare(b.make));
  console.log(`\n=== MERGE PLAN (${WRITE ? 'WRITE' : 'dry-run'}) ===`);
  console.log(
    `${plans.length} merge groups · ${plans.reduce((n, p) => n + p.sources.length, 0)} models folded ` +
      `· ${plans.reduce((n, p) => n + p.moves, 0)} variants moved ` +
      `· ${plans.reduce((n, p) => n + p.overlaysMoved, 0)} overlays carried ` +
      `· ${plans.reduce((n, p) => n + p.collisions, 0)} slug collisions re-slugged\n`,
  );
  for (const p of plans) {
    console.log(
      `  ${p.make}: "${p.target.name}" ⟵ ${p.sources
        .map(
          (s) =>
            `"${s.name}"(${s.variants.length}v${s.overlays ? `,${s.overlays}ovl` : ''})`,
        )
        .join(' + ')}` + (p.collisions ? `  [${p.collisions} re-slug]` : ''),
    );
  }

  if (loneRenames.length) {
    console.log(
      `\n--- lone-fragment rename candidates (${loneRenames.length}; REPORT-ONLY — review by Tim, not auto-applied) ---`,
    );
    console.log(
      '    (strip is mechanical and can be wrong — e.g. "Tesla Model 3"→"Model" — so these are never written)',
    );
    for (const r of loneRenames)
      console.log(`  ${r.make}: "${r.from}" → "${r.to}"`);
  }

  if (residue.length) {
    const byMake = new Map<string, number>();
    for (const r of residue) byMake.set(r.make, (byMake.get(r.make) ?? 0) + 1);
    console.log(
      `\n--- no-anchor fragment groups (NOT merged; ${residue.length} models across ${byMake.size} makes) ---`,
    );
    console.log(
      '    (multiple fragments share a stem but the catalogue holds no clean nameplate to fold onto —',
    );
    console.log(
      '     could be one model or several distinct ones (Polestar 2/3/4, BMW N Series): Tim decides)',
    );
    for (const [mk, n] of [...byMake.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${mk}: ${n}`);
    }
  }

  if (!WRITE) {
    console.log('\n(dry-run — pass --write to apply)');
    await prisma.$disconnect();
    return;
  }

  // --- apply ------------------------------------------------------------------
  let foldedModels = 0;
  let movedVariants = 0;
  let mergedDuplicates = 0;
  for (const p of plans) {
    await prisma.$transaction(async (tx) => {
      const targetSlugs = new Set(p.target.variants.map((v) => v.slug));
      for (const s of p.sources) {
        for (const v of s.variants) {
          // A target variant with the same name + overlapping year range is the
          // SAME vehicle from two ROVER sub-models (Daily NB1/NB2 "70C C/CAB 4750")
          // — the (modelId,name,year-range) exclusion constraint forbids both. Fold
          // the duplicate INTO the survivor: coalesce its specs, carry its overlays,
          // then delete it. (Survivor may itself be a just-moved earlier source, so
          // query live within the tx.)
          const conflict = await tx.vehicleVariant.findFirst({
            where: {
              modelId: p.target.id,
              name: v.name,
              yearFrom: { lte: v.yearTo },
              yearTo: { gte: v.yearFrom },
            },
            select: { id: true },
          });

          if (conflict) {
            const [dup, keep] = await Promise.all([
              tx.vehicleVariant.findUniqueOrThrow({ where: { id: v.id } }),
              tx.vehicleVariant.findUniqueOrThrow({
                where: { id: conflict.id },
              }),
            ]);
            const fill: Record<string, unknown> = {};
            for (const f of SPEC_FIELDS) {
              if (keep[f] == null && dup[f] != null) fill[f] = dup[f];
            }
            if (dup.isCurrentProduction && !keep.isCurrentProduction)
              fill.isCurrentProduction = true;
            if (Object.keys(fill).length > 0) {
              await tx.vehicleVariant.update({
                where: { id: keep.id },
                data: fill,
              });
            }
            // Carry the duplicate's GVM-upgrade overlays onto the survivor.
            await tx.gvmUpgrade.updateMany({
              where: { baseVariantId: dup.id },
              data: { baseVariantId: keep.id },
            });
            await tx.vehicleVariant.delete({ where: { id: dup.id } });
            mergedDuplicates += 1;
            continue;
          }

          let slug = v.slug;
          if (targetSlugs.has(slug)) {
            // (modelId, slug) collision — keep both, suffix the incoming one.
            let i = 2;
            while (targetSlugs.has(`${v.slug}-m${i}`)) i += 1;
            slug = `${v.slug}-m${i}`;
          }
          targetSlugs.add(slug);
          await tx.vehicleVariant.update({
            where: { id: v.id },
            data: { modelId: p.target.id, slug },
          });
          movedVariants += 1;
        }
        await tx.vehicleModel.delete({ where: { id: s.id } });
        foldedModels += 1;
      }
    });
  }

  console.log(
    `\n✓ applied: ${foldedModels} models folded, ${movedVariants} variants moved, ` +
      `${mergedDuplicates} duplicate variants merged`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
