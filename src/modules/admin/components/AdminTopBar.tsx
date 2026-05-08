'use client';

import type { AdminUser } from '../lib/auth';

export function AdminTopBar({
  user,
  onMenuToggle,
}: {
  user: AdminUser;
  onMenuToggle: () => void;
}) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-tb-neutral-200 bg-white px-4">
      <button
        onClick={onMenuToggle}
        className="rounded-md p-1.5 text-gray-600 hover:bg-tb-neutral-50 lg:hidden"
        aria-label="Toggle sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      <div className="relative flex-1 max-w-md">
        <input
          type="text"
          placeholder="Search catalogue, submissions..."
          disabled
          className="w-full rounded-lg border border-tb-neutral-200 bg-tb-neutral-50 px-3 py-1.5 pl-8 text-sm text-gray-500 placeholder:text-gray-400"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M13 13l4 4" />
        </svg>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative rounded-md p-1.5 text-gray-500 hover:bg-tb-neutral-50"
          aria-label="Notifications"
          disabled
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 2a5 5 0 00-5 5v3l-1.5 2h13L15 10V7a5 5 0 00-5-5zM8 17h4" />
          </svg>
        </button>

        <div className="flex items-center gap-2 rounded-lg px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-tb-primary text-xs font-medium text-white">
            {user.name.charAt(0)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-700 leading-none">{user.name}</p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
