'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PickerVariant, EntityType } from '../types';

const STORAGE_KEY_PREFIX = 'tb_picker_recent_';
const MAX_RECENT = 5;

function storageKey(entityType: EntityType) {
  return `${STORAGE_KEY_PREFIX}${entityType}`;
}

function readRecent(entityType: EntityType): PickerVariant[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(entityType));
    return raw ? (JSON.parse(raw) as PickerVariant[]) : [];
  } catch {
    return [];
  }
}

function writeRecent(entityType: EntityType, items: PickerVariant[]) {
  try {
    localStorage.setItem(storageKey(entityType), JSON.stringify(items));
  } catch {
    // storage quota exceeded — fail silently
  }
}

export function useRecent(entityType: EntityType) {
  const [recent, setRecent] = useState<PickerVariant[]>([]);

  useEffect(() => {
    setRecent(readRecent(entityType));
  }, [entityType]);

  const addRecent = useCallback(
    (variant: PickerVariant) => {
      setRecent((prev) => {
        const filtered = prev.filter((v) => v.id !== variant.id);
        const next = [variant, ...filtered].slice(0, MAX_RECENT);
        writeRecent(entityType, next);
        return next;
      });
    },
    [entityType],
  );

  return { recent, addRecent };
}
