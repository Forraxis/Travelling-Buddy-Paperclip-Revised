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
  createVariantAction,
  updateVariantAction,
} from "@/modules/catalogue/actions/vehicle.actions";
import type { VehicleVariantDto } from "@/modules/catalogue/types/vehicle.types";
import type { FuelType, Market } from "@prisma/client";

const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: "DIESEL", label: "Diesel" },
  { value: "PETROL", label: "Petrol" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ELECTRIC", label: "Electric" },
];

const MARKETS: { value: Market; label: string }[] = [
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "US", label: "United States" },
  { value: "EU", label: "Europe" },
  { value: "GB", label: "United Kingdom" },
];

interface VariantFormProps {
  modelId: string;
  variant?: VehicleVariantDto;
  backHref: string;
}

export function VariantForm({ modelId, variant, backHref }: VariantFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!variant;

  const [name, setName] = useState(variant?.name ?? "");
  const [yearFrom, setYearFrom] = useState(variant?.yearFrom?.toString() ?? "");
  const [yearTo, setYearTo] = useState(variant?.yearTo?.toString() ?? "");
  const [isCurrentProduction, setIsCurrentProduction] = useState(
    variant?.isCurrentProduction ?? false
  );
  const [fuelType, setFuelType] = useState<FuelType>(
    variant?.fuelType ?? "DIESEL"
  );
  const [market, setMarket] = useState<Market>(variant?.market ?? "AU");
  const [gvmKg, setGvmKg] = useState(variant?.gvmKg?.toString() ?? "");
  const [gcmKg, setGcmKg] = useState(variant?.gcmKg?.toString() ?? "");
  const [kerbWeightKg, setKerbWeightKg] = useState(
    variant?.kerbWeightKg?.toString() ?? ""
  );
  const [maxTowingCapacityKg, setMaxTowingCapacityKg] = useState(
    variant?.maxTowingCapacityKg?.toString() ?? ""
  );
  const [frontAxleLimitKg, setFrontAxleLimitKg] = useState(
    variant?.frontAxleLimitKg?.toString() ?? ""
  );
  const [rearAxleLimitKg, setRearAxleLimitKg] = useState(
    variant?.rearAxleLimitKg?.toString() ?? ""
  );
  const [wheelbaseMm, setWheelbaseMm] = useState(
    variant?.wheelbaseMm?.toString() ?? ""
  );
  const [frontOverhangMm, setFrontOverhangMm] = useState(
    variant?.frontOverhangMm?.toString() ?? ""
  );
  const [rearOverhangMm, setRearOverhangMm] = useState(
    variant?.rearOverhangMm?.toString() ?? ""
  );
  const [totalLengthMm, setTotalLengthMm] = useState(
    variant?.totalLengthMm?.toString() ?? ""
  );
  const [maxTowBallDownloadKg, setMaxTowBallDownloadKg] = useState(
    variant?.maxTowBallDownloadKg?.toString() ?? ""
  );
  const [fuelTankCapacityL, setFuelTankCapacityL] = useState(
    variant?.fuelTankCapacityL?.toString() ?? ""
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
    const intFields = [
      ["gvmKg", gvmKg],
      ["gcmKg", gcmKg],
      ["kerbWeightKg", kerbWeightKg],
      ["maxTowingCapacityKg", maxTowingCapacityKg],
      ["frontAxleLimitKg", frontAxleLimitKg],
      ["rearAxleLimitKg", rearAxleLimitKg],
      ["wheelbaseMm", wheelbaseMm],
      ["maxTowBallDownloadKg", maxTowBallDownloadKg],
      ["fuelTankCapacityL", fuelTankCapacityL],
    ] as const;
    for (const [field, val] of intFields) {
      if (!val) {
        errs[field] = "Required";
      } else if (isNaN(parseInt(val)) || parseInt(val) < 0) {
        errs[field] = "Must be a positive number";
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
      fuelType,
      market,
      gvmKg: parseInt(gvmKg),
      gcmKg: parseInt(gcmKg),
      kerbWeightKg: parseInt(kerbWeightKg),
      maxTowingCapacityKg: parseInt(maxTowingCapacityKg),
      frontAxleLimitKg: parseInt(frontAxleLimitKg),
      rearAxleLimitKg: parseInt(rearAxleLimitKg),
      wheelbaseMm: parseInt(wheelbaseMm),
      frontOverhangMm: frontOverhangMm ? parseInt(frontOverhangMm) : null,
      rearOverhangMm: rearOverhangMm ? parseInt(rearOverhangMm) : null,
      totalLengthMm: totalLengthMm ? parseInt(totalLengthMm) : null,
      maxTowBallDownloadKg: parseInt(maxTowBallDownloadKg),
      fuelTankCapacityL: parseInt(fuelTankCapacityL),
    };

    const result = isEdit
      ? await updateVariantAction(variant!.id, input)
      : await createVariantAction(input);

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
              placeholder="e.g. SR5 4x4 Auto"
              className={inputClassName}
            />
          </FormField>
          <FormField label="Fuel Type" name="fuelType">
            <select
              id="fuelType"
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as FuelType)}
              className={selectClassName}
            >
              {FUEL_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
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
          Weights &amp; Capacities
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="GVM (kg)" name="gvmKg" error={errors.gvmKg}>
            <input id="gvmKg" type="number" value={gvmKg} onChange={(e) => setGvmKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="GCM (kg)" name="gcmKg" error={errors.gcmKg}>
            <input id="gcmKg" type="number" value={gcmKg} onChange={(e) => setGcmKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Kerb Weight (kg)" name="kerbWeightKg" error={errors.kerbWeightKg}>
            <input id="kerbWeightKg" type="number" value={kerbWeightKg} onChange={(e) => setKerbWeightKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Max Towing Capacity (kg)" name="maxTowingCapacityKg" error={errors.maxTowingCapacityKg}>
            <input id="maxTowingCapacityKg" type="number" value={maxTowingCapacityKg} onChange={(e) => setMaxTowingCapacityKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Front Axle Limit (kg)" name="frontAxleLimitKg" error={errors.frontAxleLimitKg}>
            <input id="frontAxleLimitKg" type="number" value={frontAxleLimitKg} onChange={(e) => setFrontAxleLimitKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Rear Axle Limit (kg)" name="rearAxleLimitKg" error={errors.rearAxleLimitKg}>
            <input id="rearAxleLimitKg" type="number" value={rearAxleLimitKg} onChange={(e) => setRearAxleLimitKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Max Tow Ball Download (kg)" name="maxTowBallDownloadKg" error={errors.maxTowBallDownloadKg}>
            <input id="maxTowBallDownloadKg" type="number" value={maxTowBallDownloadKg} onChange={(e) => setMaxTowBallDownloadKg(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Fuel Tank Capacity (L)" name="fuelTankCapacityL" error={errors.fuelTankCapacityL}>
            <input id="fuelTankCapacityL" type="number" value={fuelTankCapacityL} onChange={(e) => setFuelTankCapacityL(e.target.value)} className={inputClassName} />
          </FormField>
        </div>
      </div>

      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Dimensions (optional)
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Wheelbase (mm)" name="wheelbaseMm" error={errors.wheelbaseMm}>
            <input id="wheelbaseMm" type="number" value={wheelbaseMm} onChange={(e) => setWheelbaseMm(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Front Overhang (mm)" name="frontOverhangMm">
            <input id="frontOverhangMm" type="number" value={frontOverhangMm} onChange={(e) => setFrontOverhangMm(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Rear Overhang (mm)" name="rearOverhangMm">
            <input id="rearOverhangMm" type="number" value={rearOverhangMm} onChange={(e) => setRearOverhangMm(e.target.value)} className={inputClassName} />
          </FormField>
          <FormField label="Total Length (mm)" name="totalLengthMm">
            <input id="totalLengthMm" type="number" value={totalLengthMm} onChange={(e) => setTotalLengthMm(e.target.value)} className={inputClassName} />
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
