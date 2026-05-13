import type { AdminRole } from './auth';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
  /** If set, only these roles can see this item. Undefined means visible to all admin roles. */
  roles?: AdminRole[];
}

export interface NavSection {
  label: string;
  icon: string;
  items: NavItem[];
  disabled?: boolean;
  /** If set, only these roles can see this section. Undefined means visible to all admin roles. */
  roles?: AdminRole[];
}

export const adminNavSections: NavSection[] = [
  {
    label: 'Catalogue',
    icon: 'catalogue',
    items: [
      { label: 'Vehicles', href: '/admin/catalogue/vehicles', icon: 'vehicle' },
      { label: 'Caravans', href: '/admin/catalogue/caravans', icon: 'caravan' },
      { label: 'Accessories', href: '/admin/catalogue/accessories', icon: 'accessory' },
      { label: 'Brands', href: '/admin/catalogue/brands', icon: 'brand' },
      { label: 'Categories', href: '/admin/catalogue/categories', icon: 'category' },
    ],
  },
  {
    label: 'Submissions',
    icon: 'submissions',
    disabled: true,
    items: [
      { label: 'Pending Review', href: '/admin/submissions/pending', icon: 'pending', disabled: true },
      { label: 'Approved', href: '/admin/submissions/approved', icon: 'approved', disabled: true },
      { label: 'Rejected', href: '/admin/submissions/rejected', icon: 'rejected', disabled: true },
      { label: 'All Submissions', href: '/admin/submissions', icon: 'search', disabled: true },
    ],
  },
  {
    label: 'Sponsorship',
    icon: 'sponsorship',
    disabled: true,
    roles: ['ADMIN'],
    items: [
      { label: 'Sponsors', href: '/admin/sponsorship/sponsors', icon: 'sponsor', disabled: true },
      { label: 'Placements', href: '/admin/sponsorship/placements', icon: 'placement', disabled: true },
      { label: 'Schedule', href: '/admin/sponsorship/schedule', icon: 'schedule', disabled: true },
    ],
  },
  {
    label: 'Operations',
    icon: 'operations',
    disabled: true,
    items: [
      { label: 'Regulation Sets', href: '/admin/operations/regulations', icon: 'regulation', disabled: true, roles: ['ADMIN'] },
      { label: 'Audit Log', href: '/admin/operations/audit', icon: 'audit', disabled: true },
      { label: 'Sitemap Controls', href: '/admin/operations/sitemap', icon: 'sitemap', disabled: true, roles: ['ADMIN'] },
      { label: 'Feature Flags', href: '/admin/operations/flags', icon: 'flag', disabled: true, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Analytics',
    icon: 'analytics',
    disabled: true,
    roles: ['ADMIN'],
    items: [
      { label: 'Calculator Usage', href: '/admin/analytics/calculator', icon: 'calculator', disabled: true },
      { label: 'Submission Stats', href: '/admin/analytics/submissions', icon: 'stats', disabled: true },
      { label: 'Search & SEO', href: '/admin/analytics/seo', icon: 'seo', disabled: true },
    ],
  },
];

export function getVisibleSections(sections: NavSection[], role: AdminRole): NavSection[] {
  return sections
    .filter((s) => !s.roles || s.roles.includes(role))
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => !item.roles || item.roles.includes(role)),
    }));
}
