import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import {
  getAllStateGuidanceParams,
  getStateGuidance,
  getTopicSlugsForState,
  AU_STATES,
  STATE_NAMES,
  STATE_AUTHORITY,
  type AUStateCode,
} from '@/lib/content/state-guidance';
import { prisma } from '@/lib/db';
import { createRegulationService } from '@/modules/regulations/services/regulation.service';
import type { RegulationData } from '@/modules/regulations/types/regulation.types';

// ISR: revalidate once per day (content changes require deployment per spec 9.9)
export const revalidate = 86400;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageParams {
  stateCode: string;
  topic: string;
}

interface Props {
  params: Promise<PageParams>;
}

// ── Static generation ─────────────────────────────────────────────────────────

export async function generateStaticParams(): Promise<PageParams[]> {
  return getAllStateGuidanceParams();
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { stateCode, topic } = await params;
  const guide = getStateGuidance(stateCode, topic);
  if (!guide) return {};

  const { frontmatter } = guide;
  const stateName = STATE_NAMES[frontmatter.state];
  const title = `${stateName} ${frontmatter.title} — Towing Regulations Guide`;
  const canonical = `/${stateCode}/${topic}/`;

  return {
    title,
    description: frontmatter.description,
    alternates: { canonical },
    openGraph: {
      title,
      description: frontmatter.description,
      url: canonical,
      type: 'article',
    },
  };
}

// ── JSON-LD ───────────────────────────────────────────────────────────────────

function articleJsonLd(params: {
  title: string;
  description: string;
  stateCode: string;
  topic: string;
  lastReviewed: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: params.title,
    description: params.description,
    author: { '@type': 'Organization', name: 'TowingBuddy' },
    publisher: { '@type': 'Organization', name: 'TowingBuddy' },
    dateModified: params.lastReviewed,
    url: `/${params.stateCode}/${params.topic}/`,
  };
}

// ── State banner ──────────────────────────────────────────────────────────────

const STATE_FLAGS: Record<AUStateCode, string> = {
  nsw: '🏛️',
  vic: '🏙️',
  qld: '☀️',
  wa: '🌅',
  sa: '🍷',
  tas: '🏔️',
  nt: '🐊',
  act: '🏛️',
};

function StateBanner({ stateCode }: { stateCode: AUStateCode }) {
  const authority = STATE_AUTHORITY[stateCode];
  const stateName = STATE_NAMES[stateCode];
  const flag = STATE_FLAGS[stateCode];

  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          {flag}
        </span>
        <div>
          <p className="font-semibold text-blue-900">{stateName}</p>
          <p className="text-xs text-blue-700">
            State-specific towing regulations
          </p>
        </div>
      </div>
      <a
        href={authority.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        {authority.name} ↗
      </a>
    </div>
  );
}

// ── Regulation data tables ────────────────────────────────────────────────────

function RegulationDataSection({ data }: { data: RegulationData }) {
  return (
    <section className="mt-10 space-y-8 border-t pt-6">
      <h2 className="text-xl font-bold text-gray-900">Key Regulation Data</h2>

      {/* Towing speed limits */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Towing Speed Limits
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pr-4 pb-2 font-medium">Road type</th>
              <th className="pb-2 font-medium">Limit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4 text-gray-700">Urban</td>
              <td className="py-2 font-medium">
                {data.towingSpeedLimits.urban} km/h
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-gray-700">Rural</td>
              <td className="py-2 font-medium">
                {data.towingSpeedLimits.rural} km/h
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-gray-700">Highway</td>
              <td className="py-2 font-medium">
                {data.towingSpeedLimits.highway} km/h
              </td>
            </tr>
          </tbody>
        </table>
        {data.towingSpeedLimits.notes && (
          <p className="mt-2 text-xs text-gray-500">
            {data.towingSpeedLimits.notes}
          </p>
        )}
      </div>

      {/* GVM upgrade */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          GVM Upgrade
        </h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4 text-gray-700">Max upgrade</td>
              <td className="py-2 font-medium">
                {data.gvmUpgrade.maxUpgradePercent}%
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-gray-700">
                Engineer cert required
              </td>
              <td className="py-2 font-medium">
                {data.gvmUpgrade.requiresEngineerCert ? 'Yes' : 'No'}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-gray-700">
                Vehicle inspection required
              </td>
              <td className="py-2 font-medium">
                {data.gvmUpgrade.requiresVehicleInspection ? 'Yes' : 'No'}
              </td>
            </tr>
          </tbody>
        </table>
        {data.gvmUpgrade.notes && (
          <p className="mt-2 text-xs text-gray-500">{data.gvmUpgrade.notes}</p>
        )}
      </div>

      {/* Towing licence */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Towing Licence Thresholds
        </h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4 text-gray-700">
                Standard licence max GTM
              </td>
              <td className="py-2 font-medium">
                {data.towingLicence.standardLicenceMaxGtmKg.toLocaleString()} kg
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-gray-700">
                Heavy vehicle threshold
              </td>
              <td className="py-2 font-medium">
                {data.towingLicence.heavyVehicleLicenceThresholdKg.toLocaleString()}{' '}
                kg
              </td>
            </tr>
          </tbody>
        </table>
        {data.towingLicence.notes && (
          <p className="mt-2 text-xs text-gray-500">
            {data.towingLicence.notes}
          </p>
        )}
      </div>

      {/* Trailer brakes */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Trailer Brake Requirements
        </h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4 text-gray-700">
                Brakes required above GTM
              </td>
              <td className="py-2 font-medium">
                {data.trailerBrakes.brakesRequiredAboveGtmKg.toLocaleString()}{' '}
                kg
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-gray-700">
                Electric brakes required above GTM
              </td>
              <td className="py-2 font-medium">
                {data.trailerBrakes.electricBrakesRequiredAboveGtmKg.toLocaleString()}{' '}
                kg
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-gray-700">
                Breakaway system required
              </td>
              <td className="py-2 font-medium">
                {data.trailerBrakes.breakawaySystemRequired ? 'Yes' : 'No'}
              </td>
            </tr>
          </tbody>
        </table>
        {data.trailerBrakes.notes && (
          <p className="mt-2 text-xs text-gray-500">
            {data.trailerBrakes.notes}
          </p>
        )}
      </div>

      {/* Regulatory references from DB */}
      {data.regulatoryReferences.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            Official Sources
          </h3>
          <ul className="space-y-1 text-sm">
            {data.regulatoryReferences.map((ref) => (
              <li key={ref.url}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {ref.title} ↗
                </a>
                {ref.notes && (
                  <span className="ml-2 text-xs text-gray-500">
                    {ref.notes}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── Cross-state navigation ────────────────────────────────────────────────────

function CrossStateNav({
  currentState,
  topic,
}: {
  currentState: AUStateCode;
  topic: string;
}) {
  const others = AU_STATES.filter((s) => s !== currentState);
  return (
    <nav
      aria-label="Same topic in other states"
      className="mt-10 border-t pt-6"
    >
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
        See also: other states
      </h2>
      <ul className="flex flex-wrap gap-2">
        {others.map((state) => (
          <li key={state}>
            <a
              href={`/${state}/${topic}/`}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-700"
            >
              {STATE_NAMES[state]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Calculator CTA ────────────────────────────────────────────────────────────

function CalculatorCta({ stateCode }: { stateCode: AUStateCode }) {
  return (
    <aside className="mt-8 rounded-lg border border-green-200 bg-green-50 px-5 py-4">
      <p className="font-semibold text-green-900">Check your tow capacity</p>
      <p className="mt-1 text-sm text-green-800">
        Use our towing calculator with {STATE_NAMES[stateCode]} regulations
        pre-selected.
      </p>
      <a
        href={`/calculator?state=${stateCode}`}
        className="mt-3 inline-block rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
      >
        Open calculator →
      </a>
    </aside>
  );
}

// ── MDX components ────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StateGuidancePage({ params }: Props) {
  const { stateCode, topic } = await params;

  // Validate state code to avoid 404 storm from dynamic catch-all
  if (!AU_STATES.includes(stateCode as AUStateCode)) notFound();

  const guide = getStateGuidance(stateCode, topic);
  if (!guide) notFound();

  const { frontmatter, content } = guide;
  const stateName = STATE_NAMES[frontmatter.state];
  const title = `${stateName} ${frontmatter.title} — Towing Regulations Guide`;

  // Fetch live regulation data from DB (may be null if set not yet seeded)
  const regulationService = createRegulationService(prisma);
  const regulationResult = await regulationService.getSetByCode(
    frontmatter.regulation_set_code,
  );
  const regulationData = regulationResult?.currentData ?? null;

  const jsonLd = articleJsonLd({
    title,
    description: frontmatter.description,
    stateCode,
    topic,
    lastReviewed: frontmatter.last_reviewed,
  });

  // Determine which other states also have this topic for cross-state nav
  const statesWithTopic = AU_STATES.filter(
    (s) =>
      s !== (stateCode as AUStateCode) &&
      getTopicSlugsForState(s).includes(topic),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 lg:flex lg:gap-12">
        {/* Main article */}
        <article className="min-w-0 flex-1">
          <header className="mb-6">
            <div className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
              State Guidance · {stateName}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              {frontmatter.title}
            </h1>
            <p className="mt-3 text-lg text-gray-600">
              {frontmatter.description}
            </p>

            {/* Last reviewed — prominent for regulatory content */}
            <p className="mt-4 inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              <span>Last reviewed:</span>
              <time dateTime={frontmatter.last_reviewed}>
                {new Date(frontmatter.last_reviewed).toLocaleDateString(
                  'en-AU',
                  {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  },
                )}
              </time>
            </p>

            {frontmatter.tags && frontmatter.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {frontmatter.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <StateBanner stateCode={frontmatter.state} />

          <div className="prose prose-gray max-w-none">
            <MDXRemote source={content} components={mdxComponents} />
          </div>

          {/* Live regulation data from DB */}
          {regulationData && <RegulationDataSection data={regulationData} />}

          {/* Static regulatory references from frontmatter */}
          {frontmatter.regulatory_references &&
            frontmatter.regulatory_references.length > 0 && (
              <section className="mt-8 border-t pt-6">
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

          {/* Cross-state navigation — only show states that have the same topic */}
          {statesWithTopic.length > 0 && (
            <CrossStateNav currentState={frontmatter.state} topic={topic} />
          )}
        </article>

        {/* Sidebar */}
        <aside className="mt-10 w-full shrink-0 lg:mt-0 lg:w-72">
          <CalculatorCta stateCode={frontmatter.state} />

          <div className="mt-6 rounded-lg border bg-gray-50 p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">
              Browse by state
            </h2>
            <ul className="space-y-1.5">
              {AU_STATES.map((s) => (
                <li key={s}>
                  <a
                    href={`/${s}/${topic}/`}
                    className={`block rounded px-2 py-1 text-sm ${
                      s === stateCode
                        ? 'bg-blue-100 font-medium text-blue-800'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {STATE_NAMES[s]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
