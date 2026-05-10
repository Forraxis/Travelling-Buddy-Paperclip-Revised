'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  PickerConfig,
  PickerMake,
  PickerModel,
  PickerVariant,
  BrowseStep,
  VariantFilters,
} from '../types';

// ── Picker API response shapes ───────────────────────────────────────────────

interface ApiMake {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  modelCount: number;
}

interface ApiModel {
  id: string;
  name: string;
  slug: string;
  bodyType: string;
  variantCount: number;
}

interface ApiPickerItem {
  id: string;
  type: 'vehicle' | 'caravan';
  make: string;
  makeId: string;
  makeSlug: string;
  model: string;
  modelId: string;
  modelSlug: string;
  variant: string;
  variantSlug: string;
  yearSpan: string;
  specs: {
    gvmKg?: number;
    gcmKg?: number;
    kerbWeightKg?: number;
    maxTowingCapacityKg?: number;
    fuelType?: string;
    bodyType?: string;
    atmKg?: number;
    gtmKg?: number;
    tbmKg?: number;
    axleConfiguration?: string;
    bodyLengthMm?: number;
    freshWaterCapacityL?: number;
    greyWaterCapacityL?: number;
  };
}

interface ApiFacets {
  bodyTypes?: string[];
  fuelTypes?: string[];
  axleConfigurations?: string[];
  yearMin?: number | null;
  yearMax?: number | null;
  bodyType?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function apiItemToPickerVariant(item: ApiPickerItem): PickerVariant {
  const [yearFromStr] = item.yearSpan.split('–');
  const yearFrom = parseInt(yearFromStr, 10) || 0;
  const yearToStr = item.yearSpan.split('–')[1];
  const isCurrentProduction = yearToStr === 'present';
  const yearTo = isCurrentProduction ? new Date().getFullYear() : (parseInt(yearToStr, 10) || yearFrom);

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
    atmKg: item.specs.atmKg,
    gtmKg: item.specs.gtmKg,
    tbmKg: item.specs.tbmKg,
    axleConfiguration: item.specs.axleConfiguration,
    freshWaterCapacityL: item.specs.freshWaterCapacityL,
    greyWaterCapacityL: item.specs.greyWaterCapacityL,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface BrowseData {
  step: BrowseStep;
  makes: PickerMake[];
  models: PickerModel[];
  variants: PickerVariant[];
  allVariants: PickerVariant[];
  selectedMake?: PickerMake;
  selectedModel?: PickerModel;
  filters: VariantFilters;
  facets: ApiFacets;
  isLoading: boolean;
  error: string | null;
}

export function useBrowse(config: PickerConfig) {
  const [step, setStep] = useState<BrowseStep>('makes');
  const [makes, setMakes] = useState<PickerMake[]>([]);
  const [models, setModels] = useState<PickerModel[]>([]);
  const [variants, setVariants] = useState<PickerVariant[]>([]);
  const [selectedMake, setSelectedMake] = useState<PickerMake | undefined>();
  const [selectedModel, setSelectedModel] = useState<PickerModel | undefined>();
  const [filters, setFilters] = useState<VariantFilters>({});
  const [facets, setFacets] = useState<ApiFacets>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load makes on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`${config.apiBase}/makes`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ items: ApiMake[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setMakes(
          data.items.map((m) => ({
            id: m.id,
            name: m.name,
            slug: m.slug,
            logoUrl: m.logoUrl,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load makes.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [config.apiBase]);

  const selectMake = useCallback(
    async (make: PickerMake) => {
      setSelectedMake(make);
      setStep('models');
      setIsLoading(true);
      setError(null);
      setFacets({});
      try {
        const res = await fetch(`${config.apiBase}/makes/${make.id}/models`);
        if (!res.ok) throw new Error();
        const data = await res.json() as { items: ApiModel[]; facets: ApiFacets };
        setModels(
          data.items.map((m) => ({
            id: m.id,
            makeId: make.id,
            name: m.name,
            slug: m.slug,
            bodyType: m.bodyType,
          }))
        );
        setFacets(data.facets ?? {});
      } catch {
        setError('Failed to load models.');
      } finally {
        setIsLoading(false);
      }
    },
    [config.apiBase],
  );

  const selectModel = useCallback(
    async (model: PickerModel) => {
      setSelectedModel(model);
      setStep('variants');
      setFilters({});
      setIsLoading(true);
      setError(null);
      setFacets({});
      try {
        const makeId = selectedMake?.id ?? model.makeId;
        const res = await fetch(
          `${config.apiBase}/makes/${makeId}/models/${model.id}/variants`
        );
        if (!res.ok) throw new Error();
        const data = await res.json() as { items: ApiPickerItem[]; facets: ApiFacets };
        setVariants(data.items.map(apiItemToPickerVariant));
        setFacets(data.facets ?? {});
      } catch {
        setError('Failed to load variants.');
      } finally {
        setIsLoading(false);
      }
    },
    [config.apiBase, selectedMake],
  );

  const goBack = useCallback(() => {
    if (step === 'variants') {
      setStep('models');
      setSelectedModel(undefined);
      setFilters({});
      setFacets((prev) => ({ bodyTypes: prev.bodyTypes }));
    } else if (step === 'models') {
      setStep('makes');
      setSelectedMake(undefined);
      setModels([]);
      setFacets({});
    }
  }, [step]);

  const updateFilter = useCallback((patch: Partial<VariantFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const filteredVariants = variants.filter((v) => {
    if (filters.bodyType && v.bodyType !== filters.bodyType) return false;
    if (filters.fuelType && v.fuelType !== filters.fuelType) return false;
    if (filters.axleConfiguration && v.axleConfiguration !== filters.axleConfiguration) return false;
    return true;
  });

  return {
    step,
    makes,
    models,
    variants: filteredVariants,
    allVariants: variants,
    selectedMake,
    selectedModel,
    filters,
    facets,
    isLoading,
    error,
    selectMake,
    selectModel,
    goBack,
    updateFilter,
  };
}
