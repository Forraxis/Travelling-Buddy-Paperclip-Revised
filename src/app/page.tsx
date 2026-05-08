import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('common');

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-tb-primary text-4xl font-bold tracking-tight">
          {t('appName')}
        </h1>
        <p className="mt-4 text-lg text-zinc-600">{t('tagline')}</p>
        <p className="mt-2 text-sm text-zinc-400">{t('comingSoon')}</p>
      </div>
    </main>
  );
}
