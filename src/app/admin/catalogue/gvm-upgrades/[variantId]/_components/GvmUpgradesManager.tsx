'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/modules/admin/components/Toast';
import { ConfirmDialog } from '@/modules/admin/components/ConfirmDialog';
import { deleteGvmUpgradeAction } from '@/modules/gvm-upgrade/actions/gvm-upgrade-admin.actions';
import {
  GVM_UPGRADE_PATHWAY_LABELS,
  type GvmUpgradeKitDto,
} from '@/modules/gvm-upgrade/types';
import { GvmUpgradeForm } from './GvmUpgradeForm';

interface FactoryLimits {
  gvmKg: number | null;
  gcmKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  maxTowingKg: number | null;
}

function kg(v: number | null): string {
  return v != null ? `${v} kg` : '—';
}

export function GvmUpgradesManager({
  variantId,
  factory,
  initialUpgrades,
}: {
  variantId: string;
  factory: FactoryLimits;
  initialUpgrades: GvmUpgradeKitDto[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<
    | { kind: 'list' }
    | { kind: 'create' }
    | { kind: 'edit'; upgrade: GvmUpgradeKitDto }
  >({ kind: 'list' });
  const [pendingDelete, setPendingDelete] = useState<GvmUpgradeKitDto | null>(
    null,
  );

  function refresh() {
    setMode({ kind: 'list' });
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const result = await deleteGvmUpgradeAction(id);
    if (result.success) {
      toast('Upgrade deleted');
      router.refresh();
    } else {
      toast(result.error, 'error');
    }
  }

  if (mode.kind === 'create') {
    return (
      <GvmUpgradeForm
        variantId={variantId}
        factory={factory}
        onDone={refresh}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }

  if (mode.kind === 'edit') {
    return (
      <GvmUpgradeForm
        variantId={variantId}
        factory={factory}
        upgrade={mode.upgrade}
        onDone={refresh}
        onCancel={() => setMode({ kind: 'list' })}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setMode({ kind: 'create' })}
          className="bg-tb-primary hover:bg-tb-primary-light rounded-lg px-4 py-2 text-sm font-medium text-white"
        >
          + Add GVM upgrade
        </button>
      </div>

      {initialUpgrades.length === 0 ? (
        <div className="border-tb-neutral-200 rounded-lg border bg-white px-4 py-8 text-center text-sm text-gray-500">
          No GVM upgrades attached to this variant yet.
        </div>
      ) : (
        <div className="space-y-3">
          {initialUpgrades.map((u) => (
            <div
              key={u.id}
              className="border-tb-neutral-200 rounded-lg border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {u.modifierName}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {GVM_UPGRADE_PATHWAY_LABELS[u.pathway]}
                    {u.isPreRego ? ' · pre-rego' : ''}
                    {u.certifiedState ? ` · ${u.certifiedState}` : ''}
                    {u.vtaNumber ? ` · ${u.vtaNumber}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => setMode({ kind: 'edit', upgrade: u })}
                    className="text-tb-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(u)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <Figure label="GVM" value={kg(u.gvmKg)} />
                <Figure label="GCM" value={kg(u.gcmKg)} />
                <Figure label="Max towing" value={kg(u.maxTowingKg)} />
                <Figure label="Front axle" value={kg(u.frontAxleLimitKg)} />
                <Figure label="Rear axle" value={kg(u.rearAxleLimitKg)} />
                <Figure label="Added mass" value={kg(u.addedMassKg)} />
              </dl>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete GVM upgrade"
        message={`Delete "${pendingDelete?.modifierName ?? ''}"? Setups referencing it keep their figures but lose the kit link.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}
