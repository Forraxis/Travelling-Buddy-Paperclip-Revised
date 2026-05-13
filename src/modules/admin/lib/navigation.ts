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
    items: [
      { label: 'Moderation Queue', href: '/admin/moderation', icon: 'pending' },
      { label: 'Approved', href: '/admin/submissions/approved', icon: 'approved', disabled: true },
      { label: 'Rejected', href: '/admin/submissions/rejected', icon: 'rejected', disabled: true },
      { label: 'All Submissions', href: '/admin/submissions', icon: 'search', disabled: true },
    ],
  },
  {
    label: 'Sponsorship',
    icon: 'sponsorship',
    roles: ['ADMIN'],
    items: [
      { label: 'Sponsors', href: '/admin/sponsorship', icon: 'sponsor' },
      { label: 'Schedule', href: '/admin/sponsorship/schedule', icon: 'schedule' },
    ],
  },
  {
    label: 'Operations',
    icon: 'operations',
    items: [
      { label: 'Regulation Sets', href: '/admin/regulations', icon: 'regulation', roles: ['ADMIN'] },
      { label: 'Audit Log', href: '/admin/operations/audit', icon: 'audit' },
      { label: 'Sitemap Controls', href: '/admin/operations/sitemap', icon: 'sitemap', disabled: true, roles: ['ADMIN'] },
      { label: 'Feature Flags', href: '/admin/operations/flags', icon: 'flag', disabled: true, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Settings',
    icon: 'settings',
    roles: ['ADMIN'],
    items: [
      { label: 'Trust Tier Thresholds', href: '/admin/settings/trust-tier', icon: 'trust', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Analytics',
    icon: 'analytics',
    roles: ['ADMIN'],
    items: [
      { label: 'Submission Stats', href: '/admin/analytics/submissions', icon: 'stats' },
      { label: 'Calculator Usage', href: '/admin/analytics/calculator', icon: 'calculator' },
      { label: 'Search & SEO', href: '/admin/analytics/seo', icon: 'seo' },
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
