/**
 * The shared prompt + JSON-schema contract used by every real provider (qwen,
 * claude). Built from the field catalogue so prompt + schema never drift from
 * the columns we can actually store.
 *
 * Reversible decision (documented per handover): we constrain output with
 * OpenAI-style `response_format: { type: 'json_schema' }` rather than a GBNF
 * grammar — llama.cpp's server supports it, it keeps the provider code portable
 * to the Claude path, and the schema is generated from one source. If a given
 * server build ignores json_schema, the Zod validation + 1 retry still guards us.
 */
import { SPEC_FIELDS } from './fields';

export const PROMPT_VERSION = 'vehicle-spec-v1';

export function buildSystemPrompt(): string {
  return [
    'You are an Australian vehicle-specification researcher.',
    'You return manufacturer nameplate / compliance figures for a specific vehicle variant.',
    'Hard rules:',
    '- Return ONLY JSON matching the requested schema. No prose, no markdown.',
    '- For every field, return the EXACT figure or null. NEVER guess, never interpolate, never average.',
    '- Compliance-critical figures (GVM, GCM, axle limits, tow-ball, towing) must be the stamped manufacturer value or null — a GVM-upgrade kit value is NOT the factory figure.',
    '- confidence is HIGH only when you have an authoritative source (manufacturer/RedBook/government). Vendor/forum/estimate => LOW.',
    '- sourceUrl must be the page the figure came from, or null.',
  ].join('\n');
}

export function buildUserPrompt(input: {
  makeName: string;
  modelName: string;
  variantName?: string | null;
  yearFrom: number;
  yearTo?: number | null;
  market?: string;
}): string {
  const fieldLines = SPEC_FIELDS.map(
    (f) =>
      `- ${f.key} (${f.label}${f.unit ? `, ${f.unit}` : ''})${
        f.isComplianceCritical ? ' [COMPLIANCE-CRITICAL]' : ''
      }: ${f.hint}`,
  ).join('\n');

  const year = input.yearTo
    ? `${input.yearFrom}-${input.yearTo}`
    : `${input.yearFrom}`;

  return [
    `Vehicle: ${year} ${input.makeName} ${input.modelName}${
      input.variantName ? ` ${input.variantName}` : ''
    } (market ${input.market ?? 'AU'}).`,
    '',
    'Return a JSON object: { "fields": { <fieldKey>: { "value": <number|string|null>, "confidence": "HIGH"|"MEDIUM"|"LOW"|null, "sourceUrl": <string|null> } } }',
    '',
    'Fields to populate (omit a field or use null when unknown — do NOT guess):',
    fieldLines,
  ].join('\n');
}

/**
 * OpenAI-compatible json_schema for the response. Values permit number|string|
 * null so a model can emit a bare integer for numeric fields.
 */
export function buildResponseJsonSchema(): Record<string, unknown> {
  const fieldSchema = {
    type: 'object',
    properties: {
      value: { type: ['number', 'string', 'null'] },
      confidence: {
        type: ['string', 'null'],
        enum: ['HIGH', 'MEDIUM', 'LOW', null],
      },
      sourceUrl: { type: ['string', 'null'] },
    },
    required: ['value'],
    additionalProperties: false,
  };
  return {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        properties: Object.fromEntries(
          SPEC_FIELDS.map((f) => [f.key, fieldSchema]),
        ),
        additionalProperties: false,
      },
    },
    required: ['fields'],
    additionalProperties: false,
  };
}
