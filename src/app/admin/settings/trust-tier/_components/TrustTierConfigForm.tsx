'use client';

import { useState, useTransition } from 'react';
import {
  FormField,
  inputClassName,
} from '@/modules/admin/components/FormField';
import { saveTrustTierConfigAction } from '@/modules/admin/actions/trust-tier-config.actions';
import type { TrustTierConfig } from '@/modules/admin/actions/trust-tier-config.actions';

interface Props {
  initial: TrustTierConfig;
}

const FIELD_META: {
  key: keyof TrustTierConfig;
  label: string;
  hint: string;
}[] = [
  {
    key: 'contributorApprovedCount',
    label: 'Approved submissions to reach Contributor',
    hint: 'Minimum approved submissions for NEW → BASIC tier promotion',
  },
  {
    key: 'trustedApprovedCount',
    label: 'Approved submissions to reach Trusted',
    hint: 'Minimum approved submissions for BASIC → TRUSTED tier promotion',
  },
  {
    key: 'trustedMinAccountAgeDays',
    label: 'Minimum account age (days) for Trusted',
    hint: 'Account must be at least this many days old for TRUSTED promotion',
  },
  {
    key: 'trustedRejectionWindowDays',
    label: 'Rejection-free window (days) for Trusted',
    hint: 'No rejections allowed in this many days before TRUSTED promotion',
  },
];

export function TrustTierConfigForm({ initial }: Props) {
  const [values, setValues] = useState<TrustTierConfig>(initial);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TrustTierConfig, string>>
  >({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChange(key: keyof TrustTierConfig, raw: string) {
    setSuccess(false);
    const num = parseInt(raw, 10);
    setValues((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    if (!isNaN(num) && num > 0) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof TrustTierConfig, string>> = {};
    for (const { key } of FIELD_META) {
      const v = values[key];
      if (!Number.isInteger(v) || v <= 0) {
        next[key] = 'Must be a positive integer';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setGlobalError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await saveTrustTierConfigAction(values);
      if (result.success) {
        setSuccess(true);
      } else {
        setGlobalError(result.error ?? 'Failed to save');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-6">
      {FIELD_META.map(({ key, label, hint }) => (
        <FormField key={key} label={label} name={key} error={errors[key]}>
          <input
            id={key}
            name={key}
            type="number"
            min={1}
            step={1}
            value={values[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            className={inputClassName}
          />
          <p className="text-tb-neutral-500 mt-1 text-xs">{hint}</p>
        </FormField>
      ))}

      {globalError && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {globalError}
        </p>
      )}

      {success && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">
          Settings saved. Changes take effect within 60 seconds.
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
