"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listLocalSetups, deleteLocalSetup } from "@/lib/local-setups";
import type { LocalSetup } from "@/lib/local-setups";

export default function ClaimSetupsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") ?? "/account/setups";

  const [setups, setSetups] = useState<LocalSetup[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const local = listLocalSetups();
    setSetups(local);
    setChecked(new Set(local.map((s) => s.id)));
  }, []);

  if (setups.length === 0) {
    router.replace(redirectUrl);
    return null;
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleClaim() {
    const toUpload = setups.filter((s) => checked.has(s.id));
    if (toUpload.length === 0) {
      router.push(redirectUrl);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/setups/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setups: toUpload }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to save setups. Please try again.");
        setLoading(false);
        return;
      }

      for (const s of toUpload) {
        deleteLocalSetup(s.id);
      }

      router.push(redirectUrl);
    } catch {
      setError("Failed to save setups. Please try again.");
      setLoading(false);
    }
  }

  function handleSkip() {
    router.push(redirectUrl);
  }

  const checkedCount = checked.size;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Save your setups
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          You have {setups.length} setup{setups.length !== 1 ? "s" : ""} saved
          on this device. Add them to your account to access them anywhere.
        </p>

        <ul className="mb-6 divide-y divide-gray-100 rounded-lg border border-gray-200">
          {setups.map((setup) => (
            <li
              key={setup.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <input
                type="checkbox"
                id={`setup-${setup.id}`}
                checked={checked.has(setup.id)}
                onChange={() => toggle(setup.id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor={`setup-${setup.id}`}
                className="flex-1 cursor-pointer"
              >
                <span className="block text-sm font-medium text-gray-900">
                  {setup.name}
                </span>
                <span className="block text-xs text-gray-400">
                  {setup.rigIdentifier} &middot;{" "}
                  {new Date(setup.lastEditedAt).toLocaleDateString("en-AU")}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {error && (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClaim}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Saving…"
              : checkedCount === 0
                ? "Continue"
                : `Add ${checkedCount} to my account`}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
