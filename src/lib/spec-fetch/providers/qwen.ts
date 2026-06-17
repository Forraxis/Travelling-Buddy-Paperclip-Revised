/**
 * The Qwen provider — a thin client for Tim's local llama.cpp OpenAI-compatible
 * server (default http://172.16.45.150:8082, no key, model qwen36-35b-a3b-q4).
 *
 * ⚠️ NEVER run live to seed real catalogue data (Rule 11 / handover). It exists
 * so the pipeline is real and unit-testable; tonight everything runs on the mock.
 * It is also UNGROUNDED — it has no web access and will confidently hallucinate
 * compliance numbers. Its output is ALWAYS admin-gated; its self-confidence is
 * never a gating signal (see ../gating.ts).
 *
 * Choices (per handover): plain chat (NO function-calling — the tool path hangs),
 * thinking disabled via the `/no_think` directive, output constrained with
 * `response_format: { type: 'json_schema' }`, AbortController ~120s timeout + 1
 * retry, then Zod-validated. The HTTP layer is injectable so tests stub it and
 * the client is never called live.
 */
import { z } from 'zod/v4';
import {
  PROMPT_VERSION,
  buildResponseJsonSchema,
  buildSystemPrompt,
  buildUserPrompt,
} from '../prompt';
import { normalizeProviderResponse } from '../normalize';
import { ProviderResponseSchema } from '../types';
import type {
  SpecFetchInput,
  SpecFetchProvider,
  SpecFetchResult,
} from '../types';

const DEFAULT_BASE_URL = 'http://172.16.45.150:8082';
const DEFAULT_MODEL = 'qwen36-35b-a3b-q4';
const TIMEOUT_MS = 120_000;

/** Minimal shape of an OpenAI-compatible chat completion we depend on. */
const ChatCompletionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
});

export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

export interface QwenProviderOptions {
  baseUrl?: string;
  model?: string;
  /** Injectable HTTP layer for tests; defaults to global fetch. */
  fetchImpl?: FetchImpl;
}

/** Strip ```json fences and a leading `<think>…</think>` block, if present. */
function extractJson(content: string): string {
  let s = content;
  const thinkEnd = s.lastIndexOf('</think>');
  if (thinkEnd !== -1) s = s.slice(thinkEnd + '</think>'.length);
  s = s
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  return s;
}

export class QwenSpecFetchProvider implements SpecFetchProvider {
  readonly id = 'QWEN' as const;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: FetchImpl;

  constructor(opts: QwenProviderOptions = {}) {
    this.baseUrl = (
      opts.baseUrl ??
      process.env.QWEN_BASE_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/$/, '');
    this.model = opts.model ?? process.env.QWEN_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  }

  private async callOnce(body: unknown): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Qwen API error ${res.status}: ${text}`);
      }
      const json = await res.json();
      const completion = ChatCompletionSchema.parse(json);
      return completion.choices[0].message.content;
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchVehicleSpec(input: SpecFetchInput): Promise<SpecFetchResult> {
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          // `/no_think` disables the reasoning block on Qwen3 chat builds.
          content: `/no_think\n${buildUserPrompt({
            makeName: input.makeName,
            modelName: input.modelName,
            variantName: input.variantName,
            yearFrom: input.yearFrom,
            yearTo: input.yearTo,
            market: input.market,
          })}`,
        },
      ],
      temperature: 0,
      max_tokens: 2048,
      // No tools/function-calling — the tool path hangs on this server.
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'vehicle_spec',
          schema: buildResponseJsonSchema(),
        },
      },
    };

    let lastErr: unknown;
    // 1 retry (2 attempts total) — the server is slow and occasionally drops.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const content = await this.callOnce(body);
        const parsed = ProviderResponseSchema.parse(
          JSON.parse(extractJson(content)),
        );
        return {
          provider: 'QWEN',
          providerModel: this.model,
          promptVersion: PROMPT_VERSION,
          fields: normalizeProviderResponse(parsed),
          raw: content,
        };
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(
      `Qwen spec fetch failed after retry: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`,
    );
  }
}
