'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const segmentLabels: Record<string, string> = {
  admin: 'Admin',
  catalogue: 'Catalogue',
  vehicles: 'Vehicles',
  caravans: 'Caravans',
  accessories: 'Accessories',
  brands: 'Brands',
  categories: 'Categories',
  'mounting-locations': 'Mounting Locations',
  submissions: 'Submissions',
  sponsorship: 'Sponsorship',
  operations: 'Operations',
  analytics: 'Analytics',
};

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, i) => ({
    label: segmentLabels[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm text-gray-500"
    >
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-300">/</span>}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-gray-900">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-tb-primary">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
