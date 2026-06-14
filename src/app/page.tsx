import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getAllGuides } from '@/lib/content/guides';

export const revalidate = 86400;

// ── Topographic contour motif (inline SVG, no image weight) ──────────────────
function Topo({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 600"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <path
          key={i}
          d={`M -50 ${90 + i * 58} C 250 ${30 + i * 58}, 500 ${150 + i * 58}, 750 ${70 + i * 58} S 1300 ${120 + i * 58}, 1300 ${120 + i * 58}`}
          stroke="currentColor"
          strokeWidth={1.25}
          opacity={0.5}
        />
      ))}
    </svg>
  );
}

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 12 15.5 6 12 12 8.5 18Z" fill="currentColor" />
      </svg>
      <span className="font-display text-lg font-extrabold tracking-tight">
        TravellingBuddy
      </span>
    </span>
  );
}

// ── Sample verdict card (the hero's product proof) ───────────────────────────
function MetricBar({
  label,
  pct,
  tone,
  value,
}: {
  label: string;
  pct: number;
  tone: 'ok' | 'warn' | 'fail';
  value: string;
}) {
  const bar =
    tone === 'fail'
      ? 'bg-tb-danger'
      : tone === 'warn'
        ? 'bg-tb-warning'
        : 'bg-tb-success';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-[11px] text-gray-400 tabular-nums">{value}</span>
      </div>
      <div className="bg-tb-neutral-200 h-2 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${bar}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function VerdictCard() {
  return (
    <div className="tb-reveal shadow-tb-ink/40 w-full max-w-sm rounded-2xl border border-white/10 bg-white p-5 shadow-2xl [animation-delay:240ms]">
      <div className="bg-tb-danger-light mb-4 flex items-center gap-2 rounded-lg px-3 py-2">
        <span className="bg-tb-danger h-2.5 w-2.5 shrink-0 rounded-full" />
        <p className="text-tb-danger text-sm font-bold">
          Over rear axle by 90 kg
        </p>
      </div>
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
        HiLux SR5 + Jayco Silverline
      </p>
      <div className="space-y-3">
        <MetricBar label="GVM" pct={82} tone="ok" value="2,750 / 3,350" />
        <MetricBar
          label="Rear axle"
          pct={107}
          tone="fail"
          value="1,819 / 1,700"
        />
        <MetricBar label="Tow ball" pct={104} tone="warn" value="362 / 350" />
        <MetricBar label="Front axle" pct={65} tone="ok" value="942 / 1,450" />
      </div>
      <p className="mt-4 text-[11px] text-gray-400">
        Estimate only — confirm at a weighbridge.
      </p>
    </div>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────────
function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-tb-neutral-200 rounded-xl border bg-white p-5 transition-shadow hover:shadow-md">
      <div className="bg-tb-accent-light text-tb-accent-dark mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg">
        {icon}
      </div>
      <h3 className="font-display text-tb-ink text-base font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{children}</p>
    </div>
  );
}

const ICONS = {
  axle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="5" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="19" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 17h8M3 11h18l-2-4H5l-2 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  scale: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v18M5 7h14M7 7l-3 7h6l-3-7Zm10 0-3 7h6l-3-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  split: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="7" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="13" cy="17" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 13h14l3-6H6L3 13Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function Home() {
  const vehicles = await prisma.vehicleVariant.findMany({
    where: { status: 'CATALOGUE' },
    take: 6,
    orderBy: { createdAt: 'asc' },
    include: { model: { include: { make: true } } },
  });
  const guides = getAllGuides().slice(0, 4);

  const nav = [
    { label: 'Calculator', href: '/calculator' },
    { label: 'Vehicles', href: '/catalogue/vehicles' },
    { label: 'Caravans', href: '/catalogue/caravans' },
    { label: 'Guides', href: '/guides/gvm-explained' },
  ];

  return (
    <div className="text-tb-ink flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="bg-tb-ink/85 sticky top-0 z-30 border-b border-white/10 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-white">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/calculator"
            className="bg-tb-accent hover:bg-tb-accent-dark rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Check your rig
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="from-tb-ink to-tb-primary relative overflow-hidden bg-gradient-to-b text-white">
        <Topo className="text-tb-accent/25 pointer-events-none absolute inset-0 h-full w-full" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="tb-reveal text-tb-accent-light text-xs font-semibold tracking-[0.18em] uppercase">
              Australian towing compliance · Free
            </p>
            <h1 className="tb-reveal font-display mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight [animation-delay:80ms] sm:text-5xl lg:text-6xl">
              Is your rig
              <br />
              <span className="text-tb-accent-light">legal to tow?</span>
            </h1>
            <p className="tb-reveal mt-5 max-w-md text-lg leading-relaxed text-white/75 [animation-delay:160ms]">
              Most calculators check three numbers. We model the physics that
              actually fails real rigs — front &amp; rear axle loads and tow
              ball mass from where your weight sits.
            </p>
            <div className="tb-reveal mt-8 flex flex-wrap gap-3 [animation-delay:240ms]">
              <Link
                href="/calculator"
                className="bg-tb-accent shadow-tb-accent/30 hover:bg-tb-accent-dark rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Check your rig →
              </Link>
              <Link
                href="/catalogue/vehicles"
                className="rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Browse vehicles
              </Link>
            </div>
            <p className="tb-reveal mt-6 text-xs text-white/50 [animation-delay:320ms]">
              No login required · Physics-grade, not guesswork · 10 compliance
              metrics
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <VerdictCard />
          </div>
        </div>
      </section>

      {/* Differentiator */}
      <section className="bg-tb-sand">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-tb-ink text-3xl font-extrabold tracking-tight sm:text-4xl">
              Three numbers won&apos;t keep you legal.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              GVM, GCM and tow ball mass are the easy ones. The rig that fails
              at the weighbridge is usually over its rear axle, or carrying a
              tow ball load so light the front wheels go vague. We compute the
              whole picture.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={ICONS.axle} title="Front & rear axle loads">
              A vehicle can sit under GVM but well over its rear axle limit. We
              treat your rig as a beam on its axles and catch it.
            </Feature>
            <Feature icon={ICONS.scale} title="Tow ball mass from load">
              Tow ball mass isn&apos;t fixed — it shifts with where weight sits
              in the van. A rear toolbar can make it dangerously light.
            </Feature>
            <Feature icon={ICONS.split} title="Single vs dual axle">
              Single-axle vans load one axle pair with tighter tolerances; duals
              split it. We model each, not a one-size guess.
            </Feature>
            <Feature icon={ICONS.shield} title="Honest about data">
              Verified, estimated or community — we tell you the confidence
              behind every number, and never fake a result.
            </Feature>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <h2 className="font-display text-tb-ink text-3xl font-extrabold tracking-tight">
            From rego plate to verdict in a minute
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                n: '01',
                t: 'Pick your vehicle',
                d: 'Search 100+ makes and variants with verified GVM, GCM and axle limits — or submit yours.',
              },
              {
                n: '02',
                t: 'Add the load',
                d: 'Caravan, accessories, passengers, fuel, water and gear. Drag a slider and watch the axles shift.',
              },
              {
                n: '03',
                t: 'Get your verdict',
                d: 'Ten metrics, a side-on schematic, and plain-English fixes for anything red or amber.',
              },
            ].map((s) => (
              <div key={s.n}>
                <span className="font-display text-tb-accent/30 text-4xl font-extrabold">
                  {s.n}
                </span>
                <h3 className="font-display text-tb-ink mt-2 text-lg font-bold">
                  {s.t}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore / internal links */}
      <section className="border-tb-neutral-200 bg-tb-neutral-50 border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-tb-ink text-2xl font-extrabold tracking-tight">
              Start with a popular vehicle
            </h2>
            <Link
              href="/catalogue/vehicles"
              className="text-tb-primary-light text-sm font-semibold hover:underline"
            >
              See all vehicles →
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <Link
                key={v.id}
                href={`/vehicles/${v.model.make.slug}/${v.model.slug}/${v.slug}/`}
                className="group border-tb-neutral-200 hover:border-tb-primary-light flex items-center justify-between rounded-xl border bg-white px-4 py-3.5 transition-colors"
              >
                <span className="text-tb-ink text-sm font-semibold">
                  {v.model.make.name} {v.model.name}{' '}
                  <span className="font-normal text-gray-500">{v.name}</span>
                </span>
                <span className="text-tb-primary-light opacity-0 transition-opacity group-hover:opacity-100">
                  →
                </span>
              </Link>
            ))}
          </div>

          <h2 className="font-display text-tb-ink mt-12 text-2xl font-extrabold tracking-tight">
            Towing, explained
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {guides.map((g) => (
              <Link
                key={g.frontmatter.slug}
                href={`/guides/${g.frontmatter.slug}/`}
                className="border-tb-neutral-200 hover:border-tb-primary-light rounded-xl border bg-white px-4 py-4 transition-colors"
              >
                <p className="text-tb-ink text-sm font-bold">
                  {g.frontmatter.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                  {g.frontmatter.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-tb-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center sm:px-6">
          <h2 className="font-display max-w-xl text-3xl font-extrabold tracking-tight text-white">
            Know before you tow.
          </h2>
          <Link
            href="/calculator"
            className="bg-tb-accent shadow-tb-accent/30 hover:bg-tb-accent-dark rounded-xl px-7 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
          >
            Open the calculator →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-tb-ink text-white/70">
        <div className="mx-auto grid max-w-6xl gap-8 border-t border-white/10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="text-white">
              <Wordmark />
            </Link>
            <p className="mt-3 max-w-xs text-sm text-white/55">
              Australia&apos;s most comprehensive rig weight &amp; compliance
              calculator.
            </p>
          </div>
          {[
            {
              h: 'Calculate',
              links: [
                { label: 'Calculator', href: '/calculator' },
                { label: 'Vehicles', href: '/catalogue/vehicles' },
                { label: 'Caravans', href: '/catalogue/caravans' },
              ],
            },
            {
              h: 'Learn',
              links: [
                { label: 'What is GVM?', href: '/guides/gvm-explained/' },
                { label: 'What is ATM?', href: '/guides/what-is-atm/' },
                { label: 'Tow ball mass', href: '/guides/tow-ball-mass/' },
              ],
            },
            {
              h: 'Account',
              links: [
                { label: 'Sign in', href: '/auth/signin' },
                { label: 'Sign up', href: '/auth/signup' },
                { label: 'My setups', href: '/account/setups' },
              ],
            },
          ].map((col) => (
            <div key={col.h}>
              <p className="text-xs font-semibold tracking-wide text-white/40 uppercase">
                {col.h}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/65 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-white/40 sm:px-6">
          Estimates are indicative only and not a substitute for a weighbridge
          or a licensed engineer. © {new Date().getFullYear()} TravellingBuddy.
        </div>
      </footer>
    </div>
  );
}
