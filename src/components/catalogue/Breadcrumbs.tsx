import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-300">/</span>}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-tb-primary hover:underline"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-gray-900">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
