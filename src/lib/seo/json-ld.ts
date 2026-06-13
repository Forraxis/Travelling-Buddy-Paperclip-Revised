const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travellingbuddy.com.au';

export interface BreadcrumbItem {
  name: string;
  /** Absolute path (leading slash), e.g. "/vehicles/toyota/hilux/". */
  path: string;
}

/**
 * Build a schema.org BreadcrumbList for a page. Mirrors the visible breadcrumb
 * trail so search engines can render breadcrumb rich results.
 */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  };
}
