import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: {
    template: '%s | TravellingBuddy Accessories',
    default: 'Accessories | TravellingBuddy',
  },
  description: 'Browse accessories for your vehicle or caravan.',
};

export default function AccessoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-tb-neutral-200 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="text-tb-primary text-lg font-bold">
            TravellingBuddy
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <Link href="/catalogue/vehicles" className="hover:text-tb-primary">
              Vehicles
            </Link>
            <Link href="/catalogue/caravans" className="hover:text-tb-primary">
              Caravans
            </Link>
            <Link
              href="/accessories"
              className="text-tb-primary hover:text-tb-primary-light"
            >
              Accessories
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-tb-neutral-200 bg-tb-neutral-50 border-t py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} TravellingBuddy
      </footer>
    </div>
  );
}
