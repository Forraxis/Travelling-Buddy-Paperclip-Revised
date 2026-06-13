'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCalculatorState } from '@/modules/calculator/context';
import { usePhysicsView } from '@/modules/calculator/use-physics-result';
import { useSetupSave } from '@/components/calculator/hooks/useSetupSave';
import { MobileResultsBar } from './MobileResultsBar';

export function MobileResultsBarWrapper() {
  const { state } = useCalculatorState();
  const view = usePhysicsView();
  const result = view?.result ?? null;
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupId = searchParams.get('setupId');
  const { save, saving } = useSetupSave(setupId);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleSave = useCallback(async () => {
    const result = await save();
    if (!result.ok) {
      showToast('Failed to save setup');
      return;
    }
    if (result.isAnonymous) {
      showToast('Saved on this device — sign up to sync across devices');
    } else if (setupId) {
      showToast('Setup updated');
    } else {
      showToast('Saved! View in My Setups');
      if (result.id) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('setupId', result.id);
        router.replace(`?${params.toString()}`, { scroll: false });
      }
    }
  }, [save, setupId, showToast, router, searchParams]);

  const handleShare = useCallback(async () => {
    if (!session?.user) {
      showToast('Sign up to create a shareable link');
      return;
    }
    // Ensure saved first
    let token: string | undefined;
    if (!setupId) {
      const res = await save();
      if (!res.ok || !res.shareToken) {
        showToast('Failed to save setup');
        return;
      }
      token = res.shareToken;
      if (res.id) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('setupId', res.id);
        router.replace(`?${params.toString()}`, { scroll: false });
      }
    } else {
      // Fetch shareToken for existing setup
      const data = await fetch(`/api/setups/${setupId}`).then((r) =>
        r.ok ? r.json() : null,
      );
      token = data?.shareToken;
    }
    if (!token) {
      showToast('Unable to create share link');
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/setup/share/${token}`,
      );
      showToast('Share link copied to clipboard');
    } catch {
      showToast('Failed to copy link');
    }
  }, [session, setupId, save, showToast, router, searchParams]);

  return (
    <>
      <MobileResultsBar
        vehicleSelected={state.vehicleVariantId !== null}
        result={result}
        schematic={view?.schematic ?? null}
        onSave={handleSave}
        onShare={handleShare}
        saving={saving}
      />
      {toast && (
        <div className="fixed right-4 bottom-20 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg md:hidden">
          {toast}
        </div>
      )}
    </>
  );
}
