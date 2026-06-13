import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function Home() {
  const t = await getTranslations('common');

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-tb-primary text-4xl font-bold tracking-tight">
          {t('appName')}
        </h1>
        <p className="mt-4 text-lg text-zinc-600">{t('tagline')}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/calculator"
            className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors"
          >
            Open Calculator
          </Link>
          <Link
            href="/catalogue/vehicles"
            className="border-tb-primary text-tb-primary hover:bg-tb-primary-lighter rounded-lg border px-6 py-3 text-sm font-semibold transition-colors"
          >
            Browse Vehicles
          </Link>
          <Link
            href="/catalogue/caravans"
            className="border-tb-primary text-tb-primary hover:bg-tb-primary-lighter rounded-lg border px-6 py-3 text-sm font-semibold transition-colors"
          >
            Browse Caravans
          </Link>
        </div>
      </div>
    </main>
  );
}
