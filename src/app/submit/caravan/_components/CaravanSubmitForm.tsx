"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { processPhoto, uploadPhoto } from "@/lib/client/photo-processing";

interface DuplicateMatch {
  id: string;
  name: string;
  kind: "canonical" | "community";
  url: string;
}

type Step = "photo" | "form" | "confirm" | "success" | "duplicate";

type AxleConfig =
  | "SINGLE_AXLE"
  | "DUAL_AXLE_CLOSE_COUPLED"
  | "DUAL_AXLE_SPREAD"
  | "TRIPLE_AXLE"
  | "";

interface FormValues {
  newMakeName: string;
  newModelName: string;
  year: string;
  variantName: string;
  bodyType: string;
  axleConfiguration: AxleConfig;
  // Weights (required)
  atmKg: string;
  gtmKg: string;
  tareKg: string;
  tbmKg: string;
  // Geometry (captured)
  couplingToAxleMm: string;
  axleSpacingMm: string;
  bodyLengthMm: string;
  overallLengthMm: string;
  // Tanks
  freshWaterLitres: string;
  greyWaterLitres: string;
  gasBottleConfig: string;
  notes: string;
}

const BODY_TYPES = [
  "Caravan (pop-top)",
  "Caravan (full-height)",
  "Off-road caravan",
  "Camper trailer",
  "Fifth-wheeler",
  "Other",
];

const AXLE_CONFIGS: { value: AxleConfig; label: string }[] = [
  { value: "SINGLE_AXLE", label: "Single axle" },
  { value: "DUAL_AXLE_CLOSE_COUPLED", label: "Dual axle (close-coupled)" },
  { value: "DUAL_AXLE_SPREAD", label: "Dual axle (spread)" },
  { value: "TRIPLE_AXLE", label: "Triple axle" },
];

const MULTI_AXLE: AxleConfig[] = [
  "DUAL_AXLE_CLOSE_COUPLED",
  "DUAL_AXLE_SPREAD",
  "TRIPLE_AXLE",
];

function isFormValid(form: FormValues): boolean {
  return !!(
    form.newMakeName &&
    form.newModelName &&
    form.variantName &&
    form.bodyType &&
    form.axleConfiguration &&
    form.atmKg &&
    form.gtmKg &&
    form.tareKg &&
    form.tbmKg
  );
}

interface Props {
  isAuthenticated: boolean;
  initialValues?: Partial<Record<keyof FormValues, string>>;
}

export function CaravanSubmitForm({ isAuthenticated, initialValues }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialValues ? "form" : "photo");
  const [platePhotoFile, setPlatePhotoFile] = useState<File | null>(null);
  const [platePreview, setPlatePreview] = useState<string | null>(null);
  const [platePhotoKey, setPlatePhotoKey] = useState<string | null>(null);
  const [platePhotoUrl, setPlatePhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<DuplicateMatch[] | null>(null);
  const [dupSuspected, setDupSuspected] = useState(false);
  const dupCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EMPTY_CARAVAN_FORM: FormValues = {
    newMakeName: "",
    newModelName: "",
    year: String(new Date().getFullYear()),
    variantName: "",
    bodyType: "",
    axleConfiguration: "",
    atmKg: "",
    gtmKg: "",
    tareKg: "",
    tbmKg: "",
    couplingToAxleMm: "",
    axleSpacingMm: "",
    bodyLengthMm: "",
    overallLengthMm: "",
    freshWaterLitres: "",
    greyWaterLitres: "",
    gasBottleConfig: "",
    notes: "",
  };

  const [form, setForm] = useState<FormValues>(
    initialValues ? { ...EMPTY_CARAVAN_FORM, ...initialValues } as FormValues : EMPTY_CARAVAN_FORM
  );

  // Mid-flow duplicate check for caravans
  useEffect(() => {
    const makeName = form.newMakeName.trim();
    const modelName = form.newModelName.trim();
    const year = parseInt(form.year, 10);

    if (!makeName || !modelName || !year || year < 1950) {
      setDupWarning(null);
      return;
    }

    if (dupCheckTimerRef.current) clearTimeout(dupCheckTimerRef.current);
    dupCheckTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          type: "caravan",
          makeName,
          modelName,
          year: String(year),
        });
        const res = await fetch(`/api/submissions/check-duplicate?${params}`);
        if (!res.ok) return;
        const data = await res.json() as { hasDuplicate: boolean; matches: DuplicateMatch[] };
        setDupWarning(data.hasDuplicate ? data.matches : null);
        if (!data.hasDuplicate) setDupSuspected(false);
      } catch {
        // Non-fatal
      }
    }, 600);

    return () => {
      if (dupCheckTimerRef.current) clearTimeout(dupCheckTimerRef.current);
    };
  }, [form.newMakeName, form.newModelName, form.year]);

  const field = (key: keyof FormValues) => ({
    value: form[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const handlePhotoSelect = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const processed = await processPhoto(file);
      setPlatePhotoFile(processed.file);
      setPlatePreview(processed.previewUrl);
    } catch {
      setError("Could not process photo.");
    } finally {
      setUploading(false);
    }
  }, []);

  const handlePhotoUpload = useCallback(async () => {
    if (!platePhotoFile) {
      setStep("form");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadPhoto(platePhotoFile);
      setPlatePhotoKey(result.key);
      setPlatePhotoUrl(result.url);
      setStep("form");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [platePhotoFile]);

  const handleSubmit = useCallback(
    async (duplicateOverride = false) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/submissions/caravans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            makeId: "new",
            newMakeName: form.newMakeName,
            modelId: "new",
            newModelName: form.newModelName,
            year: parseInt(form.year, 10),
            variantName: form.variantName,
            bodyType: form.bodyType,
            axleConfiguration: form.axleConfiguration || undefined,
            atmKg: parseInt(form.atmKg, 10),
            gtmKg: parseInt(form.gtmKg, 10),
            tareKg: parseInt(form.tareKg, 10),
            tbmKg: parseInt(form.tbmKg, 10),
            couplingToAxleMm: form.couplingToAxleMm
              ? parseFloat(form.couplingToAxleMm)
              : undefined,
            axleSpacingMm: form.axleSpacingMm
              ? parseFloat(form.axleSpacingMm)
              : undefined,
            bodyLengthMm: form.bodyLengthMm
              ? parseFloat(form.bodyLengthMm)
              : undefined,
            overallLengthMm: form.overallLengthMm
              ? parseFloat(form.overallLengthMm)
              : undefined,
            freshWaterLitres: form.freshWaterLitres
              ? parseFloat(form.freshWaterLitres)
              : undefined,
            greyWaterLitres: form.greyWaterLitres
              ? parseFloat(form.greyWaterLitres)
              : undefined,
            gasBottleConfig: form.gasBottleConfig || undefined,
            notes: form.notes || undefined,
            compliancePlatePhotoUrl: platePhotoUrl || undefined,
            compliancePlatePhotoKey: platePhotoKey || undefined,
            duplicateOverride,
            dupSuspected,
          }),
        });

        if (res.status === 409) {
          setStep("duplicate");
          return;
        }

        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          setError((b as { error?: string }).error ?? "Submission failed.");
          return;
        }

        setStep("success");
      } finally {
        setSubmitting(false);
      }
    },
    [form, platePhotoKey, platePhotoUrl]
  );

  // ── Success ──────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
          <svg
            className="h-6 w-6 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-gray-900">Caravan submitted for review</p>
          <p className="mt-1 text-sm text-gray-500">
            You can use this caravan in your own calculations now with an
            &ldquo;Awaiting review&rdquo; badge. It will appear in community
            search after a moderator approves it.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/account/submissions?submitted=1")}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            View my submissions
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark"
          >
            Back to calculator
          </button>
        </div>
      </div>
    );
  }

  // ── Duplicate ────────────────────────────────────────────────────────────

  if (step === "duplicate") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Possible duplicate found</h2>
        <p className="text-sm text-gray-600">
          We may already have this caravan variant in the catalogue or pending
          review. Is yours different?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="w-full rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Yes, mine is different — submit anyway"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Go back and search again
          </button>
        </div>
      </div>
    );
  }

  // ── Multi-step form ──────────────────────────────────────────────────────

  const showAxleSpacing = MULTI_AXLE.includes(form.axleConfiguration as AxleConfig);

  return (
    <div className="space-y-4">
      {/* Step: photo */}
      {step === "photo" && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <div>
            <h2 className="font-medium text-gray-900">
              Compliance plate photo (recommended)
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Caravan compliance plates vary widely in format and location. A
              photo helps our team verify ATM, GTM, and Tare — though OCR
              confidence is lower than for vehicles, so you&apos;ll still enter
              weights manually below.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Tip: the compliance plate is usually inside a locker, on the A-frame,
            or on the chassis rail near the coupling.
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhotoSelect(f);
            }}
          />

          {platePreview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={platePreview}
                alt="Compliance plate preview"
                className="h-48 w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setPlatePhotoFile(null);
                  setPlatePreview(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-600 hover:bg-white"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-tb-primary hover:text-tb-primary"
            >
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                />
              </svg>
              <span className="text-sm">Take or choose photo</span>
            </button>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Skip photo
            </button>
            <button
              type="button"
              onClick={handlePhotoUpload}
              disabled={uploading || !platePhotoFile}
              className="flex-1 rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload & continue"}
            </button>
          </div>
        </div>
      )}

      {/* Step: form */}
      {step === "form" && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          {platePreview && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={platePreview}
                alt=""
                className="h-10 w-16 rounded object-cover"
              />
              <span className="text-xs text-gray-500">
                Compliance plate photo attached
              </span>
            </div>
          )}

          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Make *
              </label>
              <input
                type="text"
                placeholder="e.g. Jayco"
                {...field("newMakeName")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Model *
              </label>
              <input
                type="text"
                placeholder="e.g. Journey"
                {...field("newModelName")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Year *
              </label>
              <input
                type="number"
                min="1950"
                max={new Date().getFullYear() + 2}
                {...field("year")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
              />
            </div>

            {/* Mid-flow duplicate warning */}
            {dupWarning && dupWarning.length > 0 && !dupSuspected && (
              <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                <p className="font-medium text-amber-800">We may already have this caravan</p>
                <ul className="mt-1 space-y-0.5">
                  {dupWarning.slice(0, 3).map((m) => (
                    <li key={m.id}>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-700 underline underline-offset-2"
                      >
                        {m.name}
                      </a>
                      {m.kind === "canonical" && (
                        <span className="ml-1 text-amber-600">(catalogue)</span>
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setDupSuspected(true)}
                  className="mt-2 text-amber-700 underline underline-offset-2"
                >
                  Mine is different
                </button>
              </div>
            )}
            {dupSuspected && (
              <div className="col-span-2 rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-700">
                Got it — your submission will be flagged for moderator review.
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Variant name *
              </label>
              <input
                type="text"
                placeholder="e.g. 17.58-3"
                {...field("variantName")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Body type *
              </label>
              <select
                {...field("bodyType")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
              >
                <option value="">Select…</option>
                {BODY_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Axle configuration *
              </label>
              <select
                {...field("axleConfiguration")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
              >
                <option value="">Select…</option>
                {AXLE_CONFIGS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Weights — required, from compliance plate */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">
              Weights (kg) * — from compliance plate
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">ATM *</label>
                <input
                  type="number"
                  min="100"
                  max="20000"
                  placeholder="e.g. 2800"
                  {...field("atmKg")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">GTM *</label>
                <input
                  type="number"
                  min="100"
                  max="20000"
                  placeholder="e.g. 2500"
                  {...field("gtmKg")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Tare *</label>
                <input
                  type="number"
                  min="100"
                  max="20000"
                  placeholder="e.g. 1800"
                  {...field("tareKg")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">TBM *</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  placeholder="e.g. 160"
                  {...field("tbmKg")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Geometry */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">
              Geometry — from specs sheet or measuring
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Coupling to axle (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 4200"
                  {...field("couplingToAxleMm")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
              {showAxleSpacing && (
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Axle spacing (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1000"
                    {...field("axleSpacingMm")}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Body length (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 5800"
                  {...field("bodyLengthMm")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Overall length (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 7500"
                  {...field("overallLengthMm")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Tanks & gas */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">
              Tanks &amp; gas
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Fresh water (L)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  placeholder="e.g. 95"
                  {...field("freshWaterLitres")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Grey water (L)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  placeholder="e.g. 75"
                  {...field("greyWaterLitres")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-gray-500">
                  Gas bottle config
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 × 9 kg"
                  {...field("gasBottleConfig")}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any other information…"
              {...field("notes")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("photo")}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("confirm")}
              disabled={!isFormValid(form)}
              className="flex-1 rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark disabled:opacity-50"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Step: confirm */}
      {step === "confirm" && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
            <p className="font-medium text-gray-800">
              {form.newMakeName} {form.newModelName} {form.variantName}
            </p>
            <p className="text-gray-500">
              {form.year} · {form.bodyType} ·{" "}
              {AXLE_CONFIGS.find((a) => a.value === form.axleConfiguration)?.label}
            </p>
            <p className="text-xs text-gray-500">
              ATM: {parseInt(form.atmKg, 10).toLocaleString()} kg · GTM:{" "}
              {parseInt(form.gtmKg, 10).toLocaleString()} kg · Tare:{" "}
              {parseInt(form.tareKg, 10).toLocaleString()} kg · TBM:{" "}
              {parseInt(form.tbmKg, 10).toLocaleString()} kg
            </p>
            {platePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={platePreview}
                alt="Plate"
                className="mt-2 h-20 w-full rounded object-cover"
              />
            )}
          </div>

          <p className="text-xs text-gray-500">
            This caravan will be immediately available in your own calculations
            with an &ldquo;Awaiting review&rdquo; badge. It won&apos;t appear in
            other users&apos; searches until approved.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="flex-1 rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit caravan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
