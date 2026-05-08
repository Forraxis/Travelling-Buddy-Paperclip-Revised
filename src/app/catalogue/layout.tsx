import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    template: "%s | TravellingBuddy Catalogue",
    default: "Catalogue | TravellingBuddy",
  },
  description: "Browse vehicles and caravans in the TravellingBuddy catalogue.",
};

export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-tb-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="text-lg font-bold text-tb-primary">
            TravellingBuddy
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <Link href="/catalogue/vehicles" className="hover:text-tb-primary">
              Vehicles
            </Link>
            <Link href="/catalogue/caravans" className="hover:text-tb-primary">
              Caravans
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-tb-neutral-200 bg-tb-neutral-50 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} TravellingBuddy
      </footer>
    </div>
  );
}
