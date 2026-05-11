"use client";

import type { VehicleSnapshot } from "@/lib/setup-snapshots";
import type { CaravanSnapshot, AccessoryFitmentSnapshot } from "@/lib/setup-snapshots";

interface RemovedEntity {
  name: string;
  snapshotDate: string;
}

interface CatalogueRemovedBannerProps {
  vehicleSnapshotOnly?: boolean;
  caravanSnapshotOnly?: boolean;
  removedFitments?: string[];
  vehicleSnapshot?: VehicleSnapshot | null;
  caravanSnapshot?: CaravanSnapshot | null;
  accessorySnapshot?: (AccessoryFitmentSnapshot & { target: string })[] | null;
  savedAt?: string;
}

export function CatalogueRemovedBanner({
  vehicleSnapshotOnly,
  caravanSnapshotOnly,
  removedFitments,
  vehicleSnapshot,
  caravanSnapshot,
  accessorySnapshot,
  savedAt,
}: CatalogueRemovedBannerProps) {
  const removed: RemovedEntity[] = [];
  const dateStr = savedAt
    ? new Date(savedAt).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "the last save";

  if (vehicleSnapshotOnly && vehicleSnapshot) {
    removed.push({
      name: `${vehicleSnapshot.makeName} ${vehicleSnapshot.modelName} ${vehicleSnapshot.name}`,
      snapshotDate: dateStr,
    });
  }

  if (caravanSnapshotOnly && caravanSnapshot) {
    removed.push({
      name: `${caravanSnapshot.makeName} ${caravanSnapshot.modelName} ${caravanSnapshot.name}`,
      snapshotDate: dateStr,
    });
  }

  if (removedFitments && removedFitments.length > 0 && accessorySnapshot) {
    const removedSet = new Set(removedFitments);
    for (const snap of accessorySnapshot) {
      if (removedSet.has(snap.fitmentId)) {
        removed.push({
          name: `${snap.brandName} ${snap.accessoryName}`,
          snapshotDate: dateStr,
        });
      }
    }
  }

  if (removed.length === 0) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3">
      {removed.map((entity) => (
        <p
          key={entity.name}
          className="text-sm text-amber-800"
        >
          <strong>{entity.name}</strong> is no longer in our catalogue. Your
          setup still calculates against the data we had on {entity.snapshotDate}
          . Edit to replace.
        </p>
      ))}
    </div>
  );
}
