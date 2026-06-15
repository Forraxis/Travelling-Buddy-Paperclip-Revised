'use client';

import { Suspense, useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { CalculatorProvider } from '@/modules/calculator/context';
import { CalculatorConfig } from '@/app/calculator/_components/CalculatorConfig';
import { RightColumnWrapper } from '@/app/calculator/_components/RightColumnWrapper';
import { MobileResultsBarWrapper } from '@/app/calculator/_components/MobileResultsBarWrapper';
import { stateToParams } from '@/modules/calculator/url-params';
import type {
  CalculatorState,
  AccessorySelection,
} from '@/modules/calculator/types';

interface SharedSetup {
  id: string;
  name: string;
  vehicleVariantId: string | null;
  caravanVariantId: string | null;
  passengers: number;
  cargoKg: number | string;
  fuelPercent: number;
  freshWaterPercent: number;
  greyWaterPercent: number;
  accessories: Array<{
    fitment: {
      id: string;
      accessory: { id: string };
      weightKg?: number | string;
    };
    quantityOverride: number;
    cogXMmOverride?: number | null;
    cogYMmOverride?: number | null;
  }>;
  caravanAccessories: Array<{
    fitment: {
      id: string;
      accessory: { id: string };
      weightKg?: number | string;
    };
    quantityOverride: number;
    cogXMmOverride?: number | null;
    cogYMmOverride?: number | null;
  }>;
}

function setupToInitialParams(setup: SharedSetup): URLSearchParams {
  const accessories: AccessorySelection[] = setup.accessories.map((a) => ({
    accessoryId: a.fitment.accessory.id,
    massKg: Number(a.fitment.weightKg ?? 0),
    mountingLocation: '',
    cogXMm: a.cogXMmOverride,
    cogYMm: a.cogYMmOverride,
  }));

  const caravanAccessories: AccessorySelection[] = setup.caravanAccessories.map(
    (a) => ({
      accessoryId: a.fitment.accessory.id,
      massKg: Number(a.fitment.weightKg ?? 0),
      mountingLocation: '',
      cogXMm: a.cogXMmOverride,
      cogYMm: a.cogYMmOverride,
    }),
  );

  const state: CalculatorState = {
    vehicleVariantId: setup.vehicleVariantId,
    caravanVariantId: setup.caravanVariantId,
    journey: {
      passengers: setup.passengers,
      passengerWeightKg: 80,
      cargoKg: Number(setup.cargoKg),
      fuelPercent: setup.fuelPercent,
      freshWaterPercent: setup.freshWaterPercent,
      greyWaterPercent: setup.greyWaterPercent,
      gearKg: 0,
    },
    caravanAssumptions: {
      freshWaterL: 0,
      greyWaterL: 0,
      gearKg: 0,
    },
    accessories,
    caravanAccessories,
  };

  return stateToParams(state);
}

interface Props {
  setup: SharedSetup;
  token: string;
}

export function SharedSetupView({ setup, token }: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const [forking, setForking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const initialParams = setupToInitialParams(setup);

  const handleFork = useCallback(async () => {
    if (!session?.user) {
      router.push(`/auth/signin?callbackUrl=/setup/share/${token}`);
      return;
    }

    setForking(true);
    try {
      const res = await fetch('/api/setups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${setup.name} (shared)`,
          vehicleVariantId: setup.vehicleVariantId,
          caravanVariantId: setup.caravanVariantId,
          passengers: setup.passengers,
          cargoKg: Number(setup.cargoKg),
          fuelPercent: setup.fuelPercent,
          freshWaterPercent: setup.freshWaterPercent,
          greyWaterPercent: setup.greyWaterPercent,
          accessories: setup.accessories.map((a) => ({
            fitmentId: a.fitment.id,
            quantityOverride: a.quantityOverride,
          })),
          caravanAccessories: setup.caravanAccessories.map((a) => ({
            fitmentId: a.fitment.id,
            quantityOverride: a.quantityOverride,
          })),
        }),
      });

      if (!res.ok) throw new Error('Fork failed');

      setToast('Setup saved to your account!');
      setTimeout(() => router.push('/account/setups'), 1500);
    } catch {
      setToast('Failed to save setup');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setForking(false);
    }
  }, [session, setup, token, router]);

  return (
    <div className="bg-tb-neutral-50 flex h-full min-h-screen flex-col">
      <Suspense>
        <CalculatorProvider initialParams={initialParams}>
          <header className="border-tb-neutral-200 border-b bg-white">
            <div className="flex h-14 items-center justify-between px-4">
              <h1 className="text-tb-primary text-base font-semibold">
                {setup.name}
              </h1>
              <button
                onClick={handleFork}
                disabled={forking}
                className="bg-tb-primary hover:bg-tb-primary/90 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {forking ? 'Saving…' : 'Save your version'}
              </button>
            </div>
            <div className="border-tb-neutral-100 border-t bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              This is a shared setup (read-only).{' '}
              {!session?.user && (
                <button
                  onClick={handleFork}
                  className="font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950"
                >
                  Sign in to save your own version.
                </button>
              )}
            </div>
          </header>
          <div className="flex flex-1 overflow-hidden">
            <CalculatorConfig />
            <RightColumnWrapper />
            <MobileResultsBarWrapper />
          </div>
        </CalculatorProvider>
      </Suspense>

      {toast && (
        <div className="fixed right-4 bottom-4 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
