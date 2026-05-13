'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { processPhoto, uploadPhoto } from '@/lib/client/photo-processing';
import type { AccessoryItem } from './types';

const PENDING_SUBMISSION_KEY = 'tb:pending_accessory_submission';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (item: AccessoryItem) => void;
  prefillCategoryId?: string;
  prefillCategoryName?: string;
  context?: 'vehicle' | 'caravan';
}

interface FormState {
  categoryId: string;
  categoryName: string;
  brandId: string;
  newBrandName: string;
  modelName: string;
  weightKg: string;
  mountingLocation: string;
  isShared: boolean;
}

type Step = 'form' | 'photo' | 'confirm' | 'success' | 'duplicate';

export function AccessorySubmitModal({
  isOpen,
  onClose,
  onSubmitted,
  prefillCategoryId = '',
  prefillCategoryName = '',
}: Props) {
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<FormState>({
    categoryId: prefillCategoryId,
    categoryName: prefillCategoryName,
    brandId: '',
    newBrandName: '',
    modelName: '',
    weightKg: '',
    mountingLocation: '',
    isShared: true,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ existingId: string; existingName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore persisted anonymous submission state on open
  useEffect(() => {
    if (!isOpen || session) return;
    try {
      const raw = localStorage.getItem(PENDING_SUBMISSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<FormState>;
      setForm((f) => ({
        ...f,
        categoryId: saved.categoryId ?? prefillCategoryId,
        categoryName: saved.categoryName ?? prefillCategoryName,
        brandId: saved.brandId ?? '',
        newBrandName: saved.newBrandName ?? '',
        modelName: saved.modelName ?? '',
        weightKg: saved.weightKg ?? '',
        mountingLocation: saved.mountingLocation ?? '',
        isShared: saved.isShared ?? true,
      }));
    } catch {
      // ignore corrupted state
    }
  }, [isOpen, session, prefillCategoryId, prefillCategoryName]);

  const reset = useCallback(() => {
    setStep('form');
    setForm({
      categoryId: prefillCategoryId,
      categoryName: prefillCategoryName,
      brandId: '',
      newBrandName: '',
      modelName: '',
      weightKg: '',
      mountingLocation: '',
      isShared: true,
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoKey(null);
    setPhotoUrl(null);
    setError(null);
    setDuplicateInfo(null);
    try { localStorage.removeItem(PENDING_SUBMISSION_KEY); } catch { /* noop */ }
  }, [prefillCategoryId, prefillCategoryName]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handlePhotoSelect = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const processed = await processPhoto(file);
      setPhotoFile(processed.file);
      setPhotoPreview(processed.previewUrl);
    } catch (e) {
      setError('Could not process photo. Please try another.');
    } finally {
      setUploading(false);
    }
  }, []);

  const handlePhotoUpload = useCallback(async () => {
    if (!photoFile) {
      setStep('confirm');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadPhoto(photoFile);
      setPhotoKey(result.key);
      setPhotoUrl(result.url);
      setStep('confirm');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }, [photoFile]);

  const handleSubmit = useCallback(async (duplicateOverride = false) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/submissions/accessories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: form.categoryId || undefined,
          brandId: form.brandId || undefined,
          newBrandName: form.newBrandName || undefined,
          modelName: form.modelName,
          weightKg: parseFloat(form.weightKg),
          mountingLocation: form.mountingLocation || undefined,
          productPhotoUrl: photoUrl || undefined,
          productPhotoKey: photoKey || undefined,
          isShared: form.isShared,
          duplicateOverride,
        }),
      });

      if (res.status === 409) {
        const body = await res.json();
        setDuplicateInfo({ existingId: body.existingId, existingName: body.existingName });
        setStep('duplicate');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Submission failed.');
        return;
      }

      const result = await res.json() as {
        id: string;
        accessoryId: string;
        brandId: string;
        brandName: string;
      };

      // Build a local AccessoryItem so it's immediately usable
      const item: AccessoryItem = {
        fitmentId: `community:${result.accessoryId}`,
        accessoryId: result.accessoryId,
        name: form.modelName,
        brandId: result.brandId,
        brandName: result.brandName,
        categoryId: form.categoryId,
        categoryName: form.categoryName,
        mountingLocation: form.mountingLocation || 'unspecified',
        installedWeightKg: parseFloat(form.weightKg) || 0,
      };

      onSubmitted(item);
      setStep('success');
    } finally {
      setSubmitting(false);
    }
  }, [form, photoKey, photoUrl, onSubmitted]);

  if (!isOpen) return null;

  // Prompt anonymous users to sign up; persist filled-in state for resume after signup
  if (!session) {
    const handleSignUp = () => {
      try {
        localStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(form));
      } catch { /* quota exceeded — proceed without persisting */ }
      window.location.href = '/auth/signup';
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Sign in to submit</h3>
          <p className="mb-4 text-sm text-gray-600">
            Create a free account to submit accessories and help build the catalogue for the Australian touring community.
            {form.modelName && (
              <span className="mt-1 block text-gray-500">
                Your entry for <strong>{form.modelName}</strong> will be saved and ready when you return.
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={handleSignUp}
            className="block w-full rounded-lg bg-tb-primary px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-tb-primary-dark"
          >
            Create account
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="mt-3 block w-full text-center text-sm text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">
            {step === 'form' && 'Add missing accessory'}
            {step === 'photo' && 'Add a photo (optional)'}
            {step === 'confirm' && 'Confirm submission'}
            {step === 'success' && 'Accessory added!'}
            {step === 'duplicate' && 'Possible duplicate found'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {/* ── Step: form ── */}
          {step === 'form' && (
            <div className="space-y-3">
              {!form.categoryId && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Fridge, Canopy, Awning"
                    value={form.categoryName}
                    onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                  />
                </div>
              )}
              {form.categoryId && (
                <p className="text-sm text-gray-500">
                  Category: <span className="font-medium text-gray-700">{form.categoryName}</span>
                </p>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Brand</label>
                <input
                  type="text"
                  placeholder="Brand name (or new brand)"
                  value={form.newBrandName}
                  onChange={(e) => setForm((f) => ({ ...f, newBrandName: e.target.value, brandId: '' }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Model name *</label>
                <input
                  type="text"
                  placeholder="e.g. Engel MT45"
                  value={form.modelName}
                  onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Weight (kg) *
                  <span className="ml-1 text-xs font-normal text-gray-400">include mounting hardware</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0.0"
                  value={form.weightKg}
                  onChange={(e) => setForm((f) => ({ ...f, weightKg: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Mounting location</label>
                <input
                  type="text"
                  placeholder="e.g. Rear, Roof, Tray"
                  value={form.mountingLocation}
                  onChange={(e) => setForm((f) => ({ ...f, mountingLocation: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-tb-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isShared"
                  checked={form.isShared}
                  onChange={(e) => setForm((f) => ({ ...f, isShared: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-tb-primary"
                />
                <label htmlFor="isShared" className="text-sm text-gray-600">
                  Share with community (recommended)
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                disabled={!form.modelName || !form.weightKg}
                onClick={() => setStep('photo')}
                className="w-full rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next: Add photo
              </button>
            </div>
          )}

          {/* ── Step: photo ── */}
          {step === 'photo' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                A photo helps moderators verify your submission and makes it more useful to others.
              </p>

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

              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Preview" className="h-48 w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute right-2 top-2 rounded-full bg-white/80 p-1 text-gray-600 hover:bg-white"
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
                  className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-tb-primary hover:text-tb-primary"
                >
                  <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <span className="text-sm">Tap to take photo or choose file</span>
                </button>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handlePhotoUpload}
                  disabled={uploading}
                  className="flex-1 rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : photoFile ? 'Upload & continue' : 'Skip photo'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-800">
                  {form.newBrandName} {form.modelName}
                </p>
                <p className="text-gray-500">{form.weightKg} kg · {form.categoryName || 'accessory'}</p>
                {photoPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" className="mt-2 h-24 w-full rounded object-cover" />
                )}
              </div>

              <p className="text-xs text-gray-500">
                {form.isShared
                  ? 'This accessory will be immediately available in your calculation and queued for community moderation.'
                  : 'This accessory will be saved privately and available only in your calculations.'}
              </p>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('photo')}
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
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: duplicate ── */}
          {step === 'duplicate' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                We may already have <strong>{duplicateInfo?.existingName || 'this accessory'}</strong> in the catalogue.
              </p>
              <p className="text-sm text-gray-500">Is yours different from the existing entry?</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="w-full rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Yes, mine is different — submit anyway'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  No, use the existing one
                </button>
              </div>
            </div>
          )}

          {/* ── Step: success ── */}
          {step === 'success' && (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <svg className="h-6 w-6 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Accessory added to your calculation</p>
                <p className="mt-1 text-sm text-gray-500">
                  {form.isShared
                    ? "It's been queued for community review. Track its status in your account."
                    : "Saved as private — only visible in your calculations."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-lg bg-tb-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-tb-primary-dark"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
