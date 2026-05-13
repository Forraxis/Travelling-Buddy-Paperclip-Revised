"use client";

import { useCallback } from "react";
import { useSetupSave } from "./hooks/useSetupSave";
import { useSession } from "next-auth/react";

interface SaveSetupButtonProps {
  setupId?: string | null;
  vehicleName?: { name: string; model: { name: string } } | null;
  caravanName?: { name: string; model: { name: string } } | null;
  onToast?: (message: string) => void;
  onNewSetupSaved?: (id: string, shareToken: string) => void;
  label?: string;
  className?: string;
}

export function SaveSetupButton({
  setupId,
  vehicleName,
  caravanName,
  onToast,
  onNewSetupSaved,
  label,
  className,
}: SaveSetupButtonProps) {
  const { data: session } = useSession();
  const { save, saving, canSave } = useSetupSave(setupId ?? null, { vehicleName, caravanName });

  const handleSave = useCallback(async () => {
    const result = await save();
    if (!result.ok) {
      onToast?.("Failed to save setup");
      return;
    }
    if (result.isAnonymous) {
      onToast?.("Saved on this device — sign up to sync across devices");
    } else if (setupId) {
      onToast?.("Setup updated");
    } else {
      onToast?.("Saved! View in My Setups");
      if (result.id && result.shareToken) {
        onNewSetupSaved?.(result.id, result.shareToken);
      }
    }
  }, [save, setupId, onToast, onNewSetupSaved]);

  const disabled = !canSave || saving;
  const isUpdate = !!session?.user && !!setupId;
  const buttonLabel = label ?? (saving ? "Saving…" : isUpdate ? "Update Setup" : "Save Setup");

  return (
    <button
      onClick={handleSave}
      disabled={disabled}
      className={
        className ??
        "rounded-lg bg-tb-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-tb-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {buttonLabel}
    </button>
  );
}
