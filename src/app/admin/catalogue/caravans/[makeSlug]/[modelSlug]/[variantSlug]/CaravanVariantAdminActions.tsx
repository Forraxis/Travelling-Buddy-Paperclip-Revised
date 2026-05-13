"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/modules/admin/components/Toast";
import {
  splitCaravanVariantRangeAction,
  advanceCaravanYearToAction,
  closeCaravanCurrentProductionAction,
} from "@/modules/catalogue/actions/caravan.actions";
import type { CaravanVariantDto } from "@/modules/catalogue/types/caravan.types";

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="rounded-xl border border-tb-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="w-[32rem] p-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {children}
      </div>
    </dialog>
  );
}

interface Props {
  variant: CaravanVariantDto;
  makeSlug: string;
  modelSlug: string;
}

export function CaravanVariantAdminActions({ variant, makeSlug, modelSlug }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [splitOpen, setSplitOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const [splitYearFrom, setSplitYearFrom] = useState("");
  const [splitYearTo, setSplitYearTo] = useState("");
  const [advanceYearTo, setAdvanceYearTo] = useState("");
  const [busy, setBusy] = useState(false);

  const currentYear = new Date().getFullYear();

  async function handleSplit() {
    const yf = parseInt(splitYearFrom);
    const yt = parseInt(splitYearTo || splitYearFrom);
    if (!yf || isNaN(yf)) {
      toast("Enter a valid anomaly year", "error");
      return;
    }
    setBusy(true);
    const result = await splitCaravanVariantRangeAction(variant.id, yf, yt);
    setBusy(false);
    if (result.success) {
      toast(`Split into ${result.data.created} variants`);
      setSplitOpen(false);
      router.push(`/admin/catalogue/caravans/${makeSlug}/${modelSlug}`);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  async function handleAdvance() {
    const yt = parseInt(advanceYearTo);
    if (!yt || isNaN(yt)) {
      toast("Enter a valid year", "error");
      return;
    }
    setBusy(true);
    const result = await advanceCaravanYearToAction(variant.id, yt);
    setBusy(false);
    if (result.success) {
      toast("Year to advanced and slug updated");
      setAdvanceOpen(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  async function handleClose() {
    setBusy(true);
    const result = await closeCaravanCurrentProductionAction(variant.id);
    setBusy(false);
    if (result.success) {
      toast(`Production closed at ${currentYear}`);
      setCloseOpen(false);
      router.refresh();
    } else {
      toast(result.error, "error");
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-700">
        Admin Actions
      </h3>
      <p className="mb-4 text-xs text-amber-600">
        These actions modify year ranges, regenerate slugs, and create audit records.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setSplitOpen(true)}
          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          Split this range
        </button>
        <button
          type="button"
          onClick={() => setAdvanceOpen(true)}
          className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          Advance year_to
        </button>
        {variant.isCurrentProduction && (
          <button
            type="button"
            onClick={() => setCloseOpen(true)}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Close current production
          </button>
        )}
      </div>

      {/* Split modal */}
      <Modal open={splitOpen} title="Split year range" onClose={() => setSplitOpen(false)}>
        <p className="mt-2 text-sm text-gray-600">
          Current range: <strong>{variant.yearFrom}–{variant.isCurrentProduction ? "current" : variant.yearTo}</strong>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Enter the anomaly year(s). New variants will be created for each segment and the source row will be deleted.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Anomaly year from
            </label>
            <input
              type="number"
              value={splitYearFrom}
              onChange={(e) => setSplitYearFrom(e.target.value)}
              min={variant.yearFrom}
              max={variant.yearTo}
              placeholder={String(variant.yearFrom)}
              className="w-full rounded-lg border border-tb-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tb-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Anomaly year to <span className="text-gray-400">(leave blank for single year)</span>
            </label>
            <input
              type="number"
              value={splitYearTo}
              onChange={(e) => setSplitYearTo(e.target.value)}
              min={variant.yearFrom}
              max={variant.yearTo}
              placeholder={splitYearFrom || String(variant.yearFrom)}
              className="w-full rounded-lg border border-tb-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tb-primary"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setSplitOpen(false)}
            className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSplit}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Splitting…" : "Split range"}
          </button>
        </div>
      </Modal>

      {/* Advance year_to modal */}
      <Modal open={advanceOpen} title="Advance year_to" onClose={() => setAdvanceOpen(false)}>
        <p className="mt-2 text-sm text-gray-600">
          Current range: <strong>{variant.yearFrom}–{variant.isCurrentProduction ? "current" : variant.yearTo}</strong>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Sets a new year_to, marks the variant as no longer current production, regenerates the slug, and creates a 301 redirect.
        </p>
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">New year_to</label>
          <input
            type="number"
            value={advanceYearTo}
            onChange={(e) => setAdvanceYearTo(e.target.value)}
            min={variant.yearTo + 1}
            max={currentYear + 5}
            placeholder={String(variant.yearTo + 1)}
            className="w-full rounded-lg border border-tb-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tb-primary"
          />
        </div>
        {advanceYearTo && !isNaN(parseInt(advanceYearTo)) && (
          <p className="mt-2 text-xs text-gray-500">
            New range will be: <strong>{variant.yearFrom}–{advanceYearTo}</strong>
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setAdvanceOpen(false)}
            className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleAdvance}
            className="rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white hover:bg-tb-primary-light disabled:opacity-50"
          >
            {busy ? "Saving…" : "Advance year_to"}
          </button>
        </div>
      </Modal>

      {/* Close production modal */}
      <Modal
        open={closeOpen}
        title="Close current production"
        onClose={() => setCloseOpen(false)}
      >
        <p className="mt-2 text-sm text-gray-600">
          Current range: <strong>{variant.yearFrom}–current</strong>
        </p>
        <p className="mt-3 text-sm text-gray-600">This will:</p>
        <ul className="mt-1 list-disc pl-5 text-sm text-gray-600 space-y-1">
          <li>Set <code>isCurrentProduction = false</code></li>
          <li>Lock <code>yearTo = {currentYear}</code></li>
          <li>Regenerate slug to <code>…{variant.yearFrom}-{currentYear}</code></li>
          <li>Create a 301 redirect from the old slug</li>
          <li>Write an audit log entry</li>
        </ul>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setCloseOpen(false)}
            className="rounded-lg border border-tb-neutral-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-tb-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Closing…" : "Close production"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
