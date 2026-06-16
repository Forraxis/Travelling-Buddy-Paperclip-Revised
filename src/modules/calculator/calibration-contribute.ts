import type { PhysicsInput } from '@/lib/physics/types';
import type { WeighbridgeMeasurement } from '@/lib/physics/calibration';

export interface ContributeArgs {
  vehicleVariantId: string;
  measurement: WeighbridgeMeasurement;
  /** The weighed config C₀ — the pre-calibration baseline PhysicsInput. */
  weighedSnapshot: PhysicsInput;
  source?: string;
}

/**
 * Share one weighbridge calibration with the community pool (P3). Fire-and-check:
 * returns true on a 201. Anonymous is fine — the API accepts a null submitter.
 */
export async function contributeCalibration(
  args: ContributeArgs,
): Promise<boolean> {
  try {
    const res = await fetch('/api/calibrations/contribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return res.ok;
  } catch {
    return false;
  }
}
