/**
 * Shared types + Zod schemas for the vehicle-spec fetch pipeline.
 *
 * Design rationale (do not "fix" away): the provider's self-reported
 * `confidence` is recorded for display but is **never** a gating signal — an
 * ungrounded local model confidently self-rates hallucinated compliance numbers
 * "HIGH" (verified on the LandCruiser 100). Trust for gating comes only from
 * external corroboration (source URL / plate / admin tick). See ./gating.ts.
 */
import { z } from 'zod/v4';
import type { Market, VehicleBodyType } from '@prisma/client';

/** Canonical VehicleVariant column names a fetch may populate. */
export type VehicleSpecFieldKey =
  | 'gvmKg'
  | 'gcmKg'
  | 'frontAxleLimitKg'
  | 'rearAxleLimitKg'
  | 'maxTowingCapacityKg'
  | 'maxTowBallDownloadKg'
  | 'kerbWeightKg'
  | 'wheelbaseMm'
  | 'frontOverhangMm'
  | 'rearOverhangMm'
  | 'totalLengthMm'
  | 'fuelTankCapacityL'
  | 'fuelType';

export type SpecFetchProviderId = 'MOCK' | 'QWEN' | 'CLAUDE';

export const SpecFieldConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type SpecFieldConfidenceValue = z.infer<
  typeof SpecFieldConfidenceSchema
>;

/** What an admin types to start a fetch. */
export interface SpecFetchInput {
  makeName: string;
  modelName: string;
  variantName?: string | null;
  yearFrom: number;
  yearTo?: number | null;
  bodyType?: VehicleBodyType | null;
  market?: Market;
}

/**
 * One field as a provider returns it. `value` is canonical string form, or null
 * when the model couldn't find it (null = "not found", NEVER 0 / a guess).
 */
export interface FetchedField {
  field: VehicleSpecFieldKey;
  value: string | null;
  confidence: SpecFieldConfidenceValue | null;
  sourceUrl: string | null;
}

export interface SpecFetchResult {
  provider: SpecFetchProviderId;
  providerModel: string | null;
  promptVersion: string;
  fields: FetchedField[];
  /** Verbatim provider output (store raw, derive later). */
  raw: unknown;
}

export interface SpecFetchProvider {
  readonly id: SpecFetchProviderId;
  fetchVehicleSpec(input: SpecFetchInput): Promise<SpecFetchResult>;
}

/**
 * The JSON contract we ask the model to return and then Zod-validate. A flat map
 * of fieldKey → { value, confidence, sourceUrl }. `value` accepts number | string
 * | null so a model that emits a bare number still validates; we normalise to a
 * canonical string downstream. Unknown keys are dropped, not errored, so a chatty
 * model can't fail the whole fetch.
 */
export const ProviderFieldSchema = z.object({
  value: z.union([z.number(), z.string(), z.null()]).optional(),
  confidence: SpecFieldConfidenceSchema.nullish(),
  sourceUrl: z.string().nullish(),
});

export const ProviderResponseSchema = z.object({
  fields: z.record(z.string(), ProviderFieldSchema),
});

export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;
