"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/admin/components/Toast";
import { FormField, inputClassName, selectClassName } from "@/modules/admin/components/FormField";
import {
  createSponsorAction,
  updateSponsorAction,
} from "@/modules/sponsorship/actions/sponsor-admin.actions";
import type { SponsorDto } from "@/modules/sponsorship/actions/sponsor-admin.actions";
import type { SponsorStatus } from "@prisma/client";

const STATUSES: SponsorStatus[] = ["ACTIVE", "PAUSED", "EXPIRED"];

export function SponsorForm({
  sponsor,
  backHref,
}: {
  sponsor?: SponsorDto;
  backHref: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(sponsor?.name ?? "");
  const [status, setStatus] = useState<SponsorStatus>(sponsor?.status ?? "ACTIVE");
  const [contactName, setContactName] = useState(sponsor?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(sponsor?.contactEmail ?? "");
  const [billingReference, setBillingReference] = useState(sponsor?.billingReference ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      e.contactEmail = "Invalid email address";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    startTransition(async () => {
      const input = {
        name: name.trim(),
        status,
        contactName: contactName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        billingReference: billingReference.trim() || null,
      };

      const result = sponsor
        ? await updateSponsorAction(sponsor.id, input)
        : await createSponsorAction({ ...input, contactName: input.contactName ?? undefined, contactEmail: input.contactEmail ?? undefined, billingReference: input.billingReference ?? undefined });

      if (result.success) {
        toast(sponsor ? "Sponsor updated" : "Sponsor created");
        router.push(sponsor ? `/admin/sponsorship/${sponsor.id}` : "/admin/sponsorship");
        router.refresh();
      } else {
        toast(result.error, "error");
      }
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border border-tb-neutral-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Sponsor Details</h2>

        <FormField label="Name" name="name" error={errors.name}>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sponsor name"
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
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="rounded-lg border border-tb-neutral-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Contact & Billing</h2>

        <FormField label="Contact Name" name="contactName">
          <input
            id="contactName"
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact person"
            className={inputClassName}
          />
        </FormField>

        <FormField label="Contact Email" name="contactEmail" error={errors.contactEmail}>
          <input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="contact@example.com"
            className={inputClassName}
          />
        </FormField>

        <FormField label="Billing Reference" name="billingReference">
          <input
            id="billingReference"
            type="text"
            value={billingReference}
            onChange={(e) => setBillingReference(e.target.value)}
            placeholder="e.g. INV-2024-001"
            className={inputClassName}
          />
        </FormField>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light disabled:opacity-50"
        >
          {isPending ? "Saving..." : sponsor ? "Save Changes" : "Create Sponsor"}
        </button>
      </div>
    </div>
  );
}
