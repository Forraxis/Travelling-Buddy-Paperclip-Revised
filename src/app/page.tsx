import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function Home() {
  const t = await getTranslations('common');

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-tb-primary">
          {t('appName')}
        </h1>
        <p className="mt-4 text-lg text-zinc-600">{t('tagline')}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/catalogue/vehicles"
            className="rounded-lg bg-tb-primary px-6 py-3 text-sm font-semibold text-white hover:bg-tb-primary-light transition-colors"
          >
            Browse Vehicles
          </Link>
          <Link
            href="/catalogue/caravans"
            className="rounded-lg border border-tb-primary px-6 py-3 text-sm font-semibold text-tb-primary hover:bg-tb-primary-lighter transition-colors"
          >
            Browse Caravans
          </Link>
        </div>

        <p className="mt-6 text-sm text-zinc-400">{t('comingSoon')}</p>
      </div>
    </main>
  );
}
