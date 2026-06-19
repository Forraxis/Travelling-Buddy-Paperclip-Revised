'use client';

import { useEffect, useState } from 'react';
import { listGvmUpgradesForVehicleAction } from '../actions/gvm-upgrade-public.actions';
import { GvmUpgradeDisclaimerBanner } from './GvmUpgradeDisclaimerBanner';
import {
  GVM_UPGRADE_PATHWAY_LABELS,
  type CustomGvmUpgrade,
  type GvmUpgradeKitDto,
} from '../types';
import type { AustralianState } from '@prisma/client';

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

const inputCls =
  'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-tb-primary focus:ring-1 focus:ring-tb-primary focus:outline-none';
const selectCls =
  'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-tb-primary focus:ring-1 focus:ring-tb-primary focus:outline-none';

/** The selection this component emits — wired to Setup.appliedGvmUpgradeId / customGvmUpgrade. */
export interface GvmUpgradeSelection {
  appliedGvmUpgradeId: string | null;
  customGvmUpgrade: CustomGvmUpgrade | null;
}

type Choice = 'none' | 'kit' | 'custom';

function toIntOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Controlled "Have a GVM upgrade?" picker for the calculator / setup. The caller
 * owns `value` (the setup's appliedGvmUpgradeId / customGvmUpgrade) and is wired
 * to persist it. The picker offers the CATALOGUE kits for this vehicle, or a
 * free-form custom (plate / engineer-cert) entry.
 *
 * Rule 11: this only RECORDS the upgrade. The verdict-affecting overlay stays
 * behind GVM_UPGRADE_ENABLED + advisory (build-physics-input.ts). The disclaimer
 * is surfaced inline.
 */
export function GvmUpgradePicker({
  vehicleVariantId,
  value,
  onChange,
}: {
  vehicleVariantId: string | null;
  value: GvmUpgradeSelection;
  onChange: (next: GvmUpgradeSelection) => void;
}) {
  const [kits, setKits] = useState<GvmUpgradeKitDto[]>([]);
  const [loading, setLoading] = useState(false);

  const choice: Choice = value.appliedGvmUpgradeId
    ? 'kit'
    : value.customGvmUpgrade
      ? 'custom'
      : 'none';

  // Custom-entry local fields (only relevant when choice === 'custom').
  const custom = value.customGvmUpgrade;
  const [gvmKg, setGvmKg] = useState(
    custom?.gvmKg != null ? String(custom.gvmKg) : '',
  );
  const [gcmKg, setGcmKg] = useState(
    custom?.gcmKg != null ? String(custom.gcmKg) : '',
  );
  const [maxTowingKg, setMaxTowingKg] = useState(
    custom?.maxTowingKg != null ? String(custom.maxTowingKg) : '',
  );
  const [addedMassKg, setAddedMassKg] = useState(
    custom?.addedMassKg != null ? String(custom.addedMassKg) : '',
  );
  const [certifiedState, setCertifiedState] = useState<AustralianState | ''>(
    custom?.certifiedState ?? '',
  );
  const [engineerRef, setEngineerRef] = useState(custom?.engineerRef ?? '');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!vehicleVariantId) {
        if (active) setKits([]);
        return;
      }
      setLoading(true);
      try {
        const rows = await listGvmUpgradesForVehicleAction(vehicleVariantId);
        if (active) setKits(rows);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [vehicleVariantId]);

  function selectChoice(next: Choice) {
    if (next === 'none') {
      onChange({ appliedGvmUpgradeId: null, customGvmUpgrade: null });
    } else if (next === 'kit') {
      onChange({
        appliedGvmUpgradeId: kits[0]?.id ?? null,
        customGvmUpgrade: null,
      });
    } else {
      onChange({
        appliedGvmUpgradeId: null,
        customGvmUpgrade: buildCustom(),
      });
    }
  }

  function buildCustom(): CustomGvmUpgrade {
    return {
      gvmKg: toIntOrNull(gvmKg),
      gcmKg: toIntOrNull(gcmKg),
      maxTowingKg: toIntOrNull(maxTowingKg),
      addedMassKg: toIntOrNull(addedMassKg),
      certifiedState: certifiedState || null,
      engineerRef: engineerRef.trim() || null,
    };
  }

  function commitCustom() {
    onChange({ appliedGvmUpgradeId: null, customGvmUpgrade: buildCustom() });
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">
          Have a GVM upgrade?
        </legend>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="gvm-upgrade-choice"
            checked={choice === 'none'}
            onChange={() => selectChoice('none')}
          />
          No — factory limits
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="gvm-upgrade-choice"
            checked={choice === 'kit'}
            onChange={() => selectChoice('kit')}
            disabled={!loading && kits.length === 0}
          />
          Pick a known kit
          {loading
            ? ' (loading…)'
            : kits.length === 0
              ? ' (none catalogued for this vehicle)'
              : ''}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="gvm-upgrade-choice"
            checked={choice === 'custom'}
            onChange={() => selectChoice('custom')}
          />
          Enter custom (from my plate / engineer cert)
        </label>
      </fieldset>

      {choice === 'kit' && kits.length > 0 && (
        <div>
          <label
            htmlFor="gvm-kit"
            className="block text-sm font-medium text-gray-700"
          >
            GVM-upgrade kit
          </label>
          <select
            id="gvm-kit"
            value={value.appliedGvmUpgradeId ?? ''}
            onChange={(e) =>
              onChange({
                appliedGvmUpgradeId: e.target.value || null,
                customGvmUpgrade: null,
              })
            }
            className={`mt-1 ${selectCls}`}
          >
            {kits.map((k) => (
              <option key={k.id} value={k.id}>
                {k.modifierName}
                {k.gvmKg != null ? ` — GVM ${k.gvmKg} kg` : ''} (
                {GVM_UPGRADE_PATHWAY_LABELS[k.pathway]})
              </option>
            ))}
          </select>
        </div>
      )}

      {choice === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CustomField label="Upgraded GVM (kg)" id="custom-gvm">
            <input
              id="custom-gvm"
              type="number"
              inputMode="numeric"
              value={gvmKg}
              onChange={(e) => setGvmKg(e.target.value)}
              onBlur={commitCustom}
              placeholder="required"
              className={inputCls}
            />
          </CustomField>
          <CustomField label="Upgraded GCM (kg)" id="custom-gcm">
            <input
              id="custom-gcm"
              type="number"
              inputMode="numeric"
              value={gcmKg}
              onChange={(e) => setGcmKg(e.target.value)}
              onBlur={commitCustom}
              placeholder="blank = factory"
              className={inputCls}
            />
          </CustomField>
          <CustomField label="Max towing (kg)" id="custom-tow">
            <input
              id="custom-tow"
              type="number"
              inputMode="numeric"
              value={maxTowingKg}
              onChange={(e) => setMaxTowingKg(e.target.value)}
              onBlur={commitCustom}
              placeholder="blank = factory"
              className={inputCls}
            />
          </CustomField>
          <CustomField label="Added kit mass (kg)" id="custom-mass">
            <input
              id="custom-mass"
              type="number"
              inputMode="numeric"
              value={addedMassKg}
              onChange={(e) => setAddedMassKg(e.target.value)}
              onBlur={commitCustom}
              placeholder="heavier springs etc."
              className={inputCls}
            />
          </CustomField>
          <CustomField label="Certified state" id="custom-state">
            <select
              id="custom-state"
              value={certifiedState}
              onChange={(e) => {
                setCertifiedState(e.target.value as AustralianState | '');
                // commit immediately for selects (no blur path)
                onChange({
                  appliedGvmUpgradeId: null,
                  customGvmUpgrade: {
                    ...buildCustom(),
                    certifiedState:
                      (e.target.value as AustralianState | '') || null,
                  },
                });
              }}
              className={selectCls}
            >
              <option value="">— not stated —</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </CustomField>
          <CustomField label="Engineer / cert ref" id="custom-ref">
            <input
              id="custom-ref"
              type="text"
              value={engineerRef}
              onChange={(e) => setEngineerRef(e.target.value)}
              onBlur={commitCustom}
              className={inputCls}
            />
          </CustomField>
        </div>
      )}

      {choice !== 'none' && <GvmUpgradeDisclaimerBanner />}
    </div>
  );
}

function CustomField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
