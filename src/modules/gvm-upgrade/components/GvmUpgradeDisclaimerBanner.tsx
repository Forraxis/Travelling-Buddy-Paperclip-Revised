import {
  GVM_UPGRADE_DISCLAIMER,
  gvmUpgradeDisclaimerAsOf,
} from '../disclaimer';

/**
 * The §6 advisory disclaimer, rendered near any surface that shows or sets
 * upgraded limits (admin manager + calculator picker). The "current as of"
 * stamp is computed server-side and deterministic.
 */
export function GvmUpgradeDisclaimerBanner({
  asOf = gvmUpgradeDisclaimerAsOf(),
}: {
  /** Override the date stamp (e.g. for a deterministic snapshot). */
  asOf?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
      <span className="font-semibold">Advisory.</span> {GVM_UPGRADE_DISCLAIMER}{' '}
      <span className="text-amber-700">{asOf}</span>
    </div>
  );
}
