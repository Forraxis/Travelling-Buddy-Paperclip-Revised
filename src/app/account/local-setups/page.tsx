'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listLocalSetups,
  deleteLocalSetup,
  type LocalSetup,
} from '@/lib/local-setups';
import { stateToParams } from '@/modules/calculator/url-params';

export default function LocalSetupsPage() {
  const [setups, setSetups] = useState<LocalSetup[]>([]);

  useEffect(() => {
    setSetups(listLocalSetups());
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteLocalSetup(id);
    setSetups(listLocalSetups());
  }, []);

  function buildCalculatorUrl(setup: LocalSetup): string {
    const params = stateToParams(setup.calculatorState);
    return `/calculator?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-tb-neutral-900 mb-6 text-2xl font-bold">
        Saved Setups (This Device)
      </h1>

      {setups.length === 0 ? (
        <p className="text-tb-neutral-500 text-sm">
          No setups saved on this device yet. Use the calculator and tap
          &ldquo;Save Setup&rdquo; to store a configuration locally.
        </p>
      ) : (
        <ul className="divide-tb-neutral-200 border-tb-neutral-200 divide-y rounded-lg border bg-white">
          {setups.map((setup) => (
            <li
              key={setup.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-tb-neutral-900 truncate text-sm font-medium">
                  {setup.name}
                </p>
                <p className="text-tb-neutral-500 text-xs">
                  {setup.rigIdentifier} &middot; Last edited{' '}
                  {new Date(setup.lastEditedAt).toLocaleDateString('en-AU')}
                </p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Link
                  href={buildCalculatorUrl(setup)}
                  className="bg-tb-primary hover:bg-tb-primary/90 rounded-md px-3 py-1.5 text-xs font-medium text-white"
                >
                  Open
                </Link>
                <button
                  onClick={() => handleDelete(setup.id)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Link
          href="/auth/signup"
          className="text-tb-primary text-sm font-medium hover:underline"
        >
          Create an account to sync your setups across devices &rarr;
        </Link>
      </div>
    </div>
  );
}
