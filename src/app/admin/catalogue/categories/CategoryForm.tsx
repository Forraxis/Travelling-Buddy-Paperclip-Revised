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
  createCategoryAction,
  updateCategoryAction,
} from '@/modules/catalogue/actions/accessory-admin.actions';
import type { AccessoryCategoryDto } from '@/modules/catalogue/types/accessory-category.types';

interface CategoryFormProps {
  category?: AccessoryCategoryDto;
  parentOptions: { id: string; name: string }[];
  backHref: string;
}

export function CategoryForm({
  category,
  parentOptions,
  backHref,
}: CategoryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = !!category;

  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [parentId, setParentId] = useState(category?.parentId ?? '');
  const [displayOrder, setDisplayOrder] = useState(
    category?.displayOrder?.toString() ?? '0',
  );
  const [iconName, setIconName] = useState(category?.iconName ?? '');
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
      description: description.trim() || null,
      parentId: parentId || null,
      displayOrder: parseInt(displayOrder) || 0,
      iconName: iconName.trim() || null,
    };

    const result = isEdit
      ? await updateCategoryAction(category!.id, input)
      : await createCategoryAction(input);

    setSubmitting(false);

    if (result.success) {
      toast(isEdit ? 'Category updated' : 'Category created');
      router.push(backHref);
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  const availableParents = parentOptions.filter(
    (p) => !isEdit || p.id !== category?.id,
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border-tb-neutral-200 rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Identity
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Category Name" name="name" error={errors.name}>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lighting"
              className={inputClassName}
              autoFocus
            />
          </FormField>
          <FormField label="Parent Category" name="parentId">
            <select
              id="parentId"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={selectClassName}
            >
              <option value="">— None (top-level) —</option>
              {availableParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
          <FormField label="Display Order" name="displayOrder">
            <input
              id="displayOrder"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              min={0}
              className={inputClassName}
            />
          </FormField>
          <FormField label="Icon Name" name="iconName">
            <input
              id="iconName"
              type="text"
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              placeholder="e.g. lightning-bolt"
              className={inputClassName}
            />
          </FormField>
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
          {submitting
            ? 'Saving...'
            : isEdit
              ? 'Update Category'
              : 'Create Category'}
        </button>
      </div>
    </form>
  );
}
