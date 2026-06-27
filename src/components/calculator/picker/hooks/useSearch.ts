'use client';

import { useState, useEffect, useRef } from 'react';
import type { PickerConfig, PickerVariant } from '../types';

interface PickerSearchItem {
  id: string;
  type: 'vehicle' | 'caravan';
  make: string;
  makeId: string;
  model: string;
  modelId: string;
  variant: string;
  yearSpan: string;
  specs: {
    gvmKg?: number;
    gcmKg?: number;
    kerbWeightKg?: number;
    maxTowingCapacityKg?: number;
    fuelType?: string;
    bodyType?: string;
    generation?: string | null;
    cabType?: string | null;
    driveType?: string | null;
    badge?: string | null;
    transmission?: string | null;
    buildOrigin?: string | null;
    atmKg?: number;
    gtmKg?: number;
    tbmKg?: number;
    axleConfiguration?: string;
    freshWaterCapacityL?: number;
    greyWaterCapacityL?: number;
    bodyLengthMm?: number | null;
    floorplan?: string | null;
    berths?: number | null;
  };
  confidenceBadge: 'verified' | 'manufacturer_spec' | 'community' | 'estimated';
}

function apiItemToPickerVariant(item: PickerSearchItem): PickerVariant {
  const [yearFromStr] = item.yearSpan.split('–');
  const yearFrom = parseInt(yearFromStr, 10) || 0;
  const yearToStr = item.yearSpan.split('–')[1];
  const isCurrentProduction = yearToStr === 'present';
  const yearTo = isCurrentProduction
    ? new Date().getFullYear()
    : parseInt(yearToStr, 10) || yearFrom;

  return {
    id: item.id,
    name: item.variant,
    yearFrom,
    yearTo,
    isCurrentProduction,
    entityType: item.type,
    makeId: item.makeId,
    makeName: item.make,
    modelId: item.modelId,
    modelName: item.model,
    bodyType: item.specs.bodyType,
    gvmKg: item.specs.gvmKg,
    gcmKg: item.specs.gcmKg,
    kerbWeightKg: item.specs.kerbWeightKg,
    maxTowingCapacityKg: item.specs.maxTowingCapacityKg,
    fuelType: item.specs.fuelType,
    generation: item.specs.generation,
    cabType: item.specs.cabType,
    driveType: item.specs.driveType,
    badge: item.specs.badge,
    transmission: item.specs.transmission,
    buildOrigin: item.specs.buildOrigin,
    atmKg: item.specs.atmKg,
    gtmKg: item.specs.gtmKg,
    tbmKg: item.specs.tbmKg,
    axleConfiguration: item.specs.axleConfiguration,
    freshWaterCapacityL: item.specs.freshWaterCapacityL,
    greyWaterCapacityL: item.specs.greyWaterCapacityL,
    bodyLengthMm: item.specs.bodyLengthMm,
    floorplan: item.specs.floorplan,
    berths: item.specs.berths,
    confidenceBadge: item.confidenceBadge,
  };
}

export function useSearch(config: PickerConfig, limit = 15) {
  const [query, setQuery] = useState('');
  const [variants, setVariants] = useState<PickerVariant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setVariants([]);
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
        const url = `${config.apiBase}/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const data = (await res.json()) as {
          items: PickerSearchItem[];
          total: number;
        };
        setVariants(data.items.map(apiItemToPickerVariant));
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
  }, [query, config.apiBase, config.entityType, limit]);

  return { query, setQuery, variants, isLoading, error };
}
