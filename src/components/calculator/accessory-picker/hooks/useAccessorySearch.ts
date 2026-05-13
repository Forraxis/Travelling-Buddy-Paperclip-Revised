'use client';

import { useState, useEffect, useRef } from 'react';
import { useCalculatorState } from '@/modules/calculator/context';
import type { AccessoryItem } from '../types';

export function useAccessorySearch(limit = 15, context: 'vehicle' | 'caravan' = 'vehicle') {
  const { state } = useCalculatorState();
  const vehicleVariantId = context === 'vehicle' ? state.vehicleVariantId : null;
  const caravanVariantId = context === 'caravan' ? state.caravanVariantId : null;
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AccessoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
        if (vehicleVariantId) params.set('vehicleVariantId', vehicleVariantId);
        if (caravanVariantId) params.set('caravanVariantId', caravanVariantId);
        const url = `/api/accessories/search?${params}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const data = await res.json() as { items: AccessoryItem[] };
        setItems(data.items);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError('Search unavailable');
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, limit, vehicleVariantId, caravanVariantId]);

  return { query, setQuery, items, isLoading, error };
}
