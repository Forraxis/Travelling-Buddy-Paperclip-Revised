"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SaveSetupButton } from "@/components/calculator/SaveSetupButton";
import { AnonymousSaveBanner } from "@/components/calculator/AnonymousSaveBanner";
import { CatalogueRemovedBanner } from "@/components/calculator/CatalogueRemovedBanner";
import { InlineNameEdit } from "@/components/setups/InlineNameEdit";
import { useSetupCatalogueStatus } from "@/components/calculator/hooks/useSetupCatalogueStatus";
import type { VehicleSnapshot, CaravanSnapshot, AccessoryFitmentSnapshot } from "@/lib/setup-snapshots";

export function CalculatorHeader() {
  const [toast, setToast] = useState<string | null>(null);
  const [setupName, setSetupName] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const setupId = searchParams.get("setupId");
  const catalogueStatus = useSetupCatalogueStatus(setupId);

  useEffect(() => {
    if (!setupId) {
      setSetupName(null);
      return;
    }
    fetch(`/api/setups/${setupId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.name) setSetupName(data.name);
      })
      .catch(() => {});
  }, [setupId]);

  const handleSaved = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <>
      <header className="h-14 border-b border-tb-neutral-200 bg-white px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base font-semibold text-tb-primary shrink-0">Calculator</h1>
          {setupId && setupName && (
            <>
              <span className="text-gray-300">/</span>
              <InlineNameEdit
                setupId={setupId}
                initialName={setupName}
                onRename={setSetupName}
              />
            </>
          )}
        </div>
        <SaveSetupButton onSaved={handleSaved} />
      </header>
      <AnonymousSaveBanner />
      <CatalogueRemovedBanner
        vehicleSnapshotOnly={catalogueStatus.vehicleSnapshotOnly}
        caravanSnapshotOnly={catalogueStatus.caravanSnapshotOnly}
        removedFitments={catalogueStatus.removedFitments}
        vehicleSnapshot={catalogueStatus.vehicleSnapshot as VehicleSnapshot | null}
        caravanSnapshot={catalogueStatus.caravanSnapshot as CaravanSnapshot | null}
        accessorySnapshot={catalogueStatus.accessorySnapshot as (AccessoryFitmentSnapshot & { target: string })[] | null}
        savedAt={catalogueStatus.savedAt ?? undefined}
      />
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
