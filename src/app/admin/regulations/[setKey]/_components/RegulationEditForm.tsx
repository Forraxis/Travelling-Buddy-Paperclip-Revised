'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import { saveRegulationVersionAction } from '@/modules/regulations/actions/regulation.actions';
import type {
  RegulationData,
  RegulatoryReference,
} from '@/modules/regulations/types/regulation.types';

interface Props {
  code: string;
  initialData: RegulationData;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-tb-neutral-200 text-tb-neutral-600 mb-4 border-b pb-2 text-sm font-semibold tracking-wide uppercase">
      {children}
    </h3>
  );
}

function FieldRow({
  label,
  helper,
  children,
}: {
  label: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <p className="text-tb-neutral-400 mb-1.5 text-xs">{helper}</p>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-tb-neutral-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const checkboxLabelCls = 'ml-2 text-sm text-gray-700';

export function RegulationEditForm({ code, initialData }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<RegulationData>(initialData);
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [changeSummary, setChangeSummary] = useState('');

  function setGvmUpgrade<K extends keyof RegulationData['gvmUpgrade']>(
    key: K,
    value: RegulationData['gvmUpgrade'][K],
  ) {
    setData((d) => ({ ...d, gvmUpgrade: { ...d.gvmUpgrade, [key]: value } }));
  }

  function setTowingLicence<K extends keyof RegulationData['towingLicence']>(
    key: K,
    value: RegulationData['towingLicence'][K],
  ) {
    setData((d) => ({
      ...d,
      towingLicence: { ...d.towingLicence, [key]: value },
    }));
  }

  function setTrailerBrakes<K extends keyof RegulationData['trailerBrakes']>(
    key: K,
    value: RegulationData['trailerBrakes'][K],
  ) {
    setData((d) => ({
      ...d,
      trailerBrakes: { ...d.trailerBrakes, [key]: value },
    }));
  }

  function setLengthLimits<K extends keyof RegulationData['lengthLimits']>(
    key: K,
    value: RegulationData['lengthLimits'][K],
  ) {
    setData((d) => ({
      ...d,
      lengthLimits: { ...d.lengthLimits, [key]: value },
    }));
  }

  function setOverhangLimits<K extends keyof RegulationData['overhangLimits']>(
    key: K,
    value: RegulationData['overhangLimits'][K],
  ) {
    setData((d) => ({
      ...d,
      overhangLimits: { ...d.overhangLimits, [key]: value },
    }));
  }

  function setSpeedLimits<K extends keyof RegulationData['towingSpeedLimits']>(
    key: K,
    value: RegulationData['towingSpeedLimits'][K],
  ) {
    setData((d) => ({
      ...d,
      towingSpeedLimits: { ...d.towingSpeedLimits, [key]: value },
    }));
  }

  function updateRef(
    index: number,
    field: keyof RegulatoryReference,
    value: string,
  ) {
    setData((d) => {
      const refs = [...d.regulatoryReferences];
      refs[index] = { ...refs[index], [field]: value };
      return { ...d, regulatoryReferences: refs };
    });
  }

  function addRef() {
    setData((d) => ({
      ...d,
      regulatoryReferences: [
        ...d.regulatoryReferences,
        { title: '', url: '', notes: '' },
      ],
    }));
  }

  function removeRef(index: number) {
    setData((d) => ({
      ...d,
      regulatoryReferences: d.regulatoryReferences.filter(
        (_, i) => i !== index,
      ),
    }));
  }

  function handleSave() {
    if (!changeSummary.trim()) {
      toast('Change summary is required before saving', 'error');
      return;
    }
    startTransition(async () => {
      const result = await saveRegulationVersionAction(
        code,
        data,
        effectiveDate,
        changeSummary,
      );
      if (result.success) {
        toast('New version saved successfully');
        setChangeSummary('');
        router.refresh();
      } else {
        toast(result.error, 'error');
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* GVM Upgrade Rules */}
      <section>
        <SectionHeading>GVM Upgrade Rules</SectionHeading>
        <FieldRow
          label="Max GVM upgrade (%)"
          helper="Maximum percentage increase allowed for GVM upgrades. Affects whether a tow vehicle qualifies for upgraded payloads in calculations."
        >
          <input
            type="number"
            className={inputCls}
            value={data.gvmUpgrade.maxUpgradePercent}
            onChange={(e) =>
              setGvmUpgrade('maxUpgradePercent', Number(e.target.value))
            }
            min={0}
            max={100}
            step={0.1}
          />
        </FieldRow>
        <FieldRow
          label="Engineer certificate required"
          helper="Whether a certified engineer sign-off is required for GVM upgrades."
        >
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.gvmUpgrade.requiresEngineerCert}
              onChange={(e) =>
                setGvmUpgrade('requiresEngineerCert', e.target.checked)
              }
              className="border-tb-neutral-300 h-4 w-4 rounded text-blue-600"
            />
            <span className={checkboxLabelCls}>Required</span>
          </label>
        </FieldRow>
        <FieldRow
          label="Vehicle inspection required"
          helper="Whether a vehicle inspection is required for GVM upgrades to be recognised."
        >
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.gvmUpgrade.requiresVehicleInspection}
              onChange={(e) =>
                setGvmUpgrade('requiresVehicleInspection', e.target.checked)
              }
              className="border-tb-neutral-300 h-4 w-4 rounded text-blue-600"
            />
            <span className={checkboxLabelCls}>Required</span>
          </label>
        </FieldRow>
        <FieldRow
          label="Source URL"
          helper="Link to the governing regulation document."
        >
          <input
            type="url"
            className={inputCls}
            placeholder="https://..."
            value={data.gvmUpgrade.sourceUrl ?? ''}
            onChange={(e) =>
              setGvmUpgrade('sourceUrl', e.target.value || undefined)
            }
          />
        </FieldRow>
        <FieldRow label="Notes" helper="Additional notes shown to admins only.">
          <textarea
            className={inputCls}
            rows={2}
            value={data.gvmUpgrade.notes ?? ''}
            onChange={(e) =>
              setGvmUpgrade('notes', e.target.value || undefined)
            }
          />
        </FieldRow>
      </section>

      {/* Towing Licence Thresholds */}
      <section>
        <SectionHeading>Towing Licence Thresholds</SectionHeading>
        <FieldRow
          label="Standard licence max GTM (kg)"
          helper="Maximum trailer GTM a standard car licence holder may tow. Used in compliance warnings."
        >
          <input
            type="number"
            className={inputCls}
            value={data.towingLicence.standardLicenceMaxGtmKg}
            onChange={(e) =>
              setTowingLicence(
                'standardLicenceMaxGtmKg',
                Number(e.target.value),
              )
            }
            min={0}
          />
        </FieldRow>
        <FieldRow
          label="Heavy vehicle licence threshold (kg)"
          helper="GTM above which a heavy vehicle licence is required. Used in licence-class warnings."
        >
          <input
            type="number"
            className={inputCls}
            value={data.towingLicence.heavyVehicleLicenceThresholdKg}
            onChange={(e) =>
              setTowingLicence(
                'heavyVehicleLicenceThresholdKg',
                Number(e.target.value),
              )
            }
            min={0}
          />
        </FieldRow>
        <FieldRow label="Source URL" helper="Link to the licence regulations.">
          <input
            type="url"
            className={inputCls}
            placeholder="https://..."
            value={data.towingLicence.sourceUrl ?? ''}
            onChange={(e) =>
              setTowingLicence('sourceUrl', e.target.value || undefined)
            }
          />
        </FieldRow>
        <FieldRow label="Notes" helper="">
          <textarea
            className={inputCls}
            rows={2}
            value={data.towingLicence.notes ?? ''}
            onChange={(e) =>
              setTowingLicence('notes', e.target.value || undefined)
            }
          />
        </FieldRow>
      </section>

      {/* Trailer Brake Requirements */}
      <section>
        <SectionHeading>Trailer Brake Requirements</SectionHeading>
        <FieldRow
          label="Brakes required above GTM (kg)"
          helper="Minimum GTM at which any trailer braking system is required."
        >
          <input
            type="number"
            className={inputCls}
            value={data.trailerBrakes.brakesRequiredAboveGtmKg}
            onChange={(e) =>
              setTrailerBrakes(
                'brakesRequiredAboveGtmKg',
                Number(e.target.value),
              )
            }
            min={0}
          />
        </FieldRow>
        <FieldRow
          label="Electric brakes required above GTM (kg)"
          helper="GTM threshold above which electric trailer brakes are specifically required."
        >
          <input
            type="number"
            className={inputCls}
            value={data.trailerBrakes.electricBrakesRequiredAboveGtmKg}
            onChange={(e) =>
              setTrailerBrakes(
                'electricBrakesRequiredAboveGtmKg',
                Number(e.target.value),
              )
            }
            min={0}
          />
        </FieldRow>
        <FieldRow
          label="Breakaway system required"
          helper="Whether a breakaway braking system is mandated for trailers above the brake threshold."
        >
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={data.trailerBrakes.breakawaySystemRequired}
              onChange={(e) =>
                setTrailerBrakes('breakawaySystemRequired', e.target.checked)
              }
              className="border-tb-neutral-300 h-4 w-4 rounded text-blue-600"
            />
            <span className={checkboxLabelCls}>Required</span>
          </label>
        </FieldRow>
        <FieldRow
          label="Source URL"
          helper="Link to trailer brake regulations."
        >
          <input
            type="url"
            className={inputCls}
            placeholder="https://..."
            value={data.trailerBrakes.sourceUrl ?? ''}
            onChange={(e) =>
              setTrailerBrakes('sourceUrl', e.target.value || undefined)
            }
          />
        </FieldRow>
        <FieldRow label="Notes" helper="">
          <textarea
            className={inputCls}
            rows={2}
            value={data.trailerBrakes.notes ?? ''}
            onChange={(e) =>
              setTrailerBrakes('notes', e.target.value || undefined)
            }
          />
        </FieldRow>
      </section>

      {/* Length Limits */}
      <section>
        <SectionHeading>Length Limits</SectionHeading>
        <FieldRow
          label="Max vehicle length (m)"
          helper="Maximum overall vehicle length. Used in road-legal compliance checks."
        >
          <input
            type="number"
            className={inputCls}
            value={data.lengthLimits.maxVehicleLengthM}
            onChange={(e) =>
              setLengthLimits('maxVehicleLengthM', Number(e.target.value))
            }
            min={0}
            step={0.1}
          />
        </FieldRow>
        <FieldRow
          label="Max trailer length (m)"
          helper="Maximum trailer overall length including drawbar."
        >
          <input
            type="number"
            className={inputCls}
            value={data.lengthLimits.maxTrailerLengthM}
            onChange={(e) =>
              setLengthLimits('maxTrailerLengthM', Number(e.target.value))
            }
            min={0}
            step={0.1}
          />
        </FieldRow>
        <FieldRow
          label="Max combined length (m)"
          helper="Maximum combined vehicle + trailer length. Used in combination-length compliance checks."
        >
          <input
            type="number"
            className={inputCls}
            value={data.lengthLimits.maxCombinedLengthM}
            onChange={(e) =>
              setLengthLimits('maxCombinedLengthM', Number(e.target.value))
            }
            min={0}
            step={0.1}
          />
        </FieldRow>
        <FieldRow label="Source URL" helper="">
          <input
            type="url"
            className={inputCls}
            placeholder="https://..."
            value={data.lengthLimits.sourceUrl ?? ''}
            onChange={(e) =>
              setLengthLimits('sourceUrl', e.target.value || undefined)
            }
          />
        </FieldRow>
        <FieldRow label="Notes" helper="">
          <textarea
            className={inputCls}
            rows={2}
            value={data.lengthLimits.notes ?? ''}
            onChange={(e) =>
              setLengthLimits('notes', e.target.value || undefined)
            }
          />
        </FieldRow>
      </section>

      {/* Overhang Limits */}
      <section>
        <SectionHeading>Overhang Limits</SectionHeading>
        <FieldRow
          label="Max front overhang (%)"
          helper="Maximum front overhang as a percentage of vehicle wheelbase."
        >
          <input
            type="number"
            className={inputCls}
            value={data.overhangLimits.maxFrontOverhangPercent}
            onChange={(e) =>
              setOverhangLimits(
                'maxFrontOverhangPercent',
                Number(e.target.value),
              )
            }
            min={0}
            max={100}
            step={0.1}
          />
        </FieldRow>
        <FieldRow
          label="Max rear overhang (m)"
          helper="Maximum rear overhang in metres. Used in rear overhang compliance checks."
        >
          <input
            type="number"
            className={inputCls}
            value={data.overhangLimits.maxRearOverhangM}
            onChange={(e) =>
              setOverhangLimits('maxRearOverhangM', Number(e.target.value))
            }
            min={0}
            step={0.01}
          />
        </FieldRow>
        <FieldRow label="Source URL" helper="">
          <input
            type="url"
            className={inputCls}
            placeholder="https://..."
            value={data.overhangLimits.sourceUrl ?? ''}
            onChange={(e) =>
              setOverhangLimits('sourceUrl', e.target.value || undefined)
            }
          />
        </FieldRow>
        <FieldRow label="Notes" helper="">
          <textarea
            className={inputCls}
            rows={2}
            value={data.overhangLimits.notes ?? ''}
            onChange={(e) =>
              setOverhangLimits('notes', e.target.value || undefined)
            }
          />
        </FieldRow>
      </section>

      {/* Towing Speed Limits */}
      <section>
        <SectionHeading>Towing Speed Limits per Road Class</SectionHeading>
        <div className="grid grid-cols-3 gap-4">
          <FieldRow
            label="Urban (km/h)"
            helper="Max towing speed in urban areas."
          >
            <input
              type="number"
              className={inputCls}
              value={data.towingSpeedLimits.urban}
              onChange={(e) => setSpeedLimits('urban', Number(e.target.value))}
              min={0}
            />
          </FieldRow>
          <FieldRow
            label="Rural (km/h)"
            helper="Max towing speed on rural roads."
          >
            <input
              type="number"
              className={inputCls}
              value={data.towingSpeedLimits.rural}
              onChange={(e) => setSpeedLimits('rural', Number(e.target.value))}
              min={0}
            />
          </FieldRow>
          <FieldRow
            label="Highway (km/h)"
            helper="Max towing speed on highways/freeways."
          >
            <input
              type="number"
              className={inputCls}
              value={data.towingSpeedLimits.highway}
              onChange={(e) =>
                setSpeedLimits('highway', Number(e.target.value))
              }
              min={0}
            />
          </FieldRow>
        </div>
        <FieldRow label="Source URL" helper="">
          <input
            type="url"
            className={inputCls}
            placeholder="https://..."
            value={data.towingSpeedLimits.sourceUrl ?? ''}
            onChange={(e) =>
              setSpeedLimits('sourceUrl', e.target.value || undefined)
            }
          />
        </FieldRow>
        <FieldRow label="Notes" helper="">
          <textarea
            className={inputCls}
            rows={2}
            value={data.towingSpeedLimits.notes ?? ''}
            onChange={(e) =>
              setSpeedLimits('notes', e.target.value || undefined)
            }
          />
        </FieldRow>
      </section>

      {/* Regulatory References */}
      <section>
        <SectionHeading>Regulatory References</SectionHeading>
        <div className="space-y-3">
          {data.regulatoryReferences.map((ref, i) => (
            <div
              key={i}
              className="border-tb-neutral-200 rounded-md border p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-tb-neutral-500 text-xs font-medium">
                  Reference {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRef(i)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Title (e.g. Road Transport (Vehicle Registration) Regulation 2017)"
                  value={ref.title}
                  onChange={(e) => updateRef(i, 'title', e.target.value)}
                />
                <input
                  type="url"
                  className={inputCls}
                  placeholder="URL"
                  value={ref.url}
                  onChange={(e) => updateRef(i, 'url', e.target.value)}
                />
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Notes (optional)"
                  value={ref.notes ?? ''}
                  onChange={(e) => updateRef(i, 'notes', e.target.value)}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addRef}
            className="border-tb-neutral-300 text-tb-neutral-500 rounded-md border border-dashed px-4 py-2 text-sm hover:border-blue-400 hover:text-blue-600"
          >
            + Add reference
          </button>
        </div>
      </section>

      {/* Version Save */}
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
        <h3 className="mb-3 text-sm font-semibold text-blue-800">
          Save as New Version
        </h3>
        <p className="mb-4 text-xs text-blue-600">
          Saving creates a new immutable version. Existing versions are never
          modified. The most recent version with an effective date on or before
          today is used in calculations.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <FieldRow
            label="Effective date"
            helper="The date from which this version applies in calculations."
          >
            <input
              type="date"
              className={inputCls}
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </FieldRow>
          <FieldRow
            label="Change summary (required)"
            helper="Brief description of what changed and why."
          >
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. Updated electric brake threshold per 2026 regulation amendment"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
            />
          </FieldRow>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !changeSummary.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save New Version'}
        </button>
      </section>
    </div>
  );
}
