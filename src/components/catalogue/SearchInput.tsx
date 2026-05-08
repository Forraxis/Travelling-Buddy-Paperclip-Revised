"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useRef } from "react";

interface Props {
  placeholder?: string;
  paramName?: string;
}

export function SearchInput({ placeholder = "Search...", paramName = "q" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = searchParams.get(paramName) ?? "";

  function handleChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      params.delete("cursor");
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    }, 300);
  }

  return (
    <div className="relative">
      <input
        type="search"
        defaultValue={current}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-lg border border-tb-neutral-200 bg-white px-4 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-tb-primary-light focus:outline-none focus:ring-1 focus:ring-tb-primary-light"
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-tb-primary-light border-t-transparent" />
        </div>
      )}
    </div>
  );
}
