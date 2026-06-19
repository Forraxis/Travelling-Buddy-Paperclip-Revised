/**
 * GVM-upgrade promotion routing (OVERNIGHT_BUILD_FULL.md Phase P4).
 *
 * When a ROVER second-stage candidate is classified `GVM_UPGRADE`
 * (RoverApprovalIndex.secondStageType), it must NOT mint a standalone
 * VehicleVariant — a GVM kit (Ironman, Lovells, Premcar, …) is an OVERLAY on the
 * factory base, not a new car. So instead we resolve the base variant and attach a
 * `GvmUpgrade` carrying the kit's uprated figures. The calculator keeps the base
 * figures and applies this delta when the user picks their kit (Setup, P5 — gated).
 *
 * This module holds:
 *  - the PURE mapping from a promotion patch + index identity → GvmUpgrade create
 *    data (`buildGvmUpgradeData`, unit-tested, no DB / no clock), and
 *  - the small DB routing helpers `resolveBaseVariant` + `routeGvmUpgrade` that the
 *    shared `promoteSpecCandidate` core calls inside its transaction.
 *
 * If the base variant isn't in the catalogue yet, the upgrade is NOT fabricated —
 * the candidate is left PENDING and unattached with a clear note (the base must be
 * promoted first; we never invent an OEM base from a modifier's figures). Rule 11:
 * the physics that consumes these limits stays gated/advisory (P5).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type { VariantSpecPatch } from '../promotion';

/** Slug rule shared with promoteSpecCandidate so base lookups match minted slugs. */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Minimal index identity needed to route a GVM-upgrade promotion. */
export interface GvmUpgradeIndexInfo {
  /** Resolved OEM make the upgrade attaches to ("Toyota"). */
  baseMake: string | null;
  /** Resolved OEM model the upgrade attaches to ("Hilux"). */
  baseModel: string | null;
  /** Captured second-stage modifier ("ironman tmca") — the kit/modifier name. */
  modifier: string | null;
  /** Source VTA approval number, if known. */
  vtaNumber: string | null;
  /** ADR category of THIS approval ("NB1") — a category bump implies pre-rego SSM. */
  category: string | null;
  /** Factory category of the base ("NA") — for the pre-rego (bumped) heuristic. */
  baseCategory: string | null;
}

/**
 * The GvmUpgrade scalar data derived from a candidate, ready to create/update. Pure
 * — `baseVariantId` is supplied by the caller once the base is resolved.
 */
export interface GvmUpgradeData {
  modifierName: string;
  pathway: Prisma.GvmUpgradeCreateInput['pathway'];
  vtaNumber: string | null;
  gvmKg: number | null;
  gcmKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  maxTowingKg: number | null;
  /** Spring/kit mass — left null here (RVD doesn't state it; P5 estimates it). */
  addedMassKg: number | null;
  isPreRego: boolean;
  sourceVtaNumber: string | null;
}

/**
 * Infer the regulatory pathway from the approval shape. A GVM uprate that bumps the
 * goods category (NA → NB1) is a pre-rego Second-Stage Manufacture (recognised
 * nationally); without a bump we record the conservative POST_REGO_SSM default
 * (state-recognised) until a cert says otherwise. STATE_ENGINEER is the manual /
 * admin path, not inferable from a ROVER approval here.
 */
function inferPathway(isPreRego: boolean): GvmUpgradeData['pathway'] {
  return isPreRego ? 'PRE_REGO_SECOND_STAGE' : 'POST_REGO_SSM';
}

/**
 * True when THIS approval's goods category sits strictly above the base's on the
 * N-series ladder (NA < NB1 < NB2 < NC) — the strongest pre-rego SSM signal.
 */
const GOODS_RANK: Record<string, number> = { NA: 1, NB1: 2, NB2: 3, NC: 4 };
function isCategoryBumped(
  category: string | null,
  baseCategory: string | null,
): boolean {
  if (!category || !baseCategory) return false;
  const r = GOODS_RANK[category.trim().toUpperCase()];
  const b = GOODS_RANK[baseCategory.trim().toUpperCase()];
  if (r === undefined || b === undefined) return false;
  return r > b;
}

/**
 * Build the GvmUpgrade data from the promotion patch + index identity. Pure: the
 * patch already carries parsed/typed figures (the same mapper a variant promotion
 * uses), so we lift only the upgrade-relevant ones. A null figure means "the kit
 * doesn't move this limit" → the overlay keeps the factory value (P5).
 */
export function buildGvmUpgradeData(
  patch: VariantSpecPatch,
  index: GvmUpgradeIndexInfo,
): GvmUpgradeData {
  const isPreRego = isCategoryBumped(index.category, index.baseCategory);
  const modifierName =
    (index.modifier && index.modifier.trim()) ||
    (index.baseMake && index.baseMake.trim()) ||
    'Unknown modifier';
  return {
    modifierName,
    pathway: inferPathway(isPreRego),
    vtaNumber: index.vtaNumber,
    gvmKg: patch.gvmKg ?? null,
    gcmKg: patch.gcmKg ?? null,
    frontAxleLimitKg: patch.frontAxleLimitKg ?? null,
    rearAxleLimitKg: patch.rearAxleLimitKg ?? null,
    maxTowingKg: patch.maxTowingCapacityKg ?? null,
    addedMassKg: null,
    isPreRego,
    sourceVtaNumber: index.vtaNumber,
  };
}

/** Transaction client (or the base client) — the routing helpers accept either. */
type Db = Prisma.TransactionClient | PrismaClient;

/**
 * Resolve the base CATALOGUE VehicleVariant a GVM upgrade attaches to, from the
 * normalized base make/model. Matches a base variant by make-slug → model-slug,
 * preferring a CATALOGUE entry and the most recent year. Returns null when the base
 * isn't in the catalogue yet (caller leaves the candidate unattached).
 */
export async function resolveBaseVariant(
  db: Db,
  baseMake: string | null,
  baseModel: string | null,
): Promise<{ id: string } | null> {
  if (!baseMake || !baseModel) return null;
  const make = await db.vehicleMake.findUnique({
    where: { slug: toSlug(baseMake) },
    select: { id: true },
  });
  if (!make) return null;
  const model = await db.vehicleModel.findUnique({
    where: { makeId_slug: { makeId: make.id, slug: toSlug(baseModel) } },
    select: { id: true },
  });
  if (!model) return null;
  const variant = await db.vehicleVariant.findFirst({
    where: { modelId: model.id, status: 'CATALOGUE' },
    orderBy: [{ yearTo: 'desc' }, { yearFrom: 'desc' }],
    select: { id: true },
  });
  return variant;
}

export interface RouteGvmUpgradeResult {
  /** The created/updated GvmUpgrade, when a base was resolved; else null. */
  gvmUpgradeId: string | null;
  /** The base variant the upgrade attached to, when resolved; else null. */
  baseVariantId: string | null;
  /** True when the base wasn't in the catalogue → candidate left unattached. */
  unattached: boolean;
  /** Human note for the audit/moderation trail. */
  note: string;
}

/**
 * Create (or idempotently refresh) the GvmUpgrade on the resolved base variant. When
 * the base can't be resolved, returns `unattached` so the caller leaves the candidate
 * PENDING with a note rather than fabricating a base.
 *
 * Idempotent on (baseVariantId, vtaNumber): a re-promote of the same VTA refreshes
 * the existing upgrade in place rather than duplicating it.
 */
export async function routeGvmUpgrade(
  db: Db,
  patch: VariantSpecPatch,
  index: GvmUpgradeIndexInfo,
): Promise<RouteGvmUpgradeResult> {
  const base = await resolveBaseVariant(db, index.baseMake, index.baseModel);
  const data = buildGvmUpgradeData(patch, index);

  if (!base) {
    const label = `${index.baseMake ?? '—'} ${index.baseModel ?? '—'}`.trim();
    return {
      gvmUpgradeId: null,
      baseVariantId: null,
      unattached: true,
      note: `GVM upgrade left unattached: base vehicle "${label}" not in catalogue (promote the base variant first).`,
    };
  }

  const existing = data.vtaNumber
    ? await db.gvmUpgrade.findFirst({
        where: { baseVariantId: base.id, vtaNumber: data.vtaNumber },
        select: { id: true },
      })
    : null;

  const upgrade = existing
    ? await db.gvmUpgrade.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      })
    : await db.gvmUpgrade.create({
        data: { ...data, baseVariant: { connect: { id: base.id } } },
        select: { id: true },
      });

  return {
    gvmUpgradeId: upgrade.id,
    baseVariantId: base.id,
    unattached: false,
    note: existing
      ? `Refreshed GVM upgrade "${data.modifierName}" on base variant ${base.id}.`
      : `Created GVM upgrade "${data.modifierName}" on base variant ${base.id}.`,
  };
}
