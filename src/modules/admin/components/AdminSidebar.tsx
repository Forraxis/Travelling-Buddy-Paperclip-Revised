'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { adminNavSections, getVisibleSections } from '../lib/navigation';
import type { AdminRole } from '../lib/auth';

function SectionIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const icons: Record<string, string> = {
    catalogue: '📦',
    submissions: '📋',
    sponsorship: '💰',
    operations: '⚙️',
    analytics: '📊',
  };
  return <span className={className}>{icons[name] ?? '📁'}</span>;
}

export function AdminSidebar({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: AdminRole;
}) {
  const pathname = usePathname();
  const visibleSections = getVisibleSections(adminNavSections, role);

  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    const match = visibleSections.find((s) =>
      s.items.some((item) => pathname.startsWith(item.href)),
    );
    return match?.label ?? visibleSections[0]?.label ?? null;
  });

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`border-tb-neutral-200 fixed top-0 left-0 z-40 flex h-full w-64 flex-col border-r bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-tb-neutral-200 flex h-14 items-center gap-2 border-b px-4">
          <span className="text-tb-primary text-lg font-semibold">TB</span>
          <span className="text-tb-primary-light text-sm">Admin</span>
          <button
            onClick={onClose}
            className="text-tb-primary hover:bg-tb-neutral-50 ml-auto rounded-md p-1 lg:hidden"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {visibleSections.map((section) => {
            const isExpanded = expandedSection === section.label;
            const sectionActive = section.items.some((item) =>
              pathname.startsWith(item.href),
            );

            return (
              <div key={section.label} className="mb-1">
                <button
                  onClick={() =>
                    setExpandedSection(isExpanded ? null : section.label)
                  }
                  disabled={section.disabled}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    section.disabled
                      ? 'cursor-not-allowed text-gray-400'
                      : sectionActive
                        ? 'bg-tb-primary-lighter text-tb-primary'
                        : 'hover:bg-tb-neutral-50 text-gray-700'
                  }`}
                >
                  <SectionIcon name={section.icon} className="text-base" />
                  <span className="flex-1">{section.label}</span>
                  {!section.disabled && (
                    <span
                      className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      ▸
                    </span>
                  )}
                </button>

                {isExpanded && !section.disabled && (
                  <div className="border-tb-neutral-200 mt-1 ml-4 space-y-0.5 border-l pl-3">
                    {section.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + '/');
                      return item.disabled ? (
                        <span
                          key={item.href}
                          className="block cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-gray-400"
                        >
                          {item.label}
                        </span>
                      ) : (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-tb-primary font-medium text-white'
                              : 'hover:bg-tb-neutral-50 text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-tb-neutral-200 border-t px-4 py-3">
          <Link
            href="/"
            className="hover:text-tb-primary block text-xs text-gray-500"
          >
            ← Back to public site
          </Link>
        </div>
      </aside>
    </>
  );
}
