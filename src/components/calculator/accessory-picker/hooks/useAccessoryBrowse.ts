'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCalculatorState } from '@/modules/calculator/context';
import type { AccessoryBrowseStep, AccessoryCategory, AccessoryBrand, AccessoryItem } from '../types';

interface BrowseState {
  step: AccessoryBrowseStep;
  category?: AccessoryCategory;
  brand?: AccessoryBrand;
}

export function useAccessoryBrowse() {
  const { state } = useCalculatorState();
  const vehicleVariantId = state.vehicleVariantId;
  const [browse, setBrowse] = useState<BrowseState>({ step: 'categories' });
  const [categories, setCategories] = useState<AccessoryCategory[]>([]);
  const [brands, setBrands] = useState<AccessoryBrand[]>([]);
  const [items, setItems] = useState<AccessoryItem[]>([]);
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [activeLocation, setActiveLocation] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load categories on mount
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/accessories/categories')
      .then((r) => r.json())
      .then((d: { items: AccessoryCategory[] }) => setCategories(d.items))
      .catch(() => setError('Could not load categories'))
      .finally(() => setIsLoading(false));
  }, []);

  // Load brands when a category is selected
  useEffect(() => {
    if (!browse.category) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/accessories/categories/${browse.category.id}/brands`)
      .then((r) => r.json())
      .then((d: { items: AccessoryBrand[] }) => setBrands(d.items))
      .catch(() => setError('Could not load brands'))
      .finally(() => setIsLoading(false));
  }, [browse.category]);

  // Load items when a brand is selected, re-fetch when location filter changes
  useEffect(() => {
    if (!browse.brand) return;
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (browse.category) params.set('categoryId', browse.category.id);
    if (activeLocation) params.set('mountingLocation', activeLocation);
    if (vehicleVariantId) params.set('vehicleVariantId', vehicleVariantId);
    fetch(`/api/accessories/brands/${browse.brand.id}/items?${params}`)
      .then((r) => r.json())
      .then((d: { items: AccessoryItem[]; allLocations: string[] }) => {
        setItems(d.items);
        setAllLocations(d.allLocations);
      })
      .catch(() => setError('Could not load accessories'))
      .finally(() => setIsLoading(false));
  }, [browse.brand, browse.category, activeLocation, vehicleVariantId]);

  const selectCategory = useCallback((category: AccessoryCategory) => {
    setBrowse({ step: 'brands', category });
    setBrands([]);
    setActiveLocation(undefined);
  }, []);

  const selectBrand = useCallback((brand: AccessoryBrand) => {
    setBrowse((prev) => ({ ...prev, step: 'items', brand }));
    setItems([]);
    setAllLocations([]);
    setActiveLocation(undefined);
  }, []);

  const goBack = useCallback(() => {
    setBrowse((prev) => {
      if (prev.step === 'items') return { step: 'brands', category: prev.category };
      if (prev.step === 'brands') return { step: 'categories' };
      return prev;
    });
    setActiveLocation(undefined);
  }, []);

  return {
    step: browse.step,
    selectedCategory: browse.category,
    selectedBrand: browse.brand,
    categories,
    brands,
    items,
    allLocations,
    activeLocation,
    setActiveLocation,
    isLoading,
    error,
    selectCategory,
    selectBrand,
    goBack,
  };
}
