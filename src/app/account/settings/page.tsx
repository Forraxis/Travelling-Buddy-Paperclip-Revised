"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

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

  const { data: session } = useSession();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function openDeleteModal() {
    setDeleteStep(1);
    setConfirmEmail("");
    setDeleteError(null);
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setShowDeleteModal(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Deletion failed");
      }
      await signOut({ callbackUrl: "/?account_deleted=1" });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete account"
      );
      setDeleting(false);
    }
  }

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

      <section className="mt-16 border-t border-red-200 pt-8">
        <h2 className="mb-1 text-base font-medium text-red-700">
          Delete account
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Permanently delete your account and all associated data. This action
          cannot be undone after the 30-day grace period.
        </p>
        <button
          type="button"
          onClick={openDeleteModal}
          className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Delete my account
        </button>
      </section>

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            {deleteStep === 1 ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete your account?
                </h3>
                <p className="mt-3 text-sm text-gray-600">
                  This will immediately sign you out. After 30 days, the
                  following will be permanently deleted:
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
                  <li>Your personal data and profile information</li>
                  <li>All saved setups and configurations</li>
                  <li>
                    Submitted catalogue entities will be anonymised (kept for
                    community use)
                  </li>
                  <li>Audit log entries will be anonymised</li>
                </ul>
                <p className="mt-3 text-sm text-gray-500">
                  You can sign in within 30 days to cancel the deletion — but
                  this feature is not yet available.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm account deletion
                </h3>
                <p className="mt-3 text-sm text-gray-600">
                  Type your account email to confirm:{" "}
                  <strong className="font-medium">{session?.user?.email}</strong>
                </p>
                <input
                  type="email"
                  autoComplete="off"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-3 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                {deleteError && (
                  <p className="mt-2 text-sm text-red-600">{deleteError}</p>
                )}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(1)}
                    disabled={deleting}
                    className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={
                      deleting ||
                      confirmEmail.toLowerCase() !==
                        (session?.user?.email ?? "").toLowerCase()
                    }
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting
                      ? "Deleting…"
                      : "Permanently delete account"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
