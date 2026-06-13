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
    <header className="border-tb-neutral-200 flex h-14 items-center gap-4 border-b bg-white px-4">
      <button
        onClick={onMenuToggle}
        className="hover:bg-tb-neutral-50 rounded-md p-1.5 text-gray-600 lg:hidden"
        aria-label="Toggle sidebar"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      <div className="relative max-w-md flex-1">
        <input
          type="text"
          placeholder="Search catalogue, submissions..."
          disabled
          className="border-tb-neutral-200 bg-tb-neutral-50 w-full rounded-lg border px-3 py-1.5 pl-8 text-sm text-gray-500 placeholder:text-gray-400"
        />
        <svg
          className="absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400"
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M13 13l4 4" />
        </svg>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="hover:bg-tb-neutral-50 relative rounded-md p-1.5 text-gray-500"
          aria-label="Notifications"
          disabled
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M10 2a5 5 0 00-5 5v3l-1.5 2h13L15 10V7a5 5 0 00-5-5zM8 17h4" />
          </svg>
        </button>

        <div className="flex items-center gap-2 rounded-lg px-2 py-1">
          <div className="bg-tb-primary flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white">
            {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm leading-none font-medium text-gray-700">
              {user.name ?? user.email}
            </p>
            <p className="text-xs text-gray-500">{user.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
