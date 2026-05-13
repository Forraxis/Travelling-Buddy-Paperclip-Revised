"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { processPhoto, uploadPhoto } from "@/lib/client/photo-processing";

type Step = "photo" | "form" | "confirm" | "success" | "duplicate";

interface FormValues {
  makeId: string;
  newMakeName: string;
  modelId: string;
  newModelName: string;
  year: string;
  variantName: string;
  bodyType: string;
  drivetrain: string;
  transmission: string;
  fuelType: string;
  wheelbaseMm: string;
  totalLengthMm: string;
  fuelTankLitres: string;
  notes: string;
}

const BODY_TYPES = ["Dual-cab ute", "Wagon", "SUV", "Troopcarrier", "Van", "Coupe", "Sedan", "Other"];
const DRIVETRAINS = ["4WD", "AWD", "FWD", "RWD"];
const TRANSMISSIONS = ["Automatic", "Manual", "CVT"];
const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric", "LPG", "Other"];

export function VehicleSubmitForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("photo");
  const [platePhotoFile, setPlatePhotoFile] = useState<File | null>(null);
  const [platePreview, setPlatePreview] = useState<string | null>(null);
  const [platePhotoKey, setPlatePhotoKey] = useState<string | null>(null);
  const [platePhotoUrl, setPlatePhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ existingId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormValues>({
    makeId: "",
    newMakeName: "",
    modelId: "",
    newModelName: "",
    year: String(new Date().getFullYear()),
    variantName: "",
    bodyType: "",
    drivetrain: "",
    transmission: "",
    fuelType: "",
    wheelbaseMm: "",
    totalLengthMm: "",
    fuelTankLitres: "",
    notes: "",
  });

  const field = (key: keyof FormValues) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
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

  const handleSubmit = useCallback(async (duplicateOverride = false) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          makeId: form.makeId || "new",
          newMakeName: form.newMakeName || undefined,
          modelId: form.modelId || "new",
          newModelName: form.newModelName || undefined,
          year: parseInt(form.year, 10),
          variantName: form.variantName,
          bodyType: form.bodyType,
          drivetrain: form.drivetrain,
          transmission: form.transmission,
          fuelType: form.fuelType,
          wheelbaseMm: form.wheelbaseMm ? parseFloat(form.wheelbaseMm) : undefined,
          totalLengthMm: form.totalLengthMm ? parseFloat(form.totalLengthMm) : undefined,
          fuelTankLitres: form.fuelTankLitres ? parseFloat(form.fuelTankLitres) : undefined,
          notes: form.notes || undefined,
          compliancePlatePhotoUrl: platePhotoUrl || undefined,
          compliancePlatePhotoKey: platePhotoKey || undefined,
          duplicateOverride,
        }),
      });

      if (res.status === 409) {
        const body = await res.json();
        setDuplicateInfo({ existingId: body.existingId });
        setStep("duplicate");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Submission failed.");
        return;
      }

      setStep("success");
    } finally {
      setSubmitting(false);
    }
  }, [form, platePhotoKey, platePhotoUrl]);

  if (step === "success") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
          <svg className="h-6 w-6 text-green-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-gray-900">Vehicle submitted for review</p>
          <p className="mt-1 text-sm text-gray-500">
            You can use this vehicle in your own calculations now. It will appear in community search after a moderator approves it.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/account/submissions")}
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

  if (step === "duplicate") {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Possible duplicate found</h2>
        <p className="text-sm text-gray-600">
          We may already have this vehicle variant in the catalogue or pending review. Is yours different?
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

  return (
    <div className="space-y-4">
      {/* Step: photo */}
      {step === "photo" && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <div>
            <h2 className="font-medium text-gray-900">Compliance plate photo</h2>
            <p className="mt-1 text-sm text-gray-500">
              The compliance plate is usually on the driver-side door jamb or under the bonnet. It&apos;s the primary evidence for your submission.
            </p>
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
              <img src={platePreview} alt="Compliance plate preview" className="h-48 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => { setPlatePhotoFile(null); setPlatePreview(null); }}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-600 hover:bg-white"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <span className="text-sm">Take or choose compliance plate photo</span>
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
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          {platePreview && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={platePreview} alt="" className="h-10 w-16 rounded object-cover" />
              <span className="text-xs text-green-700">Compliance plate photo attached</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Make *</label>
              <input type="text" placeholder="e.g. Toyota" {...field("newMakeName")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Model *</label>
              <input type="text" placeholder="e.g. Hilux" {...field("newModelName")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Year *</label>
              <input type="number" min="1950" max={new Date().getFullYear() + 2} {...field("year")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Variant name *</label>
              <input type="text" placeholder="e.g. SR5 Dual Cab" {...field("variantName")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Body type *</label>
              <select {...field("bodyType")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none">
                <option value="">Select…</option>
                {BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Drivetrain *</label>
              <select {...field("drivetrain")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none">
                <option value="">Select…</option>
                {DRIVETRAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Transmission *</label>
              <select {...field("transmission")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none">
                <option value="">Select…</option>
                {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Fuel type *</label>
              <select {...field("fuelType")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none">
                <option value="">Select…</option>
                {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <details className="rounded-lg border border-gray-100 p-3">
            <summary className="cursor-pointer text-xs font-medium text-gray-500">Optional — dimensions & capacity</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Wheelbase (mm)</label>
                <input type="number" min="0" placeholder="2850" {...field("wheelbaseMm")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Total length (mm)</label>
                <input type="number" min="0" placeholder="5330" {...field("totalLengthMm")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Fuel tank (L)</label>
                <input type="number" min="0" step="0.5" placeholder="80" {...field("fuelTankLitres")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" />
              </div>
            </div>
          </details>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes (optional)</label>
            <textarea rows={2} placeholder="Any other information…" {...field("notes")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" />
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
              disabled={!form.variantName || !form.bodyType || !form.drivetrain || !form.transmission || !form.fuelType}
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
            <p className="font-medium text-gray-800">{form.newMakeName} {form.newModelName} {form.variantName}</p>
            <p className="text-gray-500">{form.year} · {form.bodyType} · {form.drivetrain} · {form.transmission} · {form.fuelType}</p>
            {platePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={platePreview} alt="Plate" className="mt-2 h-20 w-full rounded object-cover" />
            )}
          </div>
          <p className="text-xs text-gray-500">
            This vehicle will be immediately available in your own calculations while it awaits moderator approval. It won&apos;t appear in other users&apos; searches until approved.
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
              {submitting ? "Submitting…" : "Submit vehicle"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
