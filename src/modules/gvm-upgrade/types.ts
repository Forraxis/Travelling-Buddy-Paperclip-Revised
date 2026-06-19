import { z } from 'zod/v4';
import type { AustralianState, GvmUpgradePathway } from '@prisma/client';

/**
 * A catalogue GVM-upgrade kit, summarised for selection in the calculator/setup
 * "your kit" picker and the admin manager. Mirrors the fields the physics
 * overlay reads (`AppliedGvmUpgrade` in build-physics-input.ts) plus identity.
 */
export interface GvmUpgradeKitDto {
  id: string;
  baseVariantId: string;
  modifierName: string;
  pathway: GvmUpgradePathway;
  vtaNumber: string | null;
  engineerRef: string | null;
  gvmKg: number | null;
  gcmKg: number | null;
  frontAxleLimitKg: number | null;
  rearAxleLimitKg: number | null;
  maxTowingKg: number | null;
  addedMassKg: number | null;
  isPreRego: boolean;
  certifiedState: AustralianState | null;
  status: 'CATALOGUE' | 'COMMUNITY';
  sourceUrl: string | null;
  sourceVtaNumber: string | null;
}

/**
 * The free-form "enter custom" override a setup carries in
 * `Setup.customGvmUpgrade` (the engineer-cert / plate path). Its keys are a
 * superset of the physics overlay's `AppliedGvmUpgrade` — the overlay reads the
 * limit fields; `certifiedState` / `engineerRef` are kept for the interstate
 * warning + provenance. Marked ESTIMATE until plate-confirmed.
 */
export interface CustomGvmUpgrade {
  gvmKg?: number | null;
  gcmKg?: number | null;
  frontAxleLimitKg?: number | null;
  rearAxleLimitKg?: number | null;
  maxTowingKg?: number | null;
  addedMassKg?: number | null;
  certifiedState?: AustralianState | null;
  engineerRef?: string | null;
}

const AUSTRALIAN_STATES = [
  'NSW',
  'VIC',
  'QLD',
  'WA',
  'SA',
  'TAS',
  'NT',
  'ACT',
] as const satisfies readonly AustralianState[];

const GVM_UPGRADE_PATHWAYS = [
  'PRE_REGO_SECOND_STAGE',
  'POST_REGO_SSM',
  'STATE_ENGINEER',
] as const satisfies readonly GvmUpgradePathway[];

const positiveIntOrNull = z
  .number()
  .int()
  .positive()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** Validates a custom (plate / engineer-cert) GVM override before it is stored. */
export const customGvmUpgradeSchema = z
  .object({
    gvmKg: positiveIntOrNull,
    gcmKg: positiveIntOrNull,
    frontAxleLimitKg: positiveIntOrNull,
    rearAxleLimitKg: positiveIntOrNull,
    maxTowingKg: positiveIntOrNull,
    addedMassKg: positiveIntOrNull,
    certifiedState: z.enum(AUSTRALIAN_STATES).nullable().optional(),
    engineerRef: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((u) => u.gvmKg != null, {
    message: 'A custom upgrade must at least state the upgraded GVM (kg).',
    path: ['gvmKg'],
  });

/** Admin create/update payload for a catalogue GvmUpgrade kit. */
export const gvmUpgradeAdminSchema = z.object({
  modifierName: z
    .string()
    .trim()
    .min(1, 'Kit / modifier name is required')
    .max(120),
  pathway: z.enum(GVM_UPGRADE_PATHWAYS),
  vtaNumber: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v : null)),
  engineerRef: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  gvmKg: positiveIntOrNull,
  gcmKg: positiveIntOrNull,
  frontAxleLimitKg: positiveIntOrNull,
  rearAxleLimitKg: positiveIntOrNull,
  maxTowingKg: positiveIntOrNull,
  addedMassKg: positiveIntOrNull,
  isPreRego: z.boolean().default(false),
  certifiedState: z.enum(AUSTRALIAN_STATES).nullable().optional(),
  sourceUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)),
});

export type GvmUpgradeAdminInput = z.input<typeof gvmUpgradeAdminSchema>;
export type GvmUpgradeAdminParsed = z.output<typeof gvmUpgradeAdminSchema>;

export const GVM_UPGRADE_PATHWAY_LABELS: Record<GvmUpgradePathway, string> = {
  PRE_REGO_SECOND_STAGE: 'Pre-rego second-stage (SSM)',
  POST_REGO_SSM: 'Post-rego SSM',
  STATE_ENGINEER: 'State engineer cert',
};
