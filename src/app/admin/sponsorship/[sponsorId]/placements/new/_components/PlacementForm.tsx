"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/admin/components/Toast";
import { FormField, inputClassName, selectClassName } from "@/modules/admin/components/FormField";
import { createPlacementAction } from "@/modules/sponsorship/actions/sponsor-admin.actions";
import type { CategoryOption, AccessoryOption } from "@/modules/sponsorship/actions/sponsor-admin.actions";
import type { PlacementType, PlacementTier, VehicleBodyType } from "@prisma/client";

type Scope = "accessory" | "category" | "vehicle_type" | "recommendation";

const SCOPE_OPTIONS: { value: Scope; label: string; description: string }[] = [
  { value: "accessory", label: "Specific Accessory", description: "Featured placement for a single accessory item" },
  { value: "category", label: "Accessory Category", description: "Top placement within an accessory category" },
  { value: "vehicle_type", label: "Vehicle Type", description: "Featured placement on a vehicle type page" },
  { value: "recommendation", label: "Upgrade Pathway", description: "Pinned placement in recommendation results" },
];

const SCOPE_TO_PLACEMENT_TYPE: Record<Scope, PlacementType> = {
  accessory: "ACCESSORY_FEATURED",
  category: "CATEGORY_TOP",
  vehicle_type: "VEHICLE_TYPE_FEATURED",
  recommendation: "RECOMMENDATION_PINNED",
};

const TIER_OPTIONS: { value: PlacementTier; label: string }[] = [
  { value: "FEATURED_FIT", label: "Featured Fit" },
  { value: "CATEGORY_TOP", label: "Category Top" },
  { value: "RECOMMENDATION_PINNED", label: "Recommendation Pinned" },
];

const VEHICLE_BODY_TYPES: { value: VehicleBodyType; label: string }[] = [
  { value: "DUAL_CAB_UTE", label: "Dual Cab Ute" },
  { value: "SINGLE_CAB_UTE", label: "Single Cab Ute" },
  { value: "EXTRA_CAB_UTE", label: "Extra Cab Ute" },
  { value: "WAGON", label: "Wagon" },
  { value: "SUV", label: "SUV" },
  { value: "VAN", label: "Van" },
  { value: "TROOPCARRIER", label: "Troopcarrier" },
  { value: "OTHER", label: "Other" },
];

const STEPS = ["Scope", "Tier", "Dates", "Review"] as const;

export function PlacementForm({
  sponsorId,
  sponsorName,
  categories,
  accessories,
  backHref,
}: {
  sponsorId: string;
  sponsorName: string;
  categories: CategoryOption[];
  accessories: AccessoryOption[];
  backHref: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  const [scope, setScope] = useState<Scope>("accessory");
  const [accessoryId, setAccessoryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [vehicleBodyType, setVehicleBodyType] = useState<VehicleBodyType>("SUV");
  const [tier, setTier] = useState<PlacementTier>("FEATURED_FIT");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [stepError, setStepError] = useState("");

  function validateStep(): boolean {
    setStepError("");
    if (step === 0) {
      if (scope === "accessory" && !accessoryId) {
        setStepError("Please select an accessory");
        return false;
      }
      if (scope === "category" && !categoryId) {
        setStepError("Please select a category");
        return false;
      }
    }
    if (step === 2) {
      if (!startsAt) { setStepError("Start date is required"); return false; }
      if (!endsAt) { setStepError("End date is required"); return false; }
      if (new Date(endsAt) <= new Date(startsAt)) {
        setStepError("End date must be after start date");
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStepError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    if (!validateStep()) return;
    startTransition(async () => {
      const placementType = SCOPE_TO_PLACEMENT_TYPE[scope];
      const result = await createPlacementAction({
        sponsorId,
        placementType,
        tier,
        startsAt,
        endsAt,
        accessoryId: scope === "accessory" ? accessoryId : null,
        categoryId: scope === "category" ? categoryId : null,
        vehicleBodyType: scope === "vehicle_type" ? vehicleBodyType : null,
        notes: notes.trim() || null,
      });

      if (result.success) {
        toast("Placement created");
        router.push(backHref);
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });
  }

  const selectedAccessory = accessories.find((a) => a.id === accessoryId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedTier = TIER_OPTIONS.find((t) => t.value === tier);
  const selectedVehicle = VEHICLE_BODY_TYPES.find((v) => v.value === vehicleBodyType);

  return (
    <div className="max-w-xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i < step
                  ? "bg-tb-primary text-white"
                  : i === step
                  ? "border-2 border-tb-primary text-tb-primary"
                  : "border border-tb-neutral-200 text-gray-400"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium text-gray-900" : "text-gray-500"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="h-px w-8 bg-tb-neutral-200" />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Scope */}
      {step === 0 && (
        <div className="rounded-lg border border-tb-neutral-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Select Scope</h2>
          <div className="space-y-3">
            {SCOPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  scope === opt.value ? "border-tb-primary bg-blue-50" : "border-tb-neutral-200 hover:bg-tb-neutral-50"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value={opt.value}
                  checked={scope === opt.value}
                  onChange={() => setScope(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  <div className="text-sm text-gray-500">{opt.description}</div>
                </div>
              </label>
            ))}
          </div>

          {scope === "accessory" && (
            <FormField label="Select Accessory" name="accessoryId">
              <select
                id="accessoryId"
                value={accessoryId}
                onChange={(e) => setAccessoryId(e.target.value)}
                className={selectClassName}
              >
                <option value="">— Select accessory —</option>
                {accessories.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </FormField>
          )}

          {scope === "category" && (
            <FormField label="Select Category" name="categoryId">
              <select
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={selectClassName}
              >
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          )}

          {scope === "vehicle_type" && (
            <FormField label="Select Vehicle Type" name="vehicleBodyType">
              <select
                id="vehicleBodyType"
                value={vehicleBodyType}
                onChange={(e) => setVehicleBodyType(e.target.value as VehicleBodyType)}
                className={selectClassName}
              >
                {VEHICLE_BODY_TYPES.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </FormField>
          )}
        </div>
      )}

      {/* Step 1: Tier */}
      {step === 1 && (
        <div className="rounded-lg border border-tb-neutral-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Select Tier</h2>
          <div className="space-y-3">
            {TIER_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                  tier === opt.value ? "border-tb-primary bg-blue-50" : "border-tb-neutral-200 hover:bg-tb-neutral-50"
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  value={opt.value}
                  checked={tier === opt.value}
                  onChange={() => setTier(opt.value)}
                />
                <span className="font-medium text-gray-900">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Dates */}
      {step === 2 && (
        <div className="rounded-lg border border-tb-neutral-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Date Range</h2>

          <FormField label="Start Date" name="startsAt">
            <input
              id="startsAt"
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClassName}
            />
          </FormField>

          <FormField label="End Date" name="endsAt">
            <input
              id="endsAt"
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={inputClassName}
            />
          </FormField>

          <FormField label="Admin Note (optional)" name="notes">
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes..."
              className={`${inputClassName} resize-none`}
            />
          </FormField>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="rounded-lg border border-tb-neutral-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Review Placement</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-4">
              <dt className="w-36 text-gray-500">Sponsor</dt>
              <dd className="font-medium text-gray-900">{sponsorName}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-36 text-gray-500">Scope</dt>
              <dd className="font-medium text-gray-900">
                {scope === "accessory" && selectedAccessory?.name}
                {scope === "category" && selectedCategory?.name}
                {scope === "vehicle_type" && selectedVehicle?.label}
                {scope === "recommendation" && "Upgrade Pathway (global)"}
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-36 text-gray-500">Tier</dt>
              <dd className="font-medium text-gray-900">{selectedTier?.label}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-36 text-gray-500">Date range</dt>
              <dd className="font-medium text-gray-900">
                {startsAt} – {endsAt}
              </dd>
            </div>
            {notes && (
              <div className="flex gap-4">
                <dt className="w-36 text-gray-500">Note</dt>
                <dd className="text-gray-700">{notes}</dd>
              </div>
            )}
          </dl>
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
            ACCC compliance: sponsored labels are enforced at the rendering layer and cannot be hidden by admin configuration.
          </p>
        </div>
      )}

      {/* Error */}
      {stepError && (
        <p className="mt-3 text-sm text-red-600">{stepError}</p>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={step === 0 ? () => router.push(backHref) : handleBack}
          className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
        >
          {step === 0 ? "Cancel" : "← Back"}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create Placement"}
          </button>
        )}
      </div>
    </div>
  );
}
