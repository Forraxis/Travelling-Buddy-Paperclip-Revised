/**
 * The Claude provider — the FUTURE grounded path (Opus 4.8 + server-side web
 * search + citations). This is a STUB / interface placeholder only: per the
 * handover it is not built tonight (no SDK dep, no key used). It exists so the
 * provider registry and types are complete and the real implementation drops in
 * without touching callers.
 *
 * When built, this is the *real data source* (web-grounded → citations are a
 * genuine corroboration signal, unlike the ungrounded Qwen path). It must still
 * return per-field value/confidence/sourceUrl and obey null-not-guess.
 *
 * TODO(tim): implement with @anthropic-ai/sdk, web_search tool + structured
 * outputs, mapping citations → per-field sourceUrl. Needs ANTHROPIC_API_KEY.
 */
import type {
  SpecFetchInput,
  SpecFetchProvider,
  SpecFetchResult,
} from '../types';

export class ClaudeSpecFetchProvider implements SpecFetchProvider {
  readonly id = 'CLAUDE' as const;

  async fetchVehicleSpec(_input: SpecFetchInput): Promise<SpecFetchResult> {
    void _input;
    throw new Error(
      'ClaudeSpecFetchProvider is not implemented yet — the grounded Opus 4.8 + ' +
        'web-search path is scaffolded only. Set ANTHROPIC_API_KEY and implement ' +
        'before enabling (see TODO in src/lib/spec-fetch/providers/claude.ts).',
    );
  }
}
