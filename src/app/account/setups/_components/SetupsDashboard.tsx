'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InlineNameEdit } from '@/components/setups/InlineNameEdit';

export interface SetupItem {
  id: string;
  name: string;
  tags: string[];
  vehicleVariant: {
    id: string;
    name: string;
    model: string;
    make: string;
  } | null;
  caravanVariant: {
    id: string;
    name: string;
    model: string;
    make: string;
  } | null;
  accessoryCount: number;
  customLoadCount: number;
  shareToken: string;
  createdAt: string;
  updatedAt: string;
}

type SortKey = 'name' | 'updatedAt';

function rigIdentifier(setup: SetupItem): string {
  const parts: string[] = [];
  if (setup.vehicleVariant) {
    parts.push(
      `${setup.vehicleVariant.make} ${setup.vehicleVariant.model} ${setup.vehicleVariant.name}`,
    );
  }
  if (setup.caravanVariant) {
    parts.push(
      `${setup.caravanVariant.make} ${setup.caravanVariant.model} ${setup.caravanVariant.name}`,
    );
  }
  return parts.join(' + ') || 'No rig selected';
}

export function SetupsDashboard({
  initialSetups,
}: {
  initialSetups: SetupItem[];
}) {
  const router = useRouter();
  const [setups, setSetups] = useState(initialSetups);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<SetupItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = useState('');

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    setups.forEach((s) => s.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [setups]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const filtered = useMemo(() => {
    let items = setups;

    if (selectedTags.size > 0) {
      items = items.filter((s) =>
        Array.from(selectedTags).every((t) => s.tags.includes(t)),
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)) ||
          rigIdentifier(s).toLowerCase().includes(q),
      );
    }

    const sorted = [...items].sort((a, b) => {
      if (sortKey === 'name') {
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      const da = new Date(a.updatedAt).getTime();
      const db = new Date(b.updatedAt).getTime();
      return sortAsc ? da - db : db - da;
    });

    return sorted;
  }, [setups, search, sortKey, sortAsc, selectedTags]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortAsc((prev) => !prev);
      } else {
        setSortKey(key);
        setSortAsc(key === 'name');
      }
    },
    [sortKey],
  );

  const handleDelete = useCallback(
    async (setup: SetupItem) => {
      const res = await fetch(`/api/setups/${setup.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSetups((prev) => prev.filter((s) => s.id !== setup.id));
        showToast('Setup deleted');
      }
      setDeleteTarget(null);
    },
    [showToast],
  );

  const handleDuplicate = useCallback(
    async (setup: SetupItem) => {
      const res = await fetch(`/api/setups/${setup.id}/duplicate`, {
        method: 'POST',
      });
      if (res.ok) {
        router.refresh();
        const data = await res.json();
        setSetups((prev) => [
          {
            id: data.id,
            name: data.name,
            tags: data.tags ?? [],
            vehicleVariant: data.vehicleVariant
              ? {
                  id: data.vehicleVariant.id,
                  name: data.vehicleVariant.name,
                  model: data.vehicleVariant.model.name,
                  make: data.vehicleVariant.model.make.name,
                }
              : null,
            caravanVariant: data.caravanVariant
              ? {
                  id: data.caravanVariant.id,
                  name: data.caravanVariant.name,
                  model: data.caravanVariant.model.name,
                  make: data.caravanVariant.model.make.name,
                }
              : null,
            accessoryCount: setup.accessoryCount,
            customLoadCount: setup.customLoadCount,
            shareToken: data.shareToken,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
          ...prev,
        ]);
        showToast('Setup duplicated');
      }
    },
    [router, showToast],
  );

  const handleShare = useCallback(
    async (setup: SetupItem) => {
      const url = `${window.location.origin}/setup/share/${setup.shareToken}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Share link copied to clipboard');
      } catch {
        showToast('Failed to copy share link');
      }
    },
    [showToast],
  );

  const handleAddTag = useCallback(
    async (setupId: string, tag: string) => {
      const setup = setups.find((s) => s.id === setupId);
      if (!setup || setup.tags.includes(tag)) return;
      const newTags = [...setup.tags, tag];
      const res = await fetch(`/api/setups/${setupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
      if (res.ok) {
        setSetups((prev) =>
          prev.map((s) => (s.id === setupId ? { ...s, tags: newTags } : s)),
        );
      }
      setTagInput(null);
      setTagInputValue('');
    },
    [setups],
  );

  const handleRemoveTag = useCallback(
    async (setupId: string, tag: string) => {
      const setup = setups.find((s) => s.id === setupId);
      if (!setup) return;
      const newTags = setup.tags.filter((t) => t !== tag);
      const res = await fetch(`/api/setups/${setupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      });
      if (res.ok) {
        setSetups((prev) =>
          prev.map((s) => (s.id === setupId ? { ...s, tags: newTags } : s)),
        );
      }
    },
    [setups],
  );

  if (setups.length === 0 && !search && selectedTags.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 text-5xl text-gray-300">&#9881;</div>
        <h2 className="mb-2 text-lg font-semibold text-gray-700">
          No setups yet
        </h2>
        <p className="mb-6 max-w-md text-sm text-gray-500">
          Use the calculator to configure your rig, then save it to access it
          here.
        </p>
        <Link
          href="/calculator"
          className="bg-tb-primary hover:bg-tb-primary-light rounded-md px-5 py-2.5 text-sm font-medium text-white"
        >
          Go to Calculator
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-900">My Setups</h2>
        <input
          type="search"
          placeholder="Search setups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-tb-neutral-200 focus:border-tb-primary focus:ring-tb-primary w-full rounded-md border px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none sm:w-64"
        />
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedTags.has(tag)
                  ? 'bg-tb-primary text-white'
                  : 'bg-tb-neutral-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-3 text-xs text-gray-500">
        <span>Sort by:</span>
        <button
          onClick={() => handleSort('name')}
          className={`font-medium ${sortKey === 'name' ? 'text-tb-primary' : 'hover:text-gray-700'}`}
        >
          Name {sortKey === 'name' && (sortAsc ? '\u2191' : '\u2193')}
        </button>
        <button
          onClick={() => handleSort('updatedAt')}
          className={`font-medium ${sortKey === 'updatedAt' ? 'text-tb-primary' : 'hover:text-gray-700'}`}
        >
          Last Edited{' '}
          {sortKey === 'updatedAt' && (sortAsc ? '\u2191' : '\u2193')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No setups match your search or filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((setup) => (
            <div
              key={setup.id}
              className="border-tb-neutral-200 rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <InlineNameEdit
                  setupId={setup.id}
                  initialName={setup.name}
                  onRename={(newName) =>
                    setSetups((prev) =>
                      prev.map((s) =>
                        s.id === setup.id ? { ...s, name: newName } : s,
                      ),
                    )
                  }
                />
              </div>

              <p className="mb-2 truncate text-xs text-gray-500">
                {rigIdentifier(setup)}
              </p>

              <div className="mb-3 text-xs text-gray-400">
                Last edited{' '}
                {new Date(setup.updatedAt).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>

              <div className="mb-3 flex flex-wrap gap-1">
                {setup.tags.map((tag) => (
                  <span
                    key={tag}
                    className="group bg-tb-primary-lighter text-tb-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(setup.id, tag)}
                      className="text-tb-primary/60 hover:text-tb-danger hidden group-hover:inline"
                      aria-label={`Remove tag ${tag}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
                {tagInput === setup.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (tagInputValue.trim()) {
                        handleAddTag(setup.id, tagInputValue.trim());
                      }
                    }}
                    className="inline-flex"
                  >
                    <input
                      autoFocus
                      value={tagInputValue}
                      onChange={(e) => setTagInputValue(e.target.value)}
                      onBlur={() => {
                        setTagInput(null);
                        setTagInputValue('');
                      }}
                      placeholder="tag"
                      className="border-tb-neutral-200 focus:border-tb-primary w-16 rounded-full border px-2 py-0.5 text-xs focus:outline-none"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => setTagInput(setup.id)}
                    className="hover:border-tb-primary hover:text-tb-primary rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400"
                  >
                    +
                  </button>
                )}
              </div>

              <div className="border-tb-neutral-200 flex flex-wrap gap-2 border-t pt-3">
                <Link
                  href={`/calculator?setupId=${setup.id}`}
                  className="bg-tb-primary hover:bg-tb-primary-light rounded-md px-3 py-1.5 text-xs font-medium text-white"
                >
                  Open
                </Link>
                <button
                  onClick={() => handleDuplicate(setup)}
                  className="border-tb-neutral-200 rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => handleShare(setup)}
                  className="border-tb-neutral-200 rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Share
                </button>
                <button
                  onClick={() => setDeleteTarget(setup)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-gray-900">
              Delete Setup
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Are you sure you want to delete &ldquo;{deleteTarget.name}
              &rdquo;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="border-tb-neutral-200 rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-4 bottom-4 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
