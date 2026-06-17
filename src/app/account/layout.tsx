'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

const tabs = [
  { label: 'My Setups', href: '/account/setups' },
  { label: 'Submissions', href: '/account/submissions' },
  { label: 'Settings', href: '/account/settings' },
] as const;

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === 'ADMIN' || role === 'MODERATOR';

  // Admins/moderators get a tab through to the admin dashboard.
  const navTabs = isAdmin
    ? [...tabs, { label: 'Admin', href: '/admin' } as const]
    : tabs;

  return (
    <div className="bg-tb-neutral-50 min-h-screen">
      <header className="border-tb-neutral-200 border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="text-tb-primary text-sm font-semibold hover:underline"
          >
            TravellingBuddy
          </Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-6 px-4">
          {navTabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-tb-primary text-tb-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
