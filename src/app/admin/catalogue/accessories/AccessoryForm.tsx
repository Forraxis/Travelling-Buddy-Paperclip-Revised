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
  createAccessoryAction,
  updateAccessoryAction,
} from "@/modules/catalogue/actions/accessory-admin.actions";
import type { AccessoryDto } from "@/modules/catalogue/types/accessory.types";
import type { AccessoryBrandDto } from "@/modules/catalogue/types/accessory-brand.types";
import type { AccessoryCategoryDto } from "@/modules/catalogue/types/accessory-category.types";
import type { AccessoryStatus, Market } from "@prisma/client";

const MARKETS: { value: Market; label: string }[] = [
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "US", label: "United States" },
  { value: "EU", label: "Europe" },
  { value: "GB", label: "United Kingdom" },
];

interface AccessoryFormProps {
  accessory?: AccessoryDto;
  brands: AccessoryBrandDto[];
  categories: AccessoryCategoryDto[];
  backHref: string;
}

export function AccessoryForm({
  accessory,
  brands,
  categories,
  backHref,
}: AccessoryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!accessory;

  const [name, setName] = useState(accessory?.name ?? "");
  const [brandId, setBrandId] = useState(accessory?.brandId ?? brands[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(
    accessory?.categoryId ?? categories[0]?.id ?? ""
  );
  const [description, setDescription] = useState(accessory?.description ?? "");
  const [priceMin, setPriceMin] = useState(accessory?.priceMin?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(accessory?.priceMax?.toString() ?? "");
  const [currencyCode, setCurrencyCode] = useState(accessory?.currencyCode ?? "AUD");
  const [affiliateUrl, setAffiliateUrl] = useState(accessory?.affiliateUrl ?? "");
  const [status, setStatus] = useState<AccessoryStatus>(
    accessory?.status ?? "ACTIVE"
  );
  const [market, setMarket] = useState<Market>(accessory?.market ?? "AU");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!brandId) errs.brandId = "Brand is required";
    if (!categoryId) errs.categoryId = "Category is required";
    if (priceMin && isNaN(parseFloat(priceMin))) errs.priceMin = "Invalid price";
    if (priceMax && isNaN(parseFloat(priceMax))) errs.priceMax = "Invalid price";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const input = {
      brandId,
      categoryId,
      name: name.trim(),
      description: description.trim() || null,
      priceMin: priceMin ? parseFloat(priceMin) : null,
      priceMax: priceMax ? parseFloat(priceMax) : null,
      currencyCode,
      affiliateUrl: affiliateUrl.trim() || null,
      status,
      market,
    };

    const result = isEdit
      ? await updateAccessoryAction(accessory!.id, input)
      : await createAccessoryAction(input);

    setSubmitting(false);

    if (result.success) {
      toast(isEdit ? "Accessory updated" : "Accessory created");
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
          <FormField label="Name" name="name" error={errors.name}>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dual Battery System"
              className={inputClassName}
              autoFocus
            />
          </FormField>
          <FormField label="Status" name="status">
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AccessoryStatus)}
              className={selectClassName}
            >
              <option value="ACTIVE">Active</option>
              <option value="DISCONTINUED">Discontinued</option>
              <option value="PLACEHOLDER">Placeholder</option>
            </select>
          </FormField>
          <FormField label="Brand" name="brandId" error={errors.brandId}>
            <select
              id="brandId"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className={selectClassName}
            >
              <option value="">— Select a brand —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Category" name="categoryId" error={errors.categoryId}>
            <select
              id="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={selectClassName}
            >
              <option value="">— Select a category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
          <div className="sm:col-span-2">
            <FormField label="Description" name="description">
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description..."
                className={`${inputClassName} resize-none`}
              />
            </FormField>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-tb-neutral-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Pricing (optional)
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Currency" name="currencyCode">
            <input
              id="currencyCode"
              type="text"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="AUD"
              className={inputClassName}
            />
          </FormField>
          <FormField label="Price Min" name="priceMin" error={errors.priceMin}>
            <input
              id="priceMin"
              type="number"
              step="0.01"
              min="0"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="0.00"
              className={inputClassName}
            />
          </FormField>
          <FormField label="Price Max" name="priceMax" error={errors.priceMax}>
            <input
              id="priceMax"
              type="number"
              step="0.01"
              min="0"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="0.00"
              className={inputClassName}
            />
          </FormField>
          <div className="sm:col-span-3">
            <FormField label="Affiliate URL" name="affiliateUrl">
              <input
                id="affiliateUrl"
                type="url"
                value={affiliateUrl}
                onChange={(e) => setAffiliateUrl(e.target.value)}
                placeholder="https://..."
                className={inputClassName}
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
              ? "Update Accessory"
              : "Create Accessory"}
        </button>
      </div>
    </form>
  );
}
