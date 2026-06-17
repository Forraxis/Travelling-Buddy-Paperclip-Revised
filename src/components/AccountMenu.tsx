'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

type Tone = 'light' | 'dark';

/**
 * Account control shown in site headers. Logged out → a "Sign in" button.
 * Logged in → an avatar that opens a dropdown of account links, plus an Admin
 * entry for ADMIN/MODERATOR and a Sign-out action. `tone` adapts the signed-out
 * button to dark (landing) vs light (app) headers; the avatar + dropdown panel
 * read well on both.
 */
export function AccountMenu({ tone = 'light' }: { tone?: Tone }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (status === 'loading') return null;

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className={
          tone === 'dark'
            ? 'rounded-lg border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10'
            : 'border-tb-neutral-300 text-tb-neutral-700 hover:bg-tb-neutral-100 rounded-lg border px-3 py-2 text-sm font-medium'
        }
      >
        Sign in
      </Link>
    );
  }

  const name = session.user.name ?? session.user.email ?? '';
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?';
  const role = session.user.role;
  const isAdmin = role === 'ADMIN' || role === 'MODERATOR';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={name}
        className="bg-tb-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white hover:opacity-90"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="ring-tb-neutral-200 absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1"
        >
          <div className="border-tb-neutral-100 border-b px-3 py-2">
            <p className="text-tb-ink truncate text-sm font-medium">
              {session.user.name ?? 'Signed in'}
            </p>
            {session.user.email && (
              <p className="truncate text-xs text-gray-500">
                {session.user.email}
              </p>
            )}
          </div>

          <MenuLink href="/account/setups" onSelect={() => setOpen(false)}>
            My Setups
          </MenuLink>
          <MenuLink href="/account/submissions" onSelect={() => setOpen(false)}>
            Submissions
          </MenuLink>
          <MenuLink href="/account/settings" onSelect={() => setOpen(false)}>
            Settings
          </MenuLink>

          {isAdmin && (
            <>
              <div className="border-tb-neutral-100 my-1 border-t" />
              <MenuLink href="/admin" onSelect={() => setOpen(false)}>
                Admin dashboard
              </MenuLink>
            </>
          )}

          <div className="border-tb-neutral-100 my-1 border-t" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: '/' });
            }}
            className="hover:bg-tb-neutral-50 block w-full px-3 py-2 text-left text-sm text-gray-700"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onSelect,
  children,
}: {
  href: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="hover:bg-tb-neutral-50 block px-3 py-2 text-sm text-gray-700"
    >
      {children}
    </Link>
  );
}
