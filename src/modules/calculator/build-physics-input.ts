import type {
  PhysicsInput,
  MountingLocation,
  CalibrationOverrides,
  ComplianceLimitKey,
  LimitProvenance,
} from '@/lib/physics/types';
import {
  mergeModelCorrection,
  type ModelCorrection,
} from '@/lib/physics/calibration-contribution';
import {
  vehicleProfile,
  vehicleBodyKindFromType,
  caravanProfile,
  caravanBodyKindFromType,
} from '@/components/schematic/vehicle-profiles';
import type { CalculatorState } from './types';

type AnyVariant = Record<string, unknown>;

const ALL_COMPLIANCE_LIMITS: ComplianceLimitKey[] = [
  'gvm',
  'gcm',
  'frontAxle',
  'rearAxle',
  'towBall',
  'towing',
];

/**
 * Maps a `VariantSpecProvenance.field` key (the canonical variant column name)
 * to the {@link ComplianceLimitKey} the verdict-honesty layer flags. Only the
 * six compliance-critical figures appear; any other provenance field (kerb,
 * wheelbase, Tier-B…) is irrelevant to the limit badge and is ignored here.
 */
const PROVENANCE_FIELD_TO_LIMIT: Record<string, ComplianceLimitKey> = {
  gvmKg: 'gvm',
  gcmKg: 'gcm',
  frontAxleLimitKg: 'frontAxle',
  rearAxleLimitKg: 'rearAxle',
  maxTowBallDownloadKg: 'towBall',
  maxTowingCapacityKg: 'towing',
};

/**
 * One row of {@link VariantSpecProvenance} as the builder consumes it. A loaded
 * variant may carry these (relation `specProvenance`). `field` + `status` drive
 * the "Est." flag ({@link deriveEstimatedLimits}); `confidence` / `sourceUrl` /
 * `asOf` ride along into the per-limit provenance map ({@link deriveLimitProvenance})
 * so a later UI PR can render a confidence badge + "help us verify" CTA. All but
 * `field`/`status` are optional — older callers that select only those two still
 * type-check.
 */
export interface VariantProvenanceField {
  field: string;
  status: 'CONFIRMED' | 'ESTIMATE' | 'DISPUTED';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  sourceUrl?: string | null;
  /** `Date` from Prisma, or an ISO string from a plain-object caller. */
  asOf?: Date | string | null;
}

/**
 * Verdict honesty: decide which compliance limits to flag as estimated.
 *
 * When the variant carries per-field provenance (`specProvenance` —
 * {@link VariantSpecProvenance}), narrow the flag to exactly the
 * compliance-critical fields whose accepted value is an ESTIMATE or DISPUTED;
 * a CONFIRMED (ROVER / plate / cross-source-agreed) field is NOT flagged. This
 * is the open TODO from the spec-fetch pipeline — replacing the all-or-nothing
 * variant-level signal with the precise set.
 *
 * Without provenance we fall back to the legacy variant-level signal: a
 * COMMUNITY (or AI-estimated badge) variant has not been verified against a
 * compliance plate, so ALL its nameplate limits are estimated. A verified
 * CATALOGUE variant with no provenance and no estimate badge returns undefined.
 */
function deriveEstimatedLimits(
  vehicle: AnyVariant,
): ComplianceLimitKey[] | undefined {
  const provenance = vehicle.specProvenance;
  if (Array.isArray(provenance) && provenance.length > 0) {
    const flagged = new Set<ComplianceLimitKey>();
    for (const row of provenance as VariantProvenanceField[]) {
      const limit = PROVENANCE_FIELD_TO_LIMIT[row.field];
      if (limit && (row.status === 'ESTIMATE' || row.status === 'DISPUTED')) {
        flagged.add(limit);
      }
    }
    // Preserve a stable, canonical ordering for deterministic output.
    const ordered = ALL_COMPLIANCE_LIMITS.filter((k) => flagged.has(k));
    return ordered.length > 0 ? ordered : undefined;
  }

  const status = vehicle.status;
  const badge = vehicle.confidenceBadge;
  const isEstimated =
    status === 'COMMUNITY' || badge === 'community' || badge === 'estimated';
  return isEstimated ? [...ALL_COMPLIANCE_LIMITS] : undefined;
}

/**
 * Build the per-compliance-limit provenance map (status + confidence + citation
 * + as-of), keyed by {@link ComplianceLimitKey}. Purely additive metadata for a
 * UI confidence badge + "help us verify" CTA — never read by the verdict math
 * and entirely independent of {@link deriveEstimatedLimits} (which still owns the
 * "Est." flag). Returns undefined when the variant carries no provenance, so the
 * no-provenance path stays byte-identical (the field is simply absent).
 *
 * Only the six compliance-critical fields map to a limit; any other provenance
 * row (kerb, wheelbase, Tier-B…) is ignored. The DISPUTED/ESTIMATE/CONFIRMED
 * status is surfaced verbatim so the badge can distinguish a confirmed limit
 * from an estimated or disputed one.
 */
function deriveLimitProvenance(
  vehicle: AnyVariant,
): Partial<Record<ComplianceLimitKey, LimitProvenance>> | undefined {
  const provenance = vehicle.specProvenance;
  if (!Array.isArray(provenance) || provenance.length === 0) return undefined;

  const map: Partial<Record<ComplianceLimitKey, LimitProvenance>> = {};
  for (const row of provenance as VariantProvenanceField[]) {
    const limit = PROVENANCE_FIELD_TO_LIMIT[row.field];
    if (!limit) continue;
    const asOf =
      row.asOf instanceof Date
        ? row.asOf.toISOString()
        : (row.asOf ?? undefined);
    map[limit] = {
      status: row.status,
      ...(row.confidence ? { confidence: row.confidence } : {}),
      ...(row.sourceUrl !== undefined ? { sourceUrl: row.sourceUrl } : {}),
      ...(asOf ? { asOf } : {}),
    };
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

/**
 * The subset of a {@link GvmUpgrade} the physics overlay applies. A loaded
 * variant may carry the user's selected kit as `appliedGvmUpgrade` (resolved
 * from `setup.appliedGvmUpgradeId`) or a free-form `customGvmUpgrade` (the
 * engineer-cert / plate path). Every limit is optional: a `null`/absent field
 * means "the upgrade does not move this limit" → keep the factory value (the
 * GCM-doesn't-move headroom trap the GCM enforcement is built to catch).
 */
export interface AppliedGvmUpgrade {
  gvmKg?: number | null;
  gcmKg?: number | null;
  frontAxleLimitKg?: number | null;
  rearAxleLimitKg?: number | null;
  maxTowingKg?: number | null;
  /** Mass the kit itself adds (heavier springs etc.) — a placed vehicle load. */
  addedMassKg?: number | null;
}

/**
 * Rule 11 / advisory gate. The GVM-upgrade overlay changes a compliance VERDICT
 * (it raises the limits the pass/fail math tests against), so it stays OFF until
 * Tim signs it off — controlled by `GVM_UPGRADE_ENABLED` (env, `=== 'true'`).
 * When the flag is unset the overlay is ignored and behaviour is unchanged.
 */
function gvmUpgradeEnabled(): boolean {
  return process.env.GVM_UPGRADE_ENABLED === 'true';
}

/** Reads the applied overlay off the loaded variant, if the caller attached one. */
function resolveGvmUpgrade(vehicle: AnyVariant): AppliedGvmUpgrade | null {
  const upgrade = vehicle.appliedGvmUpgrade ?? vehicle.customGvmUpgrade;
  if (upgrade && typeof upgrade === 'object') {
    return upgrade as AppliedGvmUpgrade;
  }
  return null;
}

/**
 * How calibration folds into the built input:
 * - `live` — the config the user sees: includes the positioned "unaccounted"
 *   load (it's a real placed load) and the solved `vehicleStaticOffsets`.
 * - `baseline` — the clean anchor C₀: EXCLUDES the unaccounted load and applies
 *   NO offsets. This is what we re-solve a weighbridge ticket against, so P₀
 *   never double-counts a previous calibration. See CALIBRATION_SIGNOFF.md.
 */
export type PhysicsInputMode = 'live' | 'baseline';

/**
 * Pure builder for the physics engine input from calculator state + the loaded
 * variant specs. Shared by {@link usePhysicsView} (live) and the weighbridge
 * calibration panel (baseline). No React / I/O.
 */
export function buildPhysicsInput(
  state: CalculatorState,
  vehicle: AnyVariant,
  caravan: AnyVariant | null,
  mode: PhysicsInputMode = 'live',
): PhysicsInput {
  const freshWaterCapL = Number(caravan?.freshWaterCapacityL ?? 0);
  const greyWaterCapL = Number(caravan?.greyWaterCapacityL ?? 0);
  const freshWaterPercent =
    freshWaterCapL > 0
      ? Math.min(
          100,
          (state.caravanAssumptions.freshWaterL / freshWaterCapL) * 100,
        )
      : 0;
  const greyWaterPercent =
    greyWaterCapL > 0
      ? Math.min(
          100,
          (state.caravanAssumptions.greyWaterL / greyWaterCapL) * 100,
        )
      : 0;

  // In baseline mode, drop the positioned unaccounted load so P₀ is the clean
  // pre-calibration prediction.
  const customLoads =
    mode === 'baseline'
      ? state.customLoads.filter((l) => !l.isUnaccounted)
      : state.customLoads;

  // P3 per-model correction (kerb-mass / kerb-CoG). Applied ONLY in live mode,
  // and ONLY when the user hasn't anchored to their own weighbridge ticket —
  // their measured reality always beats the crowd estimate. NEVER in baseline,
  // so a contribution's P₀ is computed against the raw model and corrections
  // can't feed back on their own predictions. See CALIBRATION_SIGNOFF.md §9.
  const baseOverrides: CalibrationOverrides = {
    caravanTareKg: state.caravanAssumptions.gearKg,
    vehicleStaticOffsets:
      mode === 'live'
        ? (state.calibration?.vehicleStaticOffsets ?? undefined)
        : undefined,
  };
  const modelCorrection: ModelCorrection | null =
    mode === 'live' && !state.calibration
      ? ((vehicle.calibrationCorrection as
          | ModelCorrection
          | null
          | undefined) ?? null)
      : null;
  const calibrationOverrides =
    mergeModelCorrection(baseOverrides, modelCorrection) ?? baseOverrides;

  // GVM-upgrade overlay (Rule 11 — GATED + advisory). A certified upgrade lifts
  // the variant LIMITS (not the load): GVM almost always rises; GCM / axle / tow
  // move ONLY when the upgrade states them, otherwise stay at the factory value.
  // The kit's own spring mass enters via the existing accessory-mass path below.
  // Behind GVM_UPGRADE_ENABLED so it can't silently flip a verdict until signed off.
  const upgrade = gvmUpgradeEnabled() ? resolveGvmUpgrade(vehicle) : null;
  const overlay = (
    factory: number,
    upgraded: number | null | undefined,
  ): number => (upgraded != null ? upgraded : factory);

  return {
    vehicle: {
      gvmKg: overlay(Number(vehicle.gvmKg), upgrade?.gvmKg),
      gcmKg: overlay(Number(vehicle.gcmKg), upgrade?.gcmKg),
      kerbWeightKg: Number(vehicle.kerbWeightKg),
      maxTowingCapacityKg: overlay(
        Number(vehicle.maxTowingCapacityKg),
        upgrade?.maxTowingKg,
      ),
      frontAxleLimitKg: overlay(
        Number(vehicle.frontAxleLimitKg),
        upgrade?.frontAxleLimitKg,
      ),
      rearAxleLimitKg: overlay(
        Number(vehicle.rearAxleLimitKg),
        upgrade?.rearAxleLimitKg,
      ),
      maxTowBallDownloadKg: Number(vehicle.maxTowBallDownloadKg),
      wheelbaseMm: Number(vehicle.wheelbaseMm),
      frontOverhangMm:
        vehicle.frontOverhangMm != null
          ? Number(vehicle.frontOverhangMm)
          : null,
      rearOverhangMm:
        vehicle.rearOverhangMm != null ? Number(vehicle.rearOverhangMm) : null,
      trackWidthMm: vehicleProfile(
        vehicleBodyKindFromType(
          ((vehicle.model ?? {}) as AnyVariant).bodyType as string | undefined,
        ),
      ).trackWidthMm,
      fuelTankCapacityL: Number(vehicle.fuelTankCapacityL),
      fuelType: vehicle.fuelType as 'DIESEL' | 'PETROL' | 'HYBRID' | 'ELECTRIC',
      estimatedLimits: deriveEstimatedLimits(vehicle),
      limitProvenance: deriveLimitProvenance(vehicle),
    },
    caravan: caravan
      ? {
          atmKg: Number(caravan.atmKg),
          gtmKg: Number(caravan.gtmKg),
          tareKg: Number(caravan.tareKg),
          tbmKg: Number(caravan.tbmKg),
          axleConfiguration: caravan.axleConfiguration as
            | 'SINGLE_AXLE'
            | 'DUAL_AXLE_CLOSE_COUPLED'
            | 'DUAL_AXLE_SPREAD'
            | 'TRIPLE_AXLE',
          couplingToAxleMm: Number(caravan.couplingToAxleMm),
          axleSpacingMm:
            caravan.axleSpacingMm != null
              ? Number(caravan.axleSpacingMm)
              : null,
          freshWaterCapacityL: freshWaterCapL,
          greyWaterCapacityL: greyWaterCapL,
          trackWidthMm: caravanProfile(
            caravanBodyKindFromType(
              ((caravan.model ?? {}) as AnyVariant).bodyType as
                | string
                | undefined,
            ),
          ).trackWidthMm,
        }
      : undefined,
    vehicleAccessories: [
      // GATED overlay mass: the upgrade kit's own added mass (springs etc.) is a
      // real placed load on the vehicle, distinct from the lifted LIMITS above.
      // Mid-chassis is the neutral placement until a kit carries a real CoG.
      ...(upgrade?.addedMassKg
        ? [
            {
              installedWeightKg: upgrade.addedMassKg,
              mountingLocation: 'CHASSIS_MID' as MountingLocation,
              cogXMm: null,
              cogYMm: null,
              cogZMm: null,
              fillPercent: 100,
              quantity: 1,
            },
          ]
        : []),
      ...state.accessories.map((a) => ({
        installedWeightKg: a.massKg,
        mountingLocation: a.mountingLocation as MountingLocation,
        cogXMm: a.cogXMm,
        cogYMm: a.cogYMm,
        cogZMm: a.cogZMm,
        fillPercent: 100,
        quantity: 1,
      })),
      ...customLoads
        .filter((l) => l.side === 'vehicle')
        .map((l) => ({
          installedWeightKg: l.massKg,
          mountingLocation: 'CHASSIS_MID' as MountingLocation,
          cogXMm: l.cogXMm,
          cogYMm: l.cogYMm,
          cogZMm: l.cogZMm,
          fillPercent: 100,
          quantity: 1,
        })),
    ],
    caravanAccessories: [
      ...state.caravanAccessories.map((a) => ({
        installedWeightKg: a.massKg,
        mountingLocation: a.mountingLocation as MountingLocation,
        cogXMm: a.cogXMm,
        cogYMm: a.cogYMm,
        fillPercent: 100,
        quantity: 1,
      })),
      ...customLoads
        .filter((l) => l.side === 'caravan')
        .map((l) => ({
          installedWeightKg: l.massKg,
          mountingLocation: 'CARAVAN_CHASSIS_MID' as MountingLocation,
          cogXMm: l.cogXMm,
          cogYMm: l.cogYMm,
          fillPercent: 100,
          quantity: 1,
        })),
    ],
    passengers: state.journey.passengers,
    passengerAvgWeightKg: state.journey.passengerWeightKg,
    cargoKg: state.journey.cargoKg,
    fuelPercent: state.journey.fuelPercent,
    freshWaterPercent,
    greyWaterPercent,
    calibrationOverrides,
    regulationSetCode: 'AU_ADR',
  };
}
