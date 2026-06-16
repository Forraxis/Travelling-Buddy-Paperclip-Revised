import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { LayoutEditor } from './LayoutEditor';

interface PageProps {
  params: Promise<{ vehicle: string }>;
  searchParams: Promise<{ c?: string; setupId?: string }>;
}

async function resolveVehicle(slug: string) {
  return prisma.vehicleVariant.findFirst({
    where: { slug, status: 'CATALOGUE' },
    select: {
      id: true,
      name: true,
      yearFrom: true,
      yearTo: true,
      model: {
        select: {
          name: true,
          bodyType: true,
          make: { select: { name: true } },
        },
      },
    },
  });
}

function rigName(v: NonNullable<Awaited<ReturnType<typeof resolveVehicle>>>) {
  return `${v.model.make.name} ${v.model.name} ${v.name}`.trim();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { vehicle } = await params;
  const v = await resolveVehicle(vehicle);
  if (!v) return { title: 'Load Layout Planner | TravellingBuddy' };
  const name = rigName(v);
  const title = `${name} Load Layout Planner — Weight Distribution Tool`;
  const description = `Plan where to mount your gear on a ${name}. Drag accessories into position and see live front/rear axle loads, left/right balance, and tow-ball mass. Free interactive weight-distribution planner.`;
  return {
    title,
    description,
    alternates: { canonical: `/layout/${vehicle}/` },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function LayoutPlannerPage({
  params,
  searchParams,
}: PageProps) {
  const { vehicle } = await params;
  const { c, setupId } = await searchParams;
  const v = await resolveVehicle(vehicle);
  if (!v) notFound();

  let caravanVariantId: string | null = null;
  if (c) {
    const cv = await prisma.caravanVariant.findFirst({
      where: { slug: c, status: 'CATALOGUE' },
      select: { id: true },
    });
    caravanVariantId = cv?.id ?? null;
  }

  // A few popular accessories for this rig — real content for SEO + an
  // affiliate-ready list under the editor.
  const popular = await prisma.accessoryFitment.findMany({
    where: { vehicleVariantId: v.id },
    take: 8,
    select: {
      mountingLocation: true,
      installedWeightKg: true,
      accessory: {
        select: { name: true, brand: { select: { name: true } } },
      },
    },
    orderBy: { installedWeightKg: 'desc' },
  });

  const name = rigName(v);

  return (
    <main className="min-h-screen bg-tb-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav className="mb-3 text-sm text-gray-500">
          <Link href="/" className="hover:text-tb-primary">
            Home
          </Link>{' '}
          /{' '}
          <Link href="/calculator/" className="hover:text-tb-primary">
            Calculator
          </Link>{' '}
          / <span className="text-gray-700">Layout planner</span>
        </nav>

        <header className="mb-5">
          <h1 className="font-display text-2xl font-bold text-tb-ink sm:text-3xl">
            {name} — Load Layout Planner
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Drag your accessories onto the {v.model.name} and see exactly what
            each placement does to your <strong>front and rear axle loads</strong>,{' '}
            <strong>left/right balance</strong>, and{' '}
            <strong>tow-ball mass</strong> — live, as you move things. Hitch a
            caravan to see how coupling up shifts weight off the front axle.
          </p>
        </header>

        <LayoutEditor
          vehicleVariantId={v.id}
          vehicleName={name}
          caravanVariantId={caravanVariantId}
          setupId={setupId ?? null}
        />

        <section className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-tb-ink">
              Popular accessories for the {v.model.name}
            </h2>
            {popular.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                {popular.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {p.accessory.brand.name} {p.accessory.name}
                    </span>
                    <span className="shrink-0 text-gray-400">
                      {Number(p.installedWeightKg)} kg
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">
                No catalogued accessories for this model yet — add your own custom
                loads in the planner above.
              </p>
            )}
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-tb-ink">
              How the planner works
            </h2>
            <dl className="mt-3 space-y-3 text-sm text-gray-700">
              <div>
                <dt className="font-semibold text-tb-ink">
                  Does where I mount things really matter?
                </dt>
                <dd className="mt-0.5 text-gray-600">
                  Yes. A bull bar ahead of the front axle loads the front; a rear
                  drawer system loads the rear and can push you over your rear
                  axle rating long before GVM. Position changes the numbers.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-tb-ink">
                  What does hitching a caravan do?
                </dt>
                <dd className="mt-0.5 text-gray-600">
                  The tow-ball download lifts weight off your front axle and adds
                  it to the rear. The planner shows the hitched vs unhitched
                  comparison so you can see it.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-tb-ink">
                  Is this a substitute for a weighbridge?
                </dt>
                <dd className="mt-0.5 text-gray-600">
                  No — it&rsquo;s a planning estimate to help you load smart.
                  Always confirm on a weighbridge.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
