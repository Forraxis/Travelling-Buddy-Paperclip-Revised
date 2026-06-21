/**
 * The Claude provider — the GROUNDED spec-fetch path (Opus 4.8 + server-side
 * web search + per-field citations). This is the *real data source*: unlike the
 * ungrounded Qwen path, a web-grounded figure carries a source URL that is a
 * genuine corroboration signal.
 *
 * It still obeys every trust rule: output lands ESTIMATE-pending-plate, the
 * self-reported `confidence` is for display/triage only (never a gate), and a
 * value is the stamped manufacturer figure or `null` — never a guess, never a
 * GVM-upgrade-kit number (see ../gating.ts and VEHICLE_DATA_SOURCES.md).
 *
 * Mechanics:
 *  - Reuses the shared prompt + JSON-schema contract (../prompt) so it never
 *    drifts from Qwen / the storable columns.
 *  - Grounds with the server-side `web_search_20260209` tool, capped at
 *    `maxSearchUses` (default 5) to bound cost (~$0.01/search + tokens).
 *  - Returns structured output via a custom tool `record_vehicle_specs` whose
 *    input_schema IS `buildResponseJsonSchema()`. (We deliberately do NOT use
 *    `output_config.format` — structured outputs 400 when combined with the
 *    citations web_search emits.) The tool input is Zod-validated and run through
 *    `normalizeProviderResponse`, exactly like the Qwen path.
 *  - Manual agentic loop: resumes on `pause_turn` (server-side search iteration
 *    cap) and force-calls the record tool if the model answers in prose.
 *
 * The Anthropic client is injectable so tests stub it and the network is never
 * touched. Live use requires `ANTHROPIC_API_KEY` and is gated behind the batch
 * job / `SPEC_FETCH_LIVE_ENABLED` — it is never called from request paths.
 */
import Anthropic from '@anthropic-ai/sdk';
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

const DEFAULT_MODEL = 'claude-opus-4-8';
const DEFAULT_MAX_SEARCH_USES = 5;
const RECORD_TOOL = 'record_vehicle_specs';
// Turn 0 lets the model search freely and (usually) call the record tool; from
// turn 1 we FORCE the record tool so it can't keep re-searching across many
// `pause_turn` resends (which is slow and burns budget — a LandCruiser took ~5min
// at 8 free turns). 3 is a hard ceiling.
const MAX_TURNS = 3;
const REQUEST_TIMEOUT_MS = 180_000;

/** The slice of the Anthropic SDK we depend on — lets tests pass a stub. */
export interface AnthropicLike {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
    ): Promise<Anthropic.Message>;
  };
}

export interface ClaudeProviderOptions {
  model?: string;
  maxSearchUses?: number;
  /** Injectable client for tests; defaults to a real `new Anthropic()`. */
  client?: AnthropicLike;
}

export class ClaudeSpecFetchProvider implements SpecFetchProvider {
  readonly id = 'CLAUDE' as const;
  private readonly model: string;
  private readonly maxSearchUses: number;
  private readonly clientOverride?: AnthropicLike;

  constructor(opts: ClaudeProviderOptions = {}) {
    this.model = opts.model ?? DEFAULT_MODEL;
    this.maxSearchUses = opts.maxSearchUses ?? DEFAULT_MAX_SEARCH_USES;
    this.clientOverride = opts.client;
  }

  private client(): AnthropicLike {
    // Reads ANTHROPIC_API_KEY from the environment (never hardcode a key).
    return (
      this.clientOverride ??
      new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 2 })
    );
  }

  async fetchVehicleSpec(input: SpecFetchInput): Promise<SpecFetchResult> {
    const client = this.client();

    const webSearch = {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: this.maxSearchUses,
    };
    const recordTool = {
      name: RECORD_TOOL,
      description:
        'Record the researched vehicle specification. Call this exactly once, ' +
        'after searching, with every field you could verify (null when unknown).',
      input_schema: buildResponseJsonSchema() as Anthropic.Tool.InputSchema,
    };

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content:
          buildUserPrompt(input) +
          `\n\nFirst use web_search to find authoritative AU sources, then call the ` +
          `${RECORD_TOOL} tool with your findings. Do not answer in prose.`,
      },
    ];

    let recordInput: unknown = null;
    const usages: Anthropic.Usage[] = [];
    let providerModel = this.model;

    for (let turn = 0; turn < MAX_TURNS && recordInput === null; turn += 1) {
      // Turn 0 is free (search + record); from turn 1 force the record tool so the
      // model can't keep re-searching across resends.
      const forceRecord = turn >= 1;
      const response = await client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: buildSystemPrompt(),
        tools: [webSearch, recordTool] as unknown as Anthropic.ToolUnion[],
        tool_choice: forceRecord
          ? { type: 'tool', name: RECORD_TOOL }
          : { type: 'auto' },
        messages,
      });
      usages.push(response.usage);
      providerModel = response.model;

      const recordBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock =>
          b.type === 'tool_use' && b.name === RECORD_TOOL,
      );
      if (recordBlock) {
        recordInput = recordBlock.input;
        break;
      }

      // Server-side search paused mid-loop, or the model replied in prose →
      // append its turn and continue (next iteration nudges / forces the tool).
      messages.push({ role: 'assistant', content: response.content });
      if (response.stop_reason !== 'pause_turn') {
        messages.push({
          role: 'user',
          content: `Now call the ${RECORD_TOOL} tool with the figures you found.`,
        });
      }
    }

    const parsed = ProviderResponseSchema.safeParse(recordInput);
    const fields = parsed.success ? normalizeProviderResponse(parsed.data) : [];

    // Sum usage across turns for cost reporting; surface raw for auditing.
    const usage = usages.reduce(
      (a, u) => ({
        input_tokens: a.input_tokens + (u.input_tokens ?? 0),
        output_tokens: a.output_tokens + (u.output_tokens ?? 0),
        web_search_requests:
          a.web_search_requests + (u.server_tool_use?.web_search_requests ?? 0),
      }),
      { input_tokens: 0, output_tokens: 0, web_search_requests: 0 },
    );

    return {
      provider: 'CLAUDE',
      providerModel,
      promptVersion: PROMPT_VERSION,
      fields,
      raw: { recordInput, usage, turns: usages.length, valid: parsed.success },
    };
  }
}
