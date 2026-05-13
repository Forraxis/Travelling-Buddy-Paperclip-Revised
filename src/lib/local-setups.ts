"use client";

import type { CalculatorState } from "@/modules/calculator/types";

export interface LocalSetup {
  id: string;
  name: string;
  rigIdentifier: string;
  calculatorState: CalculatorState;
  savedAt: string;
  lastEditedAt: string;
  v: 1;
}

const STORAGE_PREFIX = "tb:setup:";

function key(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

export function listLocalSetups(): LocalSetup[] {
  if (typeof window === "undefined") return [];
  const setups: LocalSetup[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(STORAGE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(k);
      if (raw) setups.push(JSON.parse(raw) as LocalSetup);
    } catch {
      // skip corrupted entries
    }
  }
  setups.sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime());
  return setups;
}

export function getLocalSetup(id: string): LocalSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as LocalSetup) : null;
  } catch {
    return null;
  }
}

export function saveLocalSetup(
  name: string,
  rigIdentifier: string,
  calculatorState: CalculatorState,
  existingId?: string,
): LocalSetup {
  const now = new Date().toISOString();
  const id = existingId ?? crypto.randomUUID();
  const existing = existingId ? getLocalSetup(existingId) : null;

  const setup: LocalSetup = {
    id,
    name,
    rigIdentifier,
    calculatorState,
    savedAt: existing?.savedAt ?? now,
    lastEditedAt: now,
    v: 1,
  };

  localStorage.setItem(key(id), JSON.stringify(setup));
  return setup;
}

export function deleteLocalSetup(id: string): void {
  localStorage.removeItem(key(id));
}
