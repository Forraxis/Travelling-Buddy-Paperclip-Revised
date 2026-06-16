import type { PhysicsResult, OverallStatus } from '@/lib/physics/types';
import type { CalculatorState } from './types';

/**
 * Compact, denormalised metrics stored alongside a {@link SetupVersionDTO} so the
 * list + compare views render without recomputing the engine. The full state is
 * always in `stateSnapshot` for an exact recompute when needed.
 */
export interface VersionResultSummary {
  overallStatus: OverallStatus;
  gvmKg: number;
  gvmLimitKg: number;
  frontAxleKg: number;
  frontAxleLimitKg: number;
  rearAxleKg: number;
  rearAxleLimitKg: number;
  towBallKg?: number;
  gcmKg?: number;
  gcmLimitKg?: number;
  caravanAtmKg?: number;
  caravanGtmKg?: number;
  calibrated: boolean;
}

export interface SetupVersionDTO {
  id: string;
  label: string;
  note: string | null;
  stateSnapshot: CalculatorState;
  resultSummary: VersionResultSummary | null;
  isWeighedBaseline: boolean;
  createdAt: string;
}

export function buildResultSummary(
  result: PhysicsResult,
  calibrated: boolean,
): VersionResultSummary {
  const v = result.vehicle;
  return {
    overallStatus: result.overallStatus,
    gvmKg: Math.round(v.totalWeightKg),
    gvmLimitKg: v.gvmLimitKg,
    frontAxleKg: Math.round(v.frontAxleKg),
    frontAxleLimitKg: v.frontAxleLimitKg,
    rearAxleKg: Math.round(v.rearAxleKg),
    rearAxleLimitKg: v.rearAxleLimitKg,
    towBallKg:
      v.towBallDownloadKg != null ? Math.round(v.towBallDownloadKg) : undefined,
    gcmKg: v.gcmKg != null ? Math.round(v.gcmKg) : undefined,
    gcmLimitKg: v.gcmLimitKg,
    caravanAtmKg: result.caravan
      ? Math.round(result.caravan.totalWeightKg)
      : undefined,
    caravanGtmKg: result.caravan ? Math.round(result.caravan.gtmKg) : undefined,
    calibrated,
  };
}

// ── Client API wrappers ────────────────────────────────────────────────────

export async function listVersions(
  setupId: string,
): Promise<SetupVersionDTO[]> {
  const r = await fetch(`/api/setups/${setupId}/versions`);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.items ?? []) as SetupVersionDTO[];
}

export async function createVersion(
  setupId: string,
  body: {
    label: string;
    note?: string;
    stateSnapshot: CalculatorState;
    resultSummary: VersionResultSummary;
    isWeighedBaseline: boolean;
  },
): Promise<SetupVersionDTO | null> {
  const r = await fetch(`/api/setups/${setupId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.ok ? ((await r.json()) as SetupVersionDTO) : null;
}

export async function getVersion(
  setupId: string,
  versionId: string,
): Promise<SetupVersionDTO | null> {
  const r = await fetch(`/api/setups/${setupId}/versions/${versionId}`);
  return r.ok ? ((await r.json()) as SetupVersionDTO) : null;
}

export async function deleteVersion(
  setupId: string,
  versionId: string,
): Promise<boolean> {
  const r = await fetch(`/api/setups/${setupId}/versions/${versionId}`, {
    method: 'DELETE',
  });
  return r.ok;
}
