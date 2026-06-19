'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Expand-on-select: asks the app to fetch this skeleton's RVD now. The app does NOT
 * fetch ROVER directly — it triggers the n8n "rover-expand" webhook (VPN egress),
 * which fetches the VTADetails and POSTs it to /api/rover/ingest. See
 * src/app/api/rover/expand/route.ts.
 */
export function ExpandButton({
  approvalId,
  vtaNumber,
}: {
  approvalId: string;
  vtaNumber: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function expand() {
    setBusy(true);
    setMsg(null);
    try {
      // Trailing slash: the app uses trailingSlash:true; POST-after-308 can drop the body.
      const res = await fetch('/api/rover/expand/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, vtaNumber }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        alreadyExpanded?: boolean;
      };
      if (res.ok) {
        setMsg(data.alreadyExpanded ? 'already expanded' : 'requested ✓');
        router.refresh();
      } else {
        setMsg(
          data.error ? String(data.error).slice(0, 70) : `error ${res.status}`,
        );
      }
    } catch {
      setMsg('network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={expand}
      disabled={busy}
      title="Fetch this vehicle's RVD now (via n8n / VPN)"
      className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
    >
      {busy ? 'Expanding…' : (msg ?? 'Expand')}
    </button>
  );
}
