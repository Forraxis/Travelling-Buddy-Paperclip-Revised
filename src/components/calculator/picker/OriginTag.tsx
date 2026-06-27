import { formatOrigin } from '@/lib/catalogue/facet-tokens';

/**
 * Build-origin / country-of-manufacture pill (e.g. "🇪🇸 Spain"). Only the few
 * model-years built in >1 plant carry buildOrigin, so this renders nothing for
 * the overwhelming majority of variants.
 */
export function OriginTag({ code }: { code?: string | null }) {
  const label = formatOrigin(code);
  if (!label) return null;
  return (
    <span className="bg-tb-primary-lighter ml-1.5 inline-flex flex-none items-center rounded px-1.5 py-0.5 text-[11px] font-semibold text-blue-800">
      {label}
    </span>
  );
}
