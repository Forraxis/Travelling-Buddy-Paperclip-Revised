'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { adminNavSections } from '../lib/navigation';

function SectionIcon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, string> = {
    catalogue: '📦', submissions: '📋', sponsorship: '💰',
    operations: '⚙️', analytics: '📊',
  };
  return <span className={className}>{icons[name] ?? '📁'}</span>;
}

export function AdminSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    const match = adminNavSections.find((s) =>
      s.items.some((item) => pathname.startsWith(item.href))
    );
    return match?.label ?? 'Catalogue';
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
        className={`fixed top-0 left-0 z-40 flex h-full w-64 flex-col border-r border-tb-neutral-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-tb-neutral-200 px-4">
          <span className="text-lg font-semibold text-tb-primary">TB</span>
          <span className="text-sm text-tb-primary-light">Admin</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-tb-primary hover:bg-tb-neutral-50 lg:hidden"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {adminNavSections.map((section) => {
            const isExpanded = expandedSection === section.label;
            const sectionActive = section.items.some((item) =>
              pathname.startsWith(item.href)
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
                        : 'text-gray-700 hover:bg-tb-neutral-50'
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
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-tb-neutral-200 pl-3">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                      return item.disabled ? (
                        <span
                          key={item.href}
                          className="block rounded-md px-3 py-1.5 text-sm text-gray-400 cursor-not-allowed"
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
                              ? 'bg-tb-primary text-white font-medium'
                              : 'text-gray-600 hover:bg-tb-neutral-50 hover:text-gray-900'
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

        <div className="border-t border-tb-neutral-200 px-4 py-3">
          <Link
            href="/"
            className="block text-xs text-gray-500 hover:text-tb-primary"
          >
            ← Back to public site
          </Link>
        </div>
      </aside>
    </>
  );
}
