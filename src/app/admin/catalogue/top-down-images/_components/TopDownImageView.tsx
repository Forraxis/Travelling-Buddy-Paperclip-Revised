'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from 'react';
import { setTopDownImage } from '../actions';

interface Item {
  id: string;
  name: string;
  brand: string;
  category: string;
  placementScope: string;
  topDownImageUrl: string | null;
}

export function TopDownImageView({ items }: { items: Item[] }) {
  const [rows, setRows] = useState(items);
  const [q, setQ] = useState('');
  const filtered = rows.filter((r) =>
    `${r.brand} ${r.name} ${r.category}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter accessories…"
        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      />
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {filtered.map((r) => (
          <Row
            key={r.id}
            item={r}
            onSaved={(url) =>
              setRows((rs) =>
                rs.map((x) =>
                  x.id === r.id ? { ...x, topDownImageUrl: url } : x,
                ),
              )
            }
          />
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-gray-400">
            No matches.
          </li>
        )}
      </ul>
    </div>
  );
}

function Row({
  item,
  onSaved,
}: {
  item: Item;
  onSaved: (url: string | null) => void;
}) {
  const [url, setUrl] = useState(item.topDownImageUrl ?? '');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const dirty = (url || '') !== (item.topDownImageUrl ?? '');

  function save() {
    setMsg(null);
    start(async () => {
      const res = await setTopDownImage(item.id, url || null);
      if (res.success) {
        onSaved(url || null);
        setMsg('Saved');
      } else setMsg(res.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
        {item.topDownImageUrl ? (
          <img
            src={item.topDownImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-gray-400">icon</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {item.brand} {item.name}
        </p>
        <p className="text-xs text-gray-400">
          {item.category} · {item.placementScope}
        </p>
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…/top-down.png"
        className="w-64 rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending || !dirty}
        className="bg-tb-primary hover:bg-tb-primary/90 rounded px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        {pending ? '…' : 'Save'}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </li>
  );
}
