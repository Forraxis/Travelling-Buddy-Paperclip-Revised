import type { MetadataRoute } from 'next';

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://travellingbuddy.com.au';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Block admin, API, and authenticated areas. Note: /setup/share/* is
        // intentionally NOT disallowed — it carries an X-Robots-Tag: noindex
        // header (set in proxy.ts), which only works if crawlers may fetch it.
        disallow: ['/admin', '/api/', '/account', '/auth'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
