"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listLocalSetups, deleteLocalSetup, type LocalSetup } from "@/lib/local-setups";
import { stateToParams } from "@/modules/calculator/url-params";

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
      <h1 className="mb-6 text-2xl font-bold text-tb-neutral-900">
        Saved Setups (This Device)
      </h1>

      {setups.length === 0 ? (
        <p className="text-sm text-tb-neutral-500">
          No setups saved on this device yet. Use the calculator and tap
          &ldquo;Save Setup&rdquo; to store a configuration locally.
        </p>
      ) : (
        <ul className="divide-y divide-tb-neutral-200 rounded-lg border border-tb-neutral-200 bg-white">
          {setups.map((setup) => (
            <li key={setup.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-tb-neutral-900">
                  {setup.name}
                </p>
                <p className="text-xs text-tb-neutral-500">
                  {setup.rigIdentifier} &middot; Last edited{" "}
                  {new Date(setup.lastEditedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <Link
                  href={buildCalculatorUrl(setup)}
                  className="rounded-md bg-tb-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-tb-primary/90"
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
          className="text-sm font-medium text-tb-primary hover:underline"
        >
          Create an account to sync your setups across devices &rarr;
        </Link>
      </div>
    </div>
  );
}
