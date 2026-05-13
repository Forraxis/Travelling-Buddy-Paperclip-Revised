"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/admin/components/Toast";
import { ConfirmDialog } from "@/modules/admin/components/ConfirmDialog";
import { FormField, inputClassName, selectClassName } from "@/modules/admin/components/FormField";
import {
  updateSponsorAction,
  deletePlacementAction,
} from "@/modules/sponsorship/actions/sponsor-admin.actions";
import type { SponsorDto, PlacementDto } from "@/modules/sponsorship/actions/sponsor-admin.actions";
import type { SponsorStatus } from "@prisma/client";

const STATUSES: SponsorStatus[] = ["ACTIVE", "PAUSED", "EXPIRED"];

const tierLabel: Record<string, string> = {
  FEATURED_FIT: "Featured Fit",
  CATEGORY_TOP: "Category Top",
  RECOMMENDATION_PINNED: "Recommendation Pinned",
};

const typeLabel: Record<string, string> = {
  ACCESSORY_FEATURED: "Accessory",
  CATEGORY_TOP: "Category",
  RECOMMENDATION_PINNED: "Recommendation",
  VEHICLE_TYPE_FEATURED: "Vehicle Type",
};

function scopeLabel(p: PlacementDto): string {
  if (p.accessoryName) return p.accessoryName;
  if (p.categoryName) return p.categoryName;
  if (p.vehicleBodyType) return p.vehicleBodyType.replace(/_/g, " ");
  return "Global";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function isActive(p: PlacementDto): boolean {
  const now = new Date();
  return new Date(p.startsAt) <= now && now <= new Date(p.endsAt);
}

export function SponsorDetail({
  sponsor,
  placements,
}: {
  sponsor: SponsorDto;
  placements: PlacementDto[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(sponsor.name);
  const [status, setStatus] = useState<SponsorStatus>(sponsor.status);
  const [contactName, setContactName] = useState(sponsor.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(sponsor.contactEmail ?? "");
  const [billingReference, setBillingReference] = useState(sponsor.billingReference ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<PlacementDto | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      e.contactEmail = "Invalid email";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    startTransition(async () => {
      const result = await updateSponsorAction(sponsor.id, {
        name: name.trim(),
        status,
        contactName: contactName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        billingReference: billingReference.trim() || null,
      });
      if (result.success) {
        toast("Sponsor updated");
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });
  }

  async function handleDeletePlacement() {
    if (!deleteTarget) return;
    const result = await deletePlacementAction(deleteTarget.id);
    if (result.success) {
      toast("Placement deleted");
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="space-y-8">
      {/* Edit form */}
      <div className="max-w-xl rounded-lg border border-tb-neutral-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Sponsor Details</h2>

        <FormField label="Name" name="name" error={errors.name}>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClassName}
          />
        </FormField>

        <FormField label="Status" name="status">
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SponsorStatus)}
            className={selectClassName}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Contact Name" name="contactName">
          <input
            id="contactName"
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className={inputClassName}
          />
        </FormField>

        <FormField label="Contact Email" name="contactEmail" error={errors.contactEmail}>
          <input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputClassName}
          />
        </FormField>

        <FormField label="Billing Reference" name="billingReference">
          <input
            id="billingReference"
            type="text"
            value={billingReference}
            onChange={(e) => setBillingReference(e.target.value)}
            className={inputClassName}
          />
        </FormField>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Placement history */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Placement History</h2>
          <Link
            href={`/admin/sponsorship/${sponsor.id}/placements/new`}
            className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light"
          >
            + Add Placement
          </Link>
        </div>

        <div className="overflow-x-auto rounded-lg border border-tb-neutral-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-tb-neutral-200 bg-tb-neutral-50">
                <th className="px-4 py-3 font-medium text-gray-700">Type</th>
                <th className="px-4 py-3 font-medium text-gray-700">Scope</th>
                <th className="px-4 py-3 font-medium text-gray-700">Tier</th>
                <th className="px-4 py-3 font-medium text-gray-700">Date Range</th>
                <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 font-medium text-gray-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {placements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No placements yet.
                  </td>
                </tr>
              ) : (
                placements.map((p) => (
                  <tr key={p.id} className="border-b border-tb-neutral-200 last:border-0 hover:bg-tb-neutral-50">
                    <td className="px-4 py-3 text-gray-600">{typeLabel[p.placementType] ?? p.placementType}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{scopeLabel(p)}</td>
                    <td className="px-4 py-3 text-gray-600">{tierLabel[p.tier] ?? p.tier}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(p.startsAt)} – {formatDate(p.endsAt)}
                    </td>
                    <td className="px-4 py-3">
                      {isActive(p) ? (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Active</span>
                      ) : new Date(p.endsAt) < new Date() ? (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">Ended</span>
                      ) : (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">Upcoming</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="text-sm text-gray-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Placement"
        message={`Delete this ${deleteTarget ? tierLabel[deleteTarget.tier] : ""} placement? This cannot be undone.`}
        onConfirm={handleDeletePlacement}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Back link */}
      <div>
        <Link href="/admin/sponsorship" className="text-sm text-gray-500 hover:text-tb-primary">
          ← Back to Sponsors
        </Link>
      </div>

    </div>
  );
}
