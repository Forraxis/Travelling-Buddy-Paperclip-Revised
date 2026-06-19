'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inputClassName } from '@/modules/admin/components/FormField';

/**
 * Search box that drives the `?q=` param on the GVM-upgrades index. Empty search
 * falls back to "variants that already have upgrades"; a term searches all
 * catalogue variants so an admin can pick a base vehicle to attach a kit to.
 */
export function BaseVariantSearch({
  initialSearch,
}: {
  initialSearch: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialSearch);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(
      q
        ? `/admin/catalogue/gvm-upgrades?q=${encodeURIComponent(q)}`
        : '/admin/catalogue/gvm-upgrades',
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search base vehicle (make / model / variant)…"
        className={inputClassName}
      />
      <button
        type="submit"
        className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap text-white"
      >
        Search
      </button>
    </form>
  );
}
