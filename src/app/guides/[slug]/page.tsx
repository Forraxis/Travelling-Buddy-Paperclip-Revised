import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllGuideSlugs, getGuideBySlug } from '@/lib/content/guides';
import type { GuideCategory } from '@/lib/content/guides';

// Revalidate once per day
export const revalidate = 86400;

// ── Params ──────────────────────────────────────────────────────────────────

interface PageParams {
  slug: string;
}

interface Props {
  params: Promise<PageParams>;
}

// ── Static generation ────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<PageParams[]> {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};

  const { title, description } = guide.frontmatter;
  const canonical = `/guides/${slug}/`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
    },
  };
}

// ── Category label ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<GuideCategory, string> = {
  regulatory: 'Regulatory',
  'state-guidance': 'State Guidance',
  'accessory-category': 'Accessory Guide',
  decision: 'Decision Guide',
};

// ── MDX custom components ────────────────────────────────────────────────────

const mdxComponents = {
  Callout: ({
    type = 'info',
    children,
  }: {
    type?: 'info' | 'warning' | 'danger';
    children: React.ReactNode;
  }) => {
    const styles: Record<string, string> = {
      info: 'border-blue-400 bg-blue-50 text-blue-900',
      warning: 'border-amber-400 bg-amber-50 text-amber-900',
      danger: 'border-red-400 bg-red-50 text-red-900',
    };
    return (
      <aside
        role="note"
        className={`my-6 rounded-r border-l-4 px-4 py-3 text-sm ${styles[type] ?? styles.info}`}
      >
        {children}
      </aside>
    );
  },
  DisclaimerBox: ({ children }: { children: React.ReactNode }) => (
    <aside
      role="note"
      className="my-6 rounded border border-gray-300 bg-gray-50 px-4 py-3 text-xs text-gray-600"
    >
      {children}
    </aside>
  ),
};

// ── JSON-LD ───────────────────────────────────────────────────────────────────

function articleJsonLd(params: {
  title: string;
  description: string;
  slug: string;
  datePublished: string;
  dateModified: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: params.title,
    description: params.description,
    author: {
      '@type': 'Organization',
      name: 'TravellingBuddy',
    },
    publisher: {
      '@type': 'Organization',
      name: 'TravellingBuddy',
    },
    datePublished: params.datePublished,
    dateModified: params.dateModified,
    url: `/guides/${params.slug}/`,
  };
}

// ── Related links sidebar ─────────────────────────────────────────────────────

function relatedLinks(tags: string[]) {
  // Map known tags to relevant internal pages
  const links: { label: string; href: string }[] = [];
  if (tags.includes('gvm') || tags.includes('towing')) {
    links.push({ label: 'Calculate your tow capacity', href: '/calculator' });
    links.push({ label: 'Browse tow vehicles', href: '/vehicles' });
  }
  if (
    tags.includes('caravan') ||
    tags.includes('atm') ||
    tags.includes('tbm')
  ) {
    links.push({ label: 'Browse caravans', href: '/caravans' });
  }
  if (tags.includes('accessories')) {
    links.push({ label: 'Browse accessories', href: '/accessories' });
  }
  if (tags.includes('setup') || tags.includes('touring')) {
    links.push({ label: 'Browse touring setups', href: '/touring-setups' });
  }
  return links;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function GuideSlugPage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const { frontmatter, content } = guide;
  const related = relatedLinks(frontmatter.tags ?? []);
  const jsonLd = articleJsonLd({
    title: frontmatter.title,
    description: frontmatter.description,
    slug,
    datePublished: frontmatter.last_updated,
    dateModified: frontmatter.last_updated,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 lg:flex lg:gap-12">
        {/* Main article */}
        <article className="min-w-0 flex-1">
          <header className="mb-8">
            <div className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
              {CATEGORY_LABELS[frontmatter.category] ?? frontmatter.category}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              {frontmatter.title}
            </h1>
            <p className="mt-3 text-lg text-gray-600">
              {frontmatter.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {frontmatter.tags?.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-400">
              Last updated:{' '}
              <time dateTime={frontmatter.last_updated}>
                {new Date(frontmatter.last_updated).toLocaleDateString(
                  'en-AU',
                  {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  },
                )}
              </time>
            </p>
          </header>

          <div className="prose prose-gray max-w-none">
            <MDXRemote source={content} components={mdxComponents} />
          </div>

          {frontmatter.regulatory_references &&
            frontmatter.regulatory_references.length > 0 && (
              <section className="mt-10 border-t pt-6">
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
                  Regulatory References
                </h2>
                <ul className="space-y-1 text-sm text-gray-700">
                  {frontmatter.regulatory_references.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ul>
              </section>
            )}
        </article>

        {/* Related links sidebar */}
        {related.length > 0 && (
          <aside className="mt-10 w-full shrink-0 lg:mt-0 lg:w-64">
            <div className="rounded-lg border bg-gray-50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">
                Related Tools
              </h2>
              <ul className="space-y-2">
                {related.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
