'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    key: 'submissions',
    label: 'Submission Stats',
    href: '/admin/analytics/submissions',
  },
  {
    key: 'calculator',
    label: 'Calculator Usage',
    href: '/admin/analytics/calculator',
  },
  { key: 'seo', label: 'Search & SEO', href: '/admin/analytics/seo' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AnalyticsTabs({ active }: { active?: TabKey }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex gap-6">
        {TABS.map((tab) => {
          const isActive = active
            ? active === tab.key
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={[
                'border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
