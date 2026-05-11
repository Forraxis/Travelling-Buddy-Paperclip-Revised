"use client";

import { useEffect, useState, useCallback } from "react";

const PREF_KEYS = [
  {
    key: "submissionApproved",
    label: "Submission approved",
    description: "When your vehicle, caravan, or accessory submission is approved",
  },
  {
    key: "submissionRejected",
    label: "Submission rejected",
    description: "When your submission is rejected, including the reason",
  },
  {
    key: "trustTierPromoted",
    label: "Trust tier promoted",
    description: "When your trust tier increases based on contribution history",
  },
  {
    key: "savedSetupCatalogueUpdate",
    label: "Saved setup affected by catalogue update",
    description:
      "When a vehicle, caravan, or accessory in one of your saved setups is updated or removed",
  },
] as const;

type PrefKey = (typeof PREF_KEYS)[number]["key"];
type Preferences = Record<PrefKey, boolean>;

const DEFAULT_PREFS: Preferences = {
  submissionApproved: true,
  submissionRejected: true,
  trustTierPromoted: true,
  savedSetupCatalogueUpdate: true,
};

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/notification-preferences")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load preferences");
        return r.json();
      })
      .then((data: Partial<Preferences>) => {
        setPrefs({ ...DEFAULT_PREFS, ...data });
      })
      .catch(() => setError("Failed to load notification preferences"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(key: PrefKey) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/account/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setPrefs(prefs);
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/account/export", { method: "POST" });
      if (res.status === 429) {
        setExportError("Please wait a few minutes before exporting again.");
        return;
      }
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename=(.+)/);
      const filename = filenameMatch?.[1] ?? "travellingbuddy-export.json";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Settings</h1>

      <section>
        <h2 className="mb-1 text-base font-medium text-gray-900">
          Notification preferences
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Choose which in-app notifications you&apos;d like to receive.
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {saved && (
          <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
            Preferences saved.
          </div>
        )}

        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {PREF_KEYS.map(({ key, label, description }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between px-4 py-3"
            >
              <div className="pr-4">
                <div className="text-sm font-medium text-gray-900">
                  {label}
                </div>
                <div className="text-xs text-gray-500">{description}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                disabled={saving}
                onClick={() => handleToggle(key)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-tb-primary focus:ring-offset-2 ${
                  prefs[key] ? "bg-tb-primary" : "bg-gray-200"
                } ${saving ? "opacity-60" : ""}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                    prefs[key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-base font-medium text-gray-900">
          Data export
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Download a JSON file containing your profile, saved setups, and
          notification preferences.
        </p>

        {exportError && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {exportError}
          </div>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-md bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary/90 disabled:opacity-60"
        >
          {exporting ? "Exporting…" : "Export my data"}
        </button>
      </section>
    </div>
  );
}
