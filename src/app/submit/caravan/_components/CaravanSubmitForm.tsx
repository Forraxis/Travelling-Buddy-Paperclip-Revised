"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { processPhoto, uploadPhoto } from "@/lib/client/photo-processing";

type Step = "form" | "photo" | "confirm" | "success" | "duplicate";

interface FormValues {
  newMakeName: string;
  newModelName: string;
  year: string;
  variantName: string;
  bodyType: string;
  axleConfiguration: string;
  couplingToAxleMm: string;
  bodyLengthMm: string;
  overallLengthMm: string;
  freshWaterLitres: string;
  greyWaterLitres: string;
  notes: string;
}

const BODY_TYPES = ["Caravan (pop-top)", "Caravan (full-height)", "Off-road caravan", "Camper trailer", "Fifth-wheeler", "Other"];
const AXLE_CONFIGS = ["Single axle", "Dual axle (close-coupled)", "Dual axle (spread)", "Triple axle"];

export function CaravanSubmitForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [platePhotoFile, setPlatePhotoFile] = useState<File | null>(null);
  const [platePreview, setPlatePreview] = useState<string | null>(null);
  const [platePhotoKey, setPlatePhotoKey] = useState<string | null>(null);
  const [platePhotoUrl, setPlatePhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormValues>({
    newMakeName: "", newModelName: "",
    year: String(new Date().getFullYear()),
    variantName: "", bodyType: "", axleConfiguration: "",
    couplingToAxleMm: "", bodyLengthMm: "", overallLengthMm: "",
    freshWaterLitres: "", greyWaterLitres: "", notes: "",
  });

  const field = (key: keyof FormValues) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const handlePhotoSelect = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const processed = await processPhoto(file);
      setPlatePhotoFile(processed.file);
      setPlatePreview(processed.previewUrl);
    } catch { setError("Could not process photo."); }
    finally { setUploading(false); }
  }, []);

  const handlePhotoUpload = useCallback(async () => {
    if (!platePhotoFile) { setStep("form"); return; }
    setUploading(true);
    try {
      const result = await uploadPhoto(platePhotoFile);
      setPlatePhotoKey(result.key); setPlatePhotoUrl(result.url); setStep("form");
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); }
  }, [platePhotoFile]);

  const handleSubmit = useCallback(async (duplicateOverride = false) => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/submissions/caravans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          makeId: "new", newMakeName: form.newMakeName,
          modelId: "new", newModelName: form.newModelName,
          year: parseInt(form.year, 10), variantName: form.variantName,
          bodyType: form.bodyType, axleConfiguration: form.axleConfiguration,
          couplingToAxleMm: form.couplingToAxleMm ? parseFloat(form.couplingToAxleMm) : undefined,
          bodyLengthMm: form.bodyLengthMm ? parseFloat(form.bodyLengthMm) : undefined,
          overallLengthMm: form.overallLengthMm ? parseFloat(form.overallLengthMm) : undefined,
          freshWaterLitres: form.freshWaterLitres ? parseFloat(form.freshWaterLitres) : undefined,
          greyWaterLitres: form.greyWaterLitres ? parseFloat(form.greyWaterLitres) : undefined,
          notes: form.notes || undefined,
          compliancePlatePhotoUrl: platePhotoUrl || undefined,
          compliancePlatePhotoKey: platePhotoKey || undefined,
          duplicateOverride,
        }),
      });
      if (res.status === 409) { setStep("duplicate"); return; }
      if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b.error ?? "Failed."); return; }
      setStep("success");
    } finally { setSubmitting(false); }
  }, [form, platePhotoKey, platePhotoUrl]);

  if (step === "success") return (
    <div className="rounded-xl bg-white p-6 shadow-sm text-center space-y-4">
      <p className="font-semibold text-gray-900">Caravan submitted for review</p>
      <p className="text-sm text-gray-500">Available in your calculations now. Appears in community search after approval.</p>
      <button type="button" onClick={() => router.back()} className="w-full rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white">Back to calculator</button>
    </div>
  );

  if (step === "duplicate") return (
    <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
      <p className="font-semibold text-gray-900">Possible duplicate found</p>
      <button type="button" onClick={() => handleSubmit(true)} disabled={submitting} className="w-full rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
        {submitting ? "Submitting…" : "Mine is different — submit anyway"}
      </button>
      <button type="button" onClick={() => router.back()} className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600">Go back</button>
    </div>
  );

  return (
    <div className="space-y-4">
      {step === "photo" && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <h2 className="font-medium text-gray-900">Compliance plate photo (optional)</h2>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }} />
          {platePreview
            ? <div className="relative"><img src={platePreview} alt="" className="h-48 w-full rounded-lg object-cover" /><button type="button" onClick={() => { setPlatePhotoFile(null); setPlatePreview(null); }} className="absolute right-2 top-2 bg-white/90 rounded-full p-1 text-xs">✕</button></div>
            : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-tb-primary hover:text-tb-primary">Take or choose photo</button>
          }
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep("form")} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600">Skip</button>
            <button type="button" onClick={handlePhotoUpload} disabled={uploading || !platePhotoFile} className="flex-1 rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {uploading ? "Uploading…" : "Upload & continue"}
            </button>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          {!platePreview && <button type="button" onClick={() => setStep("photo")} className="w-full rounded-lg border border-dashed border-gray-200 py-2 text-xs text-tb-primary">+ Add compliance plate photo</button>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="mb-1 block text-xs font-medium text-gray-600">Make *</label><input type="text" placeholder="e.g. Jayco" {...field("newMakeName")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
            <div className="col-span-2"><label className="mb-1 block text-xs font-medium text-gray-600">Model *</label><input type="text" placeholder="e.g. Journey" {...field("newModelName")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
            <div><label className="mb-1 block text-xs font-medium text-gray-600">Year *</label><input type="number" {...field("year")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
            <div><label className="mb-1 block text-xs font-medium text-gray-600">Variant *</label><input type="text" placeholder="e.g. 17.58-3" {...field("variantName")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
            <div><label className="mb-1 block text-xs font-medium text-gray-600">Body type *</label><select {...field("bodyType")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"><option value="">Select…</option>{BODY_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-gray-600">Axle config *</label><select {...field("axleConfiguration")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"><option value="">Select…</option>{AXLE_CONFIGS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
          </div>
          <details className="rounded-lg border border-gray-100 p-3"><summary className="cursor-pointer text-xs font-medium text-gray-500">Optional — geometry & tanks</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Coupling to axle (mm)</label><input type="number" {...field("couplingToAxleMm")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Body length (mm)</label><input type="number" {...field("bodyLengthMm")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Overall length (mm)</label><input type="number" {...field("overallLengthMm")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Fresh water (L)</label><input type="number" {...field("freshWaterLitres")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
              <div><label className="mb-1 block text-xs font-medium text-gray-600">Grey water (L)</label><input type="number" {...field("greyWaterLitres")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
            </div>
          </details>
          <div><label className="mb-1 block text-xs font-medium text-gray-600">Notes</label><textarea rows={2} {...field("notes")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none" /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={() => setStep("confirm")} disabled={!form.variantName || !form.bodyType || !form.axleConfiguration} className="w-full rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">Review submission</button>
        </div>
      )}

      {step === "confirm" && (
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <p className="font-medium text-gray-800">{form.newMakeName} {form.newModelName} {form.variantName}</p>
            <p className="text-gray-500">{form.year} · {form.bodyType} · {form.axleConfiguration}</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep("form")} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600">Back</button>
            <button type="button" onClick={() => handleSubmit(false)} disabled={submitting} className="flex-1 rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit caravan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
