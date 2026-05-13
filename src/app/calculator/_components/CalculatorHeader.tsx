"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { SaveSetupButton } from "@/components/calculator/SaveSetupButton";
import { useSetupSave } from "@/components/calculator/hooks/useSetupSave";
import { AnonymousSaveBanner } from "@/components/calculator/AnonymousSaveBanner";
import { CatalogueRemovedBanner } from "@/components/calculator/CatalogueRemovedBanner";
import { InlineNameEdit } from "@/components/setups/InlineNameEdit";
import { useSetupCatalogueStatus } from "@/components/calculator/hooks/useSetupCatalogueStatus";
import { listLocalSetups } from "@/lib/local-setups";
import type { VehicleSnapshot, CaravanSnapshot, AccessoryFitmentSnapshot } from "@/lib/setup-snapshots";

function AccountIcon() {
  const { data: session, status } = useSession();
  if (status === "loading") return null;

  if (session?.user) {
    const name = session.user.name ?? session.user.email ?? "";
    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

    return (
      <Link
        href="/account"
        aria-label="My account"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tb-primary text-xs font-semibold text-white hover:opacity-90"
        title={name}
      >
        {initials || "?"}
      </Link>
    );
  }

  return (
    <Link
      href="/auth/signin"
      aria-label="Sign in"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-tb-neutral-300 text-tb-neutral-500 hover:bg-tb-neutral-100"
      title="Sign in"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </Link>
  );
}

export function CalculatorHeader() {
  const [toast, setToast] = useState<string | null>(null);
  const [setupName, setSetupName] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [hasLocalSetups, setHasLocalSetups] = useState(false);
  const [copying, setCopying] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupId = searchParams.get("setupId");
  const catalogueStatus = useSetupCatalogueStatus(setupId);
  const { save: saveForShare } = useSetupSave(setupId);

  useEffect(() => {
    setHasLocalSetups(listLocalSetups().length > 0);
  }, [toast]);

  useEffect(() => {
    if (!setupId) {
      setSetupName(null);
      setShareToken(null);
      return;
    }
    fetch(`/api/setups/${setupId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.name) setSetupName(data.name);
        if (data?.shareToken) setShareToken(data.shareToken);
      })
      .catch(() => {});
  }, [setupId]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleNewSetupSaved = useCallback(
    (id: string, token: string) => {
      setShareToken(token);
      const params = new URLSearchParams(searchParams.toString());
      params.set("setupId", id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleShare = useCallback(async () => {
    if (!session?.user) {
      showToast("Sign up to create a shareable link");
      return;
    }

    let token = shareToken;

    if (!token) {
      // Save first, then share
      const result = await saveForShare();
      if (!result.ok) {
        showToast("Failed to save setup");
        return;
      }
      if (result.id && result.shareToken) {
        setShareToken(result.shareToken);
        token = result.shareToken;
        handleNewSetupSaved(result.id, result.shareToken);
      }
    }

    if (!token) {
      showToast("Unable to create share link");
      return;
    }

    setCopying(true);
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/setup/share/${token}`,
      );
      showToast("Share link copied to clipboard");
    } catch {
      showToast("Failed to copy link");
    } finally {
      setCopying(false);
    }
  }, [session, shareToken, saveForShare, handleNewSetupSaved, showToast]);

  return (
    <>
      <header className="h-14 border-b border-tb-neutral-200 bg-white px-4 flex items-center justify-between gap-2">
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
        <div className="flex items-center gap-2 shrink-0">
          {!session?.user && hasLocalSetups && (
            <Link
              href="/account/local-setups"
              className="rounded-lg border border-tb-neutral-300 px-3 py-2 text-sm font-medium text-tb-neutral-700 hover:bg-tb-neutral-100"
            >
              My Setups
            </Link>
          )}
          <button
            type="button"
            onClick={handleShare}
            disabled={copying}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-tb-neutral-300 px-3 py-2 text-sm font-medium text-tb-neutral-700 hover:bg-tb-neutral-100 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
          <SaveSetupButton
            setupId={setupId}
            onToast={showToast}
            onNewSetupSaved={handleNewSetupSaved}
          />
          <AccountIcon />
        </div>
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
