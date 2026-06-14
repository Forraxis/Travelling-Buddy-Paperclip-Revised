import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Archivo } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from '@/components/Providers';
import { AccountDeletedBanner } from '@/components/AccountDeletedBanner';
import { Suspense } from 'react';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

// Distinctive display face for headlines (body stays Inter).
const archivo = Archivo({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'TravellingBuddy — Australian Rig Weight & Compliance Calculator',
  description:
    'Check your GVM, GCM, axle loads, and tow ball mass. The most comprehensive rig compliance calculator for Australian road travellers.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrainsMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <Suspense>
            <AccountDeletedBanner />
          </Suspense>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
