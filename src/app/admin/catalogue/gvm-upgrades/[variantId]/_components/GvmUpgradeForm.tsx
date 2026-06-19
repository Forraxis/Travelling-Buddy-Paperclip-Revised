'use client';

import { useState } from 'react';
import { useToast } from '@/modules/admin/components/Toast';
import {
  FormField,
  inputClassName,
  selectClassName,
} from '@/modules/admin/components/FormField';
import {
  createGvmUpgradeAction,
  updateGvmUpgradeAction,
} from '@/modules/gvm-upgrade/actions/gvm-upgrade-admin.actions';
import {
  GVM_UPGRADE_PATHWAY_LABELS,
  type GvmUpgradeAdminInput,
  type GvmUpgradeKitDto,
} from '@/modules/gvm-upgrade/types';
import type { AustralianState, GvmUpgradePathway } from '@prisma/client';

const STATES: AustralianState[] = [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'TAS',
  'NT',
  'ACT',
];

interface FactoryLimits {
  gvmKg: number | null;
  gcmKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  maxTowingKg: number | null;
}

function numStr(v: number | null): string {
  return v != null ? String(v) : '';
}

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Create / edit a catalogue GVM-upgrade kit on a base variant. A blank limit
 * field means "the kit doesn't move this limit → keep the factory value"
 * (the GCM-doesn't-move trap) — the factory figure is shown as the placeholder.
 */
export function GvmUpgradeForm({
  variantId,
  factory,
  upgrade,
  onDone,
  onCancel,
}: {
  variantId: string;
  factory: FactoryLimits;
  upgrade?: GvmUpgradeKitDto;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!upgrade;

  const [modifierName, setModifierName] = useState(upgrade?.modifierName ?? '');
  const [pathway, setPathway] = useState<GvmUpgradePathway>(
    upgrade?.pathway ?? 'PRE_REGO_SECOND_STAGE',
  );
  const [vtaNumber, setVtaNumber] = useState(upgrade?.vtaNumber ?? '');
  const [engineerRef, setEngineerRef] = useState(upgrade?.engineerRef ?? '');
  const [gvmKg, setGvmKg] = useState(numStr(upgrade?.gvmKg ?? null));
  const [gcmKg, setGcmKg] = useState(numStr(upgrade?.gcmKg ?? null));
  const [frontAxleLimitKg, setFrontAxleLimitKg] = useState(
    numStr(upgrade?.frontAxleLimitKg ?? null),
  );
  const [rearAxleLimitKg, setRearAxleLimitKg] = useState(
    numStr(upgrade?.rearAxleLimitKg ?? null),
  );
  const [maxTowingKg, setMaxTowingKg] = useState(
    numStr(upgrade?.maxTowingKg ?? null),
  );
  const [addedMassKg, setAddedMassKg] = useState(
    numStr(upgrade?.addedMassKg ?? null),
  );
  const [isPreRego, setIsPreRego] = useState(upgrade?.isPreRego ?? false);
  const [certifiedState, setCertifiedState] = useState<AustralianState | ''>(
    upgrade?.certifiedState ?? '',
  );
  const [sourceUrl, setSourceUrl] = useState(upgrade?.sourceUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!modifierName.trim()) {
      setError('Kit / modifier name is required');
      return;
    }
    setSubmitting(true);

    const input: GvmUpgradeAdminInput = {
      modifierName: modifierName.trim(),
      pathway,
      vtaNumber: vtaNumber.trim() || undefined,
      engineerRef: engineerRef.trim() || undefined,
      gvmKg: toIntOrNull(gvmKg),
      gcmKg: toIntOrNull(gcmKg),
      frontAxleLimitKg: toIntOrNull(frontAxleLimitKg),
      rearAxleLimitKg: toIntOrNull(rearAxleLimitKg),
      maxTowingKg: toIntOrNull(maxTowingKg),
      addedMassKg: toIntOrNull(addedMassKg),
      isPreRego,
      certifiedState: certifiedState || null,
      sourceUrl: sourceUrl.trim() || undefined,
    };

    const result = isEdit
      ? await updateGvmUpgradeAction(upgrade!.id, input)
      : await createGvmUpgradeAction(variantId, input);

    setSubmitting(false);
    if (result.success) {
      toast(isEdit ? 'Upgrade updated' : 'Upgrade created');
      onDone();
    } else {
      setError(result.error);
      toast(result.error, 'error');
    }
  }

  function limitPlaceholder(factoryValue: number | null): string {
    return factoryValue != null
      ? `factory ${factoryValue} (leave blank to keep)`
      : 'leave blank to keep factory';
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-tb-neutral-200 space-y-6 rounded-lg border bg-white p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Kit / modifier name" name="modifierName">
          <input
            id="modifierName"
            type="text"
            value={modifierName}
            onChange={(e) => setModifierName(e.target.value)}
            placeholder="e.g. Lovells GVM Upgrade"
            className={inputClassName}
            autoFocus
          />
        </FormField>
        <FormField label="Pathway" name="pathway">
          <select
            id="pathway"
            value={pathway}
            onChange={(e) => setPathway(e.target.value as GvmUpgradePathway)}
            className={selectClassName}
          >
            {(
              Object.keys(GVM_UPGRADE_PATHWAY_LABELS) as GvmUpgradePathway[]
            ).map((p) => (
              <option key={p} value={p}>
                {GVM_UPGRADE_PATHWAY_LABELS[p]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="VTA number" name="vtaNumber">
          <input
            id="vtaNumber"
            type="text"
            value={vtaNumber}
            onChange={(e) => setVtaNumber(e.target.value)}
            placeholder="e.g. VTA-066264"
            className={inputClassName}
          />
        </FormField>
        <FormField label="Engineer reference" name="engineerRef">
          <input
            id="engineerRef"
            type="text"
            value={engineerRef}
            onChange={(e) => setEngineerRef(e.target.value)}
            className={inputClassName}
          />
        </FormField>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Upgraded limits (kg)
        </h3>
        <p className="mb-4 text-xs text-gray-500">
          Only enter a figure the certificate actually states. A blank field
          means the kit doesn&apos;t move that limit — the factory value stays
          (the GCM-doesn&apos;t-move case).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="GVM" name="gvmKg">
            <input
              id="gvmKg"
              type="number"
              inputMode="numeric"
              value={gvmKg}
              onChange={(e) => setGvmKg(e.target.value)}
              placeholder={limitPlaceholder(factory.gvmKg)}
              className={inputClassName}
            />
          </FormField>
          <FormField label="GCM" name="gcmKg">
            <input
              id="gcmKg"
              type="number"
              inputMode="numeric"
              value={gcmKg}
              onChange={(e) => setGcmKg(e.target.value)}
              placeholder={limitPlaceholder(factory.gcmKg)}
              className={inputClassName}
            />
          </FormField>
          <FormField label="Max towing" name="maxTowingKg">
            <input
              id="maxTowingKg"
              type="number"
              inputMode="numeric"
              value={maxTowingKg}
              onChange={(e) => setMaxTowingKg(e.target.value)}
              placeholder={limitPlaceholder(factory.maxTowingKg)}
              className={inputClassName}
            />
          </FormField>
          <FormField label="Front axle limit" name="frontAxleLimitKg">
            <input
              id="frontAxleLimitKg"
              type="number"
              inputMode="numeric"
              value={frontAxleLimitKg}
              onChange={(e) => setFrontAxleLimitKg(e.target.value)}
              placeholder={limitPlaceholder(factory.frontAxleLimitKg)}
              className={inputClassName}
            />
          </FormField>
          <FormField label="Rear axle limit" name="rearAxleLimitKg">
            <input
              id="rearAxleLimitKg"
              type="number"
              inputMode="numeric"
              value={rearAxleLimitKg}
              onChange={(e) => setRearAxleLimitKg(e.target.value)}
              placeholder={limitPlaceholder(factory.rearAxleLimitKg)}
              className={inputClassName}
            />
          </FormField>
          <FormField label="Added kit mass" name="addedMassKg">
            <input
              id="addedMassKg"
              type="number"
              inputMode="numeric"
              value={addedMassKg}
              onChange={(e) => setAddedMassKg(e.target.value)}
              placeholder="heavier springs etc."
              className={inputClassName}
            />
          </FormField>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Certified state" name="certifiedState">
          <select
            id="certifiedState"
            value={certifiedState}
            onChange={(e) =>
              setCertifiedState(e.target.value as AustralianState | '')
            }
            className={selectClassName}
          >
            <option value="">— (national / not stated) —</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Source URL" name="sourceUrl">
          <input
            id="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className={inputClassName}
          />
        </FormField>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="isPreRego"
            type="checkbox"
            checked={isPreRego}
            onChange={(e) => setIsPreRego(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="isPreRego" className="text-sm text-gray-700">
            Pre-rego (nationally recognised)
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting
            ? 'Saving…'
            : isEdit
              ? 'Update upgrade'
              : 'Create upgrade'}
        </button>
      </div>
    </form>
  );
}
