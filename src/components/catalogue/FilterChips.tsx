"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterChipsProps {
  paramName: string;
  options: FilterOption[];
  label: string;
}

export function FilterChips({ paramName, options, label }: FilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get(paramName);

  function toggle(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (current === value) {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    params.delete("cursor");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">{label}:</span>
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-tb-primary text-white"
                : "border border-tb-neutral-200 bg-white text-gray-600 hover:border-tb-primary-light hover:text-tb-primary"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
