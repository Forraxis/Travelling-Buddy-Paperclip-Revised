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
  createFitmentAction,
  updateFitmentAction,
} from "@/modules/catalogue/actions/accessory-admin.actions";
import type { AccessoryFitmentDto } from "@/modules/catalogue/types/fitment.types";
import type {
  MountingLocation,
  PositionType,
  FitmentConfidence,
  FitmentSource,
} from "@prisma/client";

const ALL_MOUNTING_LOCATIONS: MountingLocation[] = [
  "CHASSIS_FRONT", "CHASSIS_MID", "CHASSIS_REAR",
  "BULL_BAR", "ROOF_RACK", "ROOF_RAILS",
  "TRAY_FLOOR", "TRAY_SIDE_LEFT", "TRAY_SIDE_RIGHT",
  "TRAY_HEADBOARD", "TRAY_TAILGATE",
  "CANOPY_EXTERIOR", "CANOPY_INTERIOR", "CANOPY_ROOF",
  "TUB_INTERIOR", "TUB_EXTERIOR",
  "BONNET", "REAR_BAR", "TOW_HITCH",
  "WHEEL_ARCH_LEFT", "WHEEL_ARCH_RIGHT",
  "UNDERBODY_FRONT", "UNDERBODY_MID", "UNDERBODY_REAR",
  "A_PILLAR_LEFT", "A_PILLAR_RIGHT",
  "WINDSCREEN", "CABIN_INTERIOR", "CABIN_ROOF", "CABIN_DASH",
  "DOOR_LEFT", "DOOR_RIGHT", "SNORKEL",
  "FENDER_LEFT", "FENDER_RIGHT",
  "CARAVAN_DRAWBAR", "CARAVAN_A_FRAME",
  "CARAVAN_CHASSIS_FRONT", "CARAVAN_CHASSIS_MID", "CARAVAN_CHASSIS_REAR",
  "CARAVAN_UNDERBODY", "CARAVAN_ROOF",
  "CARAVAN_WALL_LEFT", "CARAVAN_WALL_RIGHT",
  "CARAVAN_WALL_FRONT", "CARAVAN_WALL_REAR",
  "CARAVAN_BUMPER_BAR", "CARAVAN_BOOT", "CARAVAN_TUNNEL_BOOT",
  "CARAVAN_TOOLBAR_EXTERNAL", "CARAVAN_TOOLBAR_INTERNAL",
];

function locationLabel(loc: MountingLocation): string {
  return loc.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FitmentFormProps {
  accessoryId: string;
  fitment?: AccessoryFitmentDto;
  backHref: string;
}

export function FitmentForm({ accessoryId, fitment, backHref }: FitmentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!fitment;

  const [vehicleVariantId, setVehicleVariantId] = useState(
    fitment?.vehicleVariantId ?? ""
  );
  const [caravanVariantId, setCaravanVariantId] = useState(
    fitment?.caravanVariantId ?? ""
  );
  const [targetType, setTargetType] = useState<"vehicle" | "caravan">(
    fitment?.caravanVariantId ? "caravan" : "vehicle"
  );

  const [installedWeightKg, setInstalledWeightKg] = useState(
    fitment?.installedWeightKg?.toString() ?? ""
  );
  const [positionType, setPositionType] = useState<PositionType>(
    fitment?.positionType ?? "FIXED"
  );
  const [mountingLocation, setMountingLocation] = useState<MountingLocation>(
    fitment?.mountingLocation ?? "CHASSIS_FRONT"
  );
  const [providesMountingLocations, setProvidesMountingLocations] = useState<
    MountingLocation[]
  >(fitment?.providesMountingLocations ?? []);

  const [cogXMm, setCogXMm] = useState(fitment?.cogXMm?.toString() ?? "");
  const [startXMm, setStartXMm] = useState(fitment?.startXMm?.toString() ?? "");
  const [endXMm, setEndXMm] = useState(fitment?.endXMm?.toString() ?? "");
  const [mountOffsetXMm, setMountOffsetXMm] = useState(
    fitment?.mountOffsetXMm?.toString() ?? ""
  );

  const [tankCapacityL, setTankCapacityL] = useState(
    fitment?.tankCapacityL?.toString() ?? ""
  );
  const [tankContentsKgPerL, setTankContentsKgPerL] = useState(
    fitment?.tankContentsKgPerL?.toString() ?? ""
  );

  const [confidence, setConfidence] = useState<FitmentConfidence>(
    fitment?.confidence ?? "ESTIMATED"
  );
  const [source, setSource] = useState<FitmentSource>(
    fitment?.source ?? "USER_SUBMITTED"
  );
  const [notes, setNotes] = useState(fitment?.notes ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function toggleProvides(loc: MountingLocation) {
    setProvidesMountingLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!installedWeightKg || isNaN(parseFloat(installedWeightKg))) {
      errs.installedWeightKg = "Weight is required";
    }
    if (targetType === "vehicle" && !vehicleVariantId.trim()) {
      errs.vehicleVariantId = "Vehicle variant ID is required";
    }
    if (targetType === "caravan" && !caravanVariantId.trim()) {
      errs.caravanVariantId = "Caravan variant ID is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const input = {
      accessoryId,
      vehicleVariantId: targetType === "vehicle" ? vehicleVariantId.trim() : null,
      caravanVariantId: targetType === "caravan" ? caravanVariantId.trim() : null,
      installedWeightKg: parseFloat(installedWeightKg),
      positionType,
      mountingLocation,
      providesMountingLocations,
      cogXMm: cogXMm ? parseInt(cogXMm) : null,
      startXMm: startXMm ? parseInt(startXMm) : null,
      endXMm: endXMm ? parseInt(endXMm) : null,
      mountOffsetXMm: mountOffsetXMm ? parseInt(mountOffsetXMm) : null,
      tankCapacityL: tankCapacityL ? parseFloat(tankCapacityL) : null,
      tankContentsKgPerL: tankContentsKgPerL ? parseFloat(tankContentsKgPerL) : null,
      confidence,
      source,
      notes: notes.trim() || null,
    };

    const result = isEdit
      ? await updateFitmentAction(fitment!.id, accessoryId, input)
      : await createFitmentAction(input);

    setSubmitting(false);

    if (result.success) {
      toast(isEdit ? "Fitment updated" : "Fitment created");
      router.push(backHref);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Target */}
      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Target Vehicle or Caravan
        </h3>
        <div className="mb-4 flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={targetType === "vehicle"}
              onChange={() => setTargetType("vehicle")}
              className="h-4 w-4"
            />
            Vehicle variant
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={targetType === "caravan"}
              onChange={() => setTargetType("caravan")}
              className="h-4 w-4"
            />
            Caravan variant
          </label>
        </div>
        {targetType === "vehicle" ? (
          <FormField
            label="Vehicle Variant ID"
            name="vehicleVariantId"
            error={errors.vehicleVariantId}
          >
            <input
              id="vehicleVariantId"
              type="text"
              value={vehicleVariantId}
              onChange={(e) => setVehicleVariantId(e.target.value)}
              placeholder="cuid..."
              className={inputClassName}
            />
          </FormField>
        ) : (
          <FormField
            label="Caravan Variant ID"
            name="caravanVariantId"
            error={errors.caravanVariantId}
          >
            <input
              id="caravanVariantId"
              type="text"
              value={caravanVariantId}
              onChange={(e) => setCaravanVariantId(e.target.value)}
              placeholder="cuid..."
              className={inputClassName}
            />
          </FormField>
        )}
      </div>

      {/* Mounting location */}
      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Mounting Location
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Mounting Location" name="mountingLocation">
            <select
              id="mountingLocation"
              value={mountingLocation}
              onChange={(e) =>
                setMountingLocation(e.target.value as MountingLocation)
              }
              className={selectClassName}
            >
              {ALL_MOUNTING_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {locationLabel(loc)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Position Type" name="positionType">
            <select
              id="positionType"
              value={positionType}
              onChange={(e) => setPositionType(e.target.value as PositionType)}
              className={selectClassName}
            >
              <option value="FIXED">Fixed</option>
              <option value="ADJUSTABLE">Adjustable</option>
              <option value="MODULAR">Modular</option>
              <option value="SLIDING">Sliding</option>
            </select>
          </FormField>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">
            Provides Mounting Locations
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-tb-neutral-200 p-3">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {ALL_MOUNTING_LOCATIONS.map((loc) => (
                <label
                  key={loc}
                  className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-gray-700 hover:bg-tb-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={providesMountingLocations.includes(loc)}
                    onChange={() => toggleProvides(loc)}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  {locationLabel(loc)}
                </label>
              ))}
            </div>
          </div>
          {providesMountingLocations.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {providesMountingLocations.length} location
              {providesMountingLocations.length !== 1 ? "s" : ""} unlocked
            </p>
          )}
        </div>
      </div>

      {/* Position data */}
      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Position &amp; Weight
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField
            label="Installed Weight (kg)"
            name="installedWeightKg"
            error={errors.installedWeightKg}
          >
            <input
              id="installedWeightKg"
              type="number"
              step="0.01"
              min="0"
              value={installedWeightKg}
              onChange={(e) => setInstalledWeightKg(e.target.value)}
              placeholder="0.00"
              className={inputClassName}
            />
          </FormField>
          <FormField label="CoG X (mm)" name="cogXMm">
            <input
              id="cogXMm"
              type="number"
              value={cogXMm}
              onChange={(e) => setCogXMm(e.target.value)}
              placeholder="optional"
              className={inputClassName}
            />
          </FormField>
          <FormField label="Mount Offset X (mm)" name="mountOffsetXMm">
            <input
              id="mountOffsetXMm"
              type="number"
              value={mountOffsetXMm}
              onChange={(e) => setMountOffsetXMm(e.target.value)}
              placeholder="optional"
              className={inputClassName}
            />
          </FormField>
          <FormField label="Start X (mm)" name="startXMm">
            <input
              id="startXMm"
              type="number"
              value={startXMm}
              onChange={(e) => setStartXMm(e.target.value)}
              placeholder="optional"
              className={inputClassName}
            />
          </FormField>
          <FormField label="End X (mm)" name="endXMm">
            <input
              id="endXMm"
              type="number"
              value={endXMm}
              onChange={(e) => setEndXMm(e.target.value)}
              placeholder="optional"
              className={inputClassName}
            />
          </FormField>
        </div>
      </div>

      {/* Tank / fluid */}
      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Tank / Fluid (optional)
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Tank Capacity (L)" name="tankCapacityL">
            <input
              id="tankCapacityL"
              type="number"
              step="0.01"
              min="0"
              value={tankCapacityL}
              onChange={(e) => setTankCapacityL(e.target.value)}
              placeholder="optional"
              className={inputClassName}
            />
          </FormField>
          <FormField label="Fluid Density (kg/L)" name="tankContentsKgPerL">
            <input
              id="tankContentsKgPerL"
              type="number"
              step="0.001"
              min="0"
              value={tankContentsKgPerL}
              onChange={(e) => setTankContentsKgPerL(e.target.value)}
              placeholder="optional, e.g. 0.832 for diesel"
              className={inputClassName}
            />
          </FormField>
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Data Quality
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Confidence" name="confidence">
            <select
              id="confidence"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as FitmentConfidence)}
              className={selectClassName}
            >
              <option value="VERIFIED">Verified</option>
              <option value="MANUFACTURER_SPEC">Manufacturer Spec</option>
              <option value="COMMUNITY">Community</option>
              <option value="ESTIMATED">Estimated</option>
            </select>
          </FormField>
          <FormField label="Source" name="source">
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value as FitmentSource)}
              className={selectClassName}
            >
              <option value="OEM">OEM</option>
              <option value="AFTERMARKET_VERIFIED">Aftermarket Verified</option>
              <option value="USER_SUBMITTED">User Submitted</option>
              <option value="CALCULATED">Calculated</option>
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Notes" name="notes">
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes..."
                className={`${inputClassName} resize-none`}
              />
            </FormField>
          </div>
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
              ? "Update Fitment"
              : "Create Fitment"}
        </button>
      </div>
    </form>
  );
}
