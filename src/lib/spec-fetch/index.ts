/**
 * Public entry point for the vehicle-spec fetch pipeline. Resolve a provider by
 * id and fetch. The default provider is MOCK — real providers are opt-in so a
 * stray call can never hit a model or persist hallucinated data.
 */
import { MockSpecFetchProvider } from './providers/mock';
import { QwenSpecFetchProvider } from './providers/qwen';
import { ClaudeSpecFetchProvider } from './providers/claude';
import type { SpecFetchProvider, SpecFetchProviderId } from './types';

export * from './types';
export * from './fields';
export { normalizeProviderResponse } from './normalize';
export {
  PROMPT_VERSION,
  buildSystemPrompt,
  buildUserPrompt,
  buildResponseJsonSchema,
} from './prompt';
export { MockSpecFetchProvider } from './providers/mock';
export { QwenSpecFetchProvider } from './providers/qwen';
export { ClaudeSpecFetchProvider } from './providers/claude';

/**
 * Resolve a provider instance by id. MOCK is always safe. QWEN/CLAUDE construct
 * real clients but DO NOT call out until `fetchVehicleSpec` runs — and tonight
 * only MOCK is wired into the admin path.
 */
export function getSpecFetchProvider(
  id: SpecFetchProviderId = 'MOCK',
): SpecFetchProvider {
  switch (id) {
    case 'QWEN':
      return new QwenSpecFetchProvider();
    case 'CLAUDE':
      return new ClaudeSpecFetchProvider();
    case 'MOCK':
    default:
      return new MockSpecFetchProvider();
  }
}
