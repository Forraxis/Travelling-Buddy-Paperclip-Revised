/**
 * Typed environment validation. Catches missing/invalid configuration at server
 * boot (via {@link validateEnv}, called from `src/instrumentation.ts`) rather
 * than as a confusing runtime 500 deep in a request — the difference between
 * "the deploy refused to start" and "auth silently 500s for every user".
 *
 * Policy: a small core is always required (the DB). The rest are *feature*
 * secrets — required only in production, optional in dev/test so a fresh clone
 * runs with a half-filled `.env`. Features whose secret is absent degrade on
 * their own (email warns, AdSense stays inert, VLM jobs no-op).
 *
 * No top-level parse: parsing only happens when validateEnv()/getEnv() is
 * called, so importing this module never crashes a unit test that has no env.
 */
import { z } from 'zod/v4';

const optionalString = z.string().min(1).optional();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    // Always required — nothing works without the database.
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // Auth (required in production — see superRefine).
    AUTH_SECRET: optionalString,
    AUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,

    // Public site identity (required in production for canonicals / OG / robots).
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SITE_NAME: optionalString,

    // Async pipeline.
    REDIS_URL: optionalString,
    WORKERS_DISABLED: optionalString,

    // Object storage (R2) — required as a set in production for photo uploads.
    CLOUDFLARE_R2_ENDPOINT: optionalString,
    CLOUDFLARE_R2_ACCESS_KEY_ID: optionalString,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: optionalString,
    CLOUDFLARE_R2_BUCKET: optionalString,
    NEXT_PUBLIC_R2_PUBLIC_URL: optionalString,

    // VLM inference (optional — submission OCR/VLM degrades without it).
    VLM_ENDPOINT_URL: z.string().url().optional(),
    VLM_API_KEY: optionalString,
    VLM_MODEL: optionalString,

    // Vehicle-spec fetch (all optional). Qwen = Tim's local llama.cpp server
    // (no key); ANTHROPIC_API_KEY backs the future grounded Claude path. Absent
    // values are fine — the admin pipeline runs on the MOCK provider.
    QWEN_BASE_URL: z.string().url().optional(),
    QWEN_MODEL: optionalString,
    ANTHROPIC_API_KEY: optionalString,
    // Hard gate for the live spec-fetch worker. Unset (default) = the worker
    // refuses to call a model or persist its output. Only the MOCK provider runs
    // until this is deliberately set to 'true' with a real provider configured.
    SPEC_FETCH_LIVE_ENABLED: optionalString,
    // Hard gate for the ROVER catalogue-crawl worker. Unset (default) = the
    // repeatable crawl no-ops (no fetch, no parse, no DB write). Only set 'true'
    // once the real directory crawler + PDF parser are built and access is approved.
    ROVER_CRAWL_ENABLED: optionalString,
    // Bearer token for the ROVER ingest webhook (POST /api/rover/ingest), which
    // n8n calls with the VTADetails HTML. Unset (default) = the endpoint returns
    // 404 and stays invisible; only set it to bring the ingest path online.
    ROVER_INGEST_TOKEN: optionalString,

    // Email (optional — sends are skipped with a warning when absent).
    RESEND_API_KEY: optionalString,
    RESEND_FROM_EMAIL: optionalString,

    // Monetisation / analytics (always optional — inert until set).
    NEXT_PUBLIC_ADSENSE_CLIENT: optionalString,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: optionalString,
  })
  // Secrets that are fine to omit in dev but must be present in production.
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production') return;
    const requiredInProd: Array<keyof typeof val> = [
      'AUTH_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'NEXT_PUBLIC_SITE_URL',
    ];
    for (const key of requiredInProd) {
      if (!val[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }
    // R2 is all-or-nothing: a partial config silently breaks uploads.
    const r2 = [
      val.CLOUDFLARE_R2_ENDPOINT,
      val.CLOUDFLARE_R2_ACCESS_KEY_ID,
      val.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      val.CLOUDFLARE_R2_BUCKET,
    ];
    if (r2.some(Boolean) && !r2.every(Boolean)) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLOUDFLARE_R2_ENDPOINT'],
        message:
          'Cloudflare R2 config is incomplete — set ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY and BUCKET together (or none).',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Pure parse of an arbitrary source object. Throws a single readable error that
 * lists every problem at once. Side-effect-free and uncached — the unit-testable
 * core of {@link validateEnv}.
 */
export function parseEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${lines.join('\n')}\n` +
        `See .env.example for the full list.`,
    );
  }
  return result.data;
}

/**
 * Parse + validate `process.env`, cached after the first success. Call at boot.
 */
export function validateEnv(): Env {
  return (cached ??= parseEnv(process.env));
}

/** Validated, typed env accessor. Lazily validates on first use. */
export function getEnv(): Env {
  return validateEnv();
}
