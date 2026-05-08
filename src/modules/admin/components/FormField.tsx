export function FormField({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const inputClassName =
  "block w-full rounded-lg border border-tb-neutral-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-tb-primary focus:outline-none focus:ring-1 focus:ring-tb-primary";

export const selectClassName =
  "block w-full rounded-lg border border-tb-neutral-200 px-3 py-2 text-sm text-gray-900 focus:border-tb-primary focus:outline-none focus:ring-1 focus:ring-tb-primary";
