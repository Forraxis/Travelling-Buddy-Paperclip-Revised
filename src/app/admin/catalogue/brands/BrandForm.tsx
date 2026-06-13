'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import {
  FormField,
  inputClassName,
  selectClassName,
} from '@/modules/admin/components/FormField';
import {
  createBrandAction,
  updateBrandAction,
} from '@/modules/catalogue/actions/accessory-admin.actions';
import type { AccessoryBrandDto } from '@/modules/catalogue/types/accessory-brand.types';
import type { BrandStatus } from '@prisma/client';

interface BrandFormProps {
  brand?: AccessoryBrandDto;
  backHref: string;
}

export function BrandForm({ brand, backHref }: BrandFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!brand;

  const [name, setName] = useState(brand?.name ?? '');
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(brand?.websiteUrl ?? '');
  const [status, setStatus] = useState<BrandStatus>(brand?.status ?? 'ACTIVE');
  const [isPartner, setIsPartner] = useState(brand?.isPartner ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const input = {
      name: name.trim(),
      logoUrl: logoUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      status,
      isPartner,
    };

    const result = isEdit
      ? await updateBrandAction(brand!.id, input)
      : await createBrandAction(input);

    setSubmitting(false);

    if (result.success) {
      toast(isEdit ? 'Brand updated' : 'Brand created');
      router.push(backHref);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border-tb-neutral-200 rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Identity
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Brand Name" name="name" error={errors.name}>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ARB"
              className={inputClassName}
              autoFocus
            />
          </FormField>
          <FormField label="Status" name="status">
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as BrandStatus)}
              className={selectClassName}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </FormField>
          <FormField label="Logo URL" name="logoUrl">
            <input
              id="logoUrl"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className={inputClassName}
            />
          </FormField>
          <FormField label="Website URL" name="websiteUrl">
            <input
              id="websiteUrl"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              className={inputClassName}
            />
          </FormField>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="isPartner"
              type="checkbox"
              checked={isPartner}
              onChange={(e) => setIsPartner(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isPartner" className="text-sm text-gray-700">
              Partner brand
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="border-tb-neutral-200 hover:bg-tb-neutral-50 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Saving...' : isEdit ? 'Update Brand' : 'Create Brand'}
        </button>
      </div>
    </form>
  );
}
