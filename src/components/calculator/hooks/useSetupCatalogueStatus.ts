"use client";

import { useEffect, useState } from "react";

export interface CatalogueStatus {
  vehicleSnapshotOnly: boolean;
  caravanSnapshotOnly: boolean;
  removedFitments: string[];
  vehicleSnapshot: Record<string, unknown> | null;
  caravanSnapshot: Record<string, unknown> | null;
  accessorySnapshot: Array<Record<string, unknown> & { fitmentId: string; target: string }> | null;
  savedAt: string | null;
}

const EMPTY: CatalogueStatus = {
  vehicleSnapshotOnly: false,
  caravanSnapshotOnly: false,
  removedFitments: [],
  vehicleSnapshot: null,
  caravanSnapshot: null,
  accessorySnapshot: null,
  savedAt: null,
};

export function useSetupCatalogueStatus(setupId: string | null): CatalogueStatus {
  const [status, setStatus] = useState<CatalogueStatus>(EMPTY);

  useEffect(() => {
    if (!setupId) {
      setStatus(EMPTY);
      return;
    }

    let active = true;
    fetch(`/api/setups/${setupId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setStatus({
          vehicleSnapshotOnly: data.vehicleSnapshotOnly ?? false,
          caravanSnapshotOnly: data.caravanSnapshotOnly ?? false,
          removedFitments: data.removedFitments ?? [],
          vehicleSnapshot: data.vehicleSnapshot ?? null,
          caravanSnapshot: data.caravanSnapshot ?? null,
          accessorySnapshot: data.accessorySnapshot ?? null,
          savedAt: data.createdAt ?? null,
        });
      })
      .catch(() => {
        if (active) setStatus(EMPTY);
      });

    return () => { active = false; };
  }, [setupId]);

  return status;
}
