"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/admin/components/Toast";
import {
  FormField,
  inputClassName,
  selectClassName,
} from "@/modules/admin/components/FormField";
import {
  createCaravanVariantAction,
  updateCaravanVariantAction,
} from "@/modules/catalogue/actions/caravan.actions";
import type { CaravanVariantDto } from "@/modules/catalogue/types/caravan.types";
import type { AxleConfiguration, Market } from "@prisma/client";

const AXLE_CONFIGS: { value: AxleConfiguration; label: string }[] = [
  { value: "SINGLE_AXLE", label: "Single Axle" },
  { value: "DUAL_AXLE_CLOSE_COUPLED", label: "Dual Axle (Close Coupled)" },
  { value: "DUAL_AXLE_SPREAD", label: "Dual Axle (Spread)" },
  { value: "TRIPLE_AXLE", label: "Triple Axle" },
];

const MARKETS: { value: Market; label: string }[] = [
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "US", label: "United States" },
  { value: "EU", label: "Europe" },
  { value: "GB", label: "United Kingdom" },
];

function isMultiAxle(config: AxleConfiguration): boolean {
  return config !== "SINGLE_AXLE";
}

interface CaravanVariantFormProps {
  modelId: string;
  variant?: CaravanVariantDto;
  backHref: string;
}

export function CaravanVariantForm({ modelId, variant, backHref }: CaravanVariantFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!variant;

  const [name, setName] = useState(variant?.name ?? "");
  const [yearFrom, setYearFrom] = useState(variant?.yearFrom?.toString() ?? "");
  const [yearTo, setYearTo] = useState(variant?.yearTo?.toString() ?? "");
  const [isCurrentProduction, setIsCurrentProduction] = useState(
    variant?.isCurrentProduction ?? false
  );
  const [market, setMarket] = useState<Market>(variant?.market ?? "AU");
  const [atmKg, setAtmKg] = useState(variant?.atmKg?.toString() ?? "");
  const [gtmKg, setGtmKg] = useState(variant?.gtmKg?.toString() ?? "");
  const [tareKg, setTareKg] = useState(variant?.tareKg?.toString() ?? "");
  const [tbmKg, setTbmKg] = useState(variant?.tbmKg?.toString() ?? "");
  const [axleConfiguration, setAxleConfiguration] = useState<AxleConfiguration>(
    variant?.axleConfiguration ?? "SINGLE_AXLE"
  );
  const [couplingToAxleMm, setCouplingToAxleMm] = useState(
    variant?.couplingToAxleMm?.toString() ?? ""
  );
  const [axleSpacingMm, setAxleSpacingMm] = useState(
    variant?.axleSpacingMm?.toString() ?? ""
  );
  const [bodyLengthMm, setBodyLengthMm] = useState(
    variant?.bodyLengthMm?.toString() ?? ""
  );
  const [overallLengthMm, setOverallLengthMm] = useState(
    variant?.overallLengthMm?.toString() ?? ""
  );
  const [freshWaterCapacityL, setFreshWaterCapacityL] = useState(
    variant?.freshWaterCapacityL?.toString() ?? ""
  );
  const [greyWaterCapacityL, setGreyWaterCapacityL] = useState(
    variant?.greyWaterCapacityL?.toString() ?? ""
  );
  const [gasBottleConfig, setGasBottleConfig] = useState(
    variant?.gasBottleConfig ?? ""
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!yearFrom) errs.yearFrom = "Year from is required";
    if (!isCurrentProduction && !yearTo) errs.yearTo = "Year to is required (or mark as current production)";
    if (yearFrom && yearTo && !isCurrentProduction) {
      const from = parseInt(yearFrom);
      const to = parseInt(yearTo);
      if (from > to) errs.yearTo = "Year to must be >= year from";
      if (from < 1900 || from > 2100) errs.yearFrom = "Invalid year";
      if (to < 1900 || to > 2100) errs.yearTo = "Invalid year";
    }

    const requiredIntFields = [
      ["atmKg", atmKg],
      ["gtmKg", gtmKg],
      ["tareKg", tareKg],
      ["tbmKg", tbmKg],
      ["couplingToAxleMm", couplingToAxleMm],
      ["bodyLengthMm", bodyLengthMm],
      ["overallLengthMm", overallLengthMm],
      ["freshWaterCapacityL", freshWaterCapacityL],
      ["greyWaterCapacityL", greyWaterCapacityL],
    ] as const;
    for (const [field, val] of requiredIntFields) {
      if (!val) {
        errs[field] = "Required";
      } else if (isNaN(parseInt(val)) || parseInt(val) < 0) {
        errs[field] = "Must be a positive number";
      }
    }

    if (isMultiAxle(axleConfiguration)) {
      if (!axleSpacingMm) {
        errs.axleSpacingMm = "Required for multi-axle configurations";
      } else if (isNaN(parseInt(axleSpacingMm)) || parseInt(axleSpacingMm) < 0) {
        errs.axleSpacingMm = "Must be a positive number";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const parsedYearTo = isCurrentProduction
      ? parseInt(yearFrom)
      : parseInt(yearTo);

    const input = {
      modelId,
      name: name.trim(),
      yearFrom: parseInt(yearFrom),
      yearTo: parsedYearTo,
      isCurrentProduction,
      market,
      atmKg: parseInt(atmKg),
      gtmKg: parseInt(gtmKg),
      tareKg: parseInt(tareKg),
      tbmKg: parseInt(tbmKg),
      axleConfiguration,
      couplingToAxleMm: parseInt(couplingToAxleMm),
      axleSpacingMm: isMultiAxle(axleConfiguration) && axleSpacingMm ? parseInt(axleSpacingMm) : null,
      bodyLengthMm: parseInt(bodyLengthMm),
      overallLengthMm: parseInt(overallLengthMm),
      freshWaterCapacityL: parseInt(freshWaterCapacityL),
      greyWaterCapacityL: parseInt(greyWaterCapacityL),
      gasBottleConfig: gasBottleConfig.trim() || null,
    };

    const result = isEdit
      ? await updateCaravanVariantAction(variant!.id, input)
      : await createCaravanVariantAction(input);

    setSubmitting(false);

    if (result.success) {
      toast(isEdit ? "Variant updated" : "Variant created");
      router.push(backHref);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Identity
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Variant Name" name="name" error={errors.name}>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 19.61-2 Outback"
              className={inputClassName}
            />
          </FormField>
          <FormField label="Market" name="market">
            <select
              id="market"
              value={market}
              onChange={(e) => setMarket(e.target.value as Market)}
              className={selectClassName}
            >
              {MARKETS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Year Range
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Year From" name="yearFrom" error={errors.yearFrom}>
            <input
              id="yearFrom"
              type="number"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              placeholder="2020"
              min={1900}
              max={2100}
              className={inputClassName}
            />
          </FormField>
          <FormField label="Year To" name="yearTo" error={errors.yearTo}>
            <input
              id="yearTo"
              type="number"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              placeholder="2024"
              min={1900}
              max={2100}
              disabled={isCurrentProduction}
              className={`${inputClassName} ${isCurrentProduction ? "bg-gray-100 text-gray-400" : ""}`}
            />
          </FormField>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isCurrentProduction}
                onChange={(e) => setIsCurrentProduction(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Currently in production
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Weights
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="ATM (kg)" name="atmKg" error={errors.atmKg}>
            <input id="atmKg" type="number" value={atmKg} onChange={(e) => setAtmKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="GTM (kg)" name="gtmKg" error={errors.gtmKg}>
            <input id="gtmKg" type="number" value={gtmKg} onChange={(e) => setGtmKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Tare (kg)" name="tareKg" error={errors.tareKg}>
            <input id="tareKg" type="number" value={tareKg} onChange={(e) => setTareKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="TBM (kg)" name="tbmKg" error={errors.tbmKg}>
            <input id="tbmKg" type="number" value={tbmKg} onChange={(e) => setTbmKg(e.target.value)} className={inputClassName} />
          </FormField>
        </div>
      </div>

      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Axle &amp; Hitch
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Axle Configuration" name="axleConfiguration">
            <select
              id="axleConfiguration"
              value={axleConfiguration}
              onChange={(e) => setAxleConfiguration(e.target.value as AxleConfiguration)}
              className={selectClassName}
            >
              {AXLE_CONFIGS.map((ac) => (
                <option key={ac.value} value={ac.value}>
                  {ac.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Coupling to Axle (mm)" name="couplingToAxleMm" error={errors.couplingToAxleMm}>
            <input id="couplingToAxleMm" type="number" value={couplingToAxleMm} onChange={(e) => setCouplingToAxleMm(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Axle Spacing (mm)" name="axleSpacingMm" error={errors.axleSpacingMm}>
            <input
              id="axleSpacingMm"
              type="number"
              value={axleSpacingMm}
              onChange={(e) => setAxleSpacingMm(e.target.value)}
              disabled={!isMultiAxle(axleConfiguration)}
              className={`${inputClassName} ${!isMultiAxle(axleConfiguration) ? "bg-gray-100 text-gray-400" : ""}`}
            />
          </FormField>
        </div>
      </div>

      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Dimensions
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Body Length (mm)" name="bodyLengthMm" error={errors.bodyLengthMm}>
            <input id="bodyLengthMm" type="number" value={bodyLengthMm} onChange={(e) => setBodyLengthMm(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Overall Length (mm)" name="overallLengthMm" error={errors.overallLengthMm}>
            <input id="overallLengthMm" type="number" value={overallLengthMm} onChange={(e) => setOverallLengthMm(e.target.value)} className={inputClassName} />
          </FormField>
        </div>
      </div>

      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Water &amp; Gas
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Fresh Water (L)" name="freshWaterCapacityL" error={errors.freshWaterCapacityL}>
            <input id="freshWaterCapacityL" type="number" value={freshWaterCapacityL} onChange={(e) => setFreshWaterCapacityL(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Grey Water (L)" name="greyWaterCapacityL" error={errors.greyWaterCapacityL}>
            <input id="greyWaterCapacityL" type="number" value={greyWaterCapacityL} onChange={(e) => setGreyWaterCapacityL(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Gas Bottle Config" name="gasBottleConfig">
            <input
              id="gasBottleConfig"
              type="text"
              value={gasBottleConfig}
              onChange={(e) => setGasBottleConfig(e.target.value)}
              placeholder="e.g. 2x 9kg"
              className={inputClassName}
            />
          </FormField>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-tb-primary px-6 py-2 text-sm font-medium text-white hover:bg-tb-primary-light disabled:opacity-50"
        >
          {submitting
            ? "Saving..."
            : isEdit
              ? "Update Variant"
              : "Create Variant"}
        </button>
      </div>
    </form>
  );
}
