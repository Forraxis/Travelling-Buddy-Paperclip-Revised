import { describe, it, expect } from 'vitest';
import { MockSpecFetchProvider } from '../providers/mock';
import { QwenSpecFetchProvider } from '../providers/qwen';
import { ClaudeSpecFetchProvider } from '../providers/claude';
import { getSpecFetchProvider } from '../index';
import { normalizeProviderResponse } from '../normalize';
import { ProviderResponseSchema } from '../types';
import { COMPLIANCE_CRITICAL_FIELDS, SPEC_FIELD_KEYS } from '../fields';

const LC = {
  makeName: 'Toyota',
  modelName: 'LandCruiser 100',
  variantName: 'GXL 4.2TD',
  yearFrom: 2005,
};

describe('MockSpecFetchProvider', () => {
  it('returns the LandCruiser fixture with validated, catalogue-only fields', async () => {
    const result = await new MockSpecFetchProvider().fetchVehicleSpec(LC);
    expect(result.provider).toBe('MOCK');
    // Every returned field is a known catalogue field.
    for (const f of result.fields) {
      expect(SPEC_FIELD_KEYS).toContain(f.field);
    }
    const byKey = Object.fromEntries(result.fields.map((f) => [f.field, f]));
    expect(byKey.gvmKg.value).toBe('3260');
    expect(byKey.gvmKg.confidence).toBe('HIGH');
    expect(byKey.gcmKg.value).toBe('6760');
  });

  it('marks the hard-to-source axle limits LOW + vendor-only (the gate target)', async () => {
    const result = await new MockSpecFetchProvider().fetchVehicleSpec(LC);
    const byKey = Object.fromEntries(result.fields.map((f) => [f.field, f]));
    expect(byKey.frontAxleLimitKg.confidence).toBe('LOW');
    expect(byKey.rearAxleLimitKg.confidence).toBe('LOW');
    // ...and they ARE compliance-critical.
    expect(COMPLIANCE_CRITICAL_FIELDS.has('frontAxleLimitKg')).toBe(true);
    expect(COMPLIANCE_CRITICAL_FIELDS.has('rearAxleLimitKg')).toBe(true);
  });

  it('returns nulls (never guesses) for an unknown vehicle', async () => {
    const result = await new MockSpecFetchProvider().fetchVehicleSpec({
      makeName: 'Acme',
      modelName: 'Imaginary 9000',
      yearFrom: 2021,
    });
    for (const f of result.fields) {
      expect(f.value).toBeNull();
      expect(f.confidence).toBeNull();
    }
  });
});

describe('normalizeProviderResponse — null-not-guess + drop-unknown', () => {
  it('keeps null values null and never coerces to 0', () => {
    const parsed = ProviderResponseSchema.parse({
      fields: {
        gvmKg: { value: 3260, confidence: 'HIGH', sourceUrl: 'https://x' },
        frontAxleLimitKg: { value: null, confidence: 'LOW', sourceUrl: null },
        rearAxleLimitKg: { value: '', confidence: 'LOW' },
      },
    });
    const fields = normalizeProviderResponse(parsed);
    const byKey = Object.fromEntries(fields.map((f) => [f.field, f]));
    expect(byKey.gvmKg.value).toBe('3260');
    // null stays null...
    expect(byKey.frontAxleLimitKg.value).toBeNull();
    // ...and so does empty-string; neither becomes 0.
    expect(byKey.rearAxleLimitKg.value).toBeNull();
    // a null value carries no confidence.
    expect(byKey.frontAxleLimitKg.confidence).toBeNull();
  });

  it('drops keys that are not in the catalogue', () => {
    const parsed = ProviderResponseSchema.parse({
      fields: {
        gvmKg: { value: 3000 },
        somethingTheModelInvented: { value: 'lol', confidence: 'HIGH' },
      },
    });
    const fields = normalizeProviderResponse(parsed);
    expect(fields.map((f) => f.field)).toEqual(['gvmKg']);
  });
});

describe('QwenSpecFetchProvider — stubbed HTTP, never live', () => {
  function stubResponse(content: string): typeof fetch {
    return (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;
  }

  it('parses a well-formed completion into normalized fields', async () => {
    const provider = new QwenSpecFetchProvider({
      baseUrl: 'http://stub',
      fetchImpl: stubResponse(
        JSON.stringify({
          fields: {
            gvmKg: { value: 3260, confidence: 'HIGH', sourceUrl: 'https://x' },
            frontAxleLimitKg: {
              value: null,
              confidence: null,
              sourceUrl: null,
            },
          },
        }),
      ),
    });
    const result = await provider.fetchVehicleSpec(LC);
    expect(result.provider).toBe('QWEN');
    const byKey = Object.fromEntries(result.fields.map((f) => [f.field, f]));
    expect(byKey.gvmKg.value).toBe('3260');
    expect(byKey.frontAxleLimitKg.value).toBeNull();
  });

  it('strips a <think> block and ```json fences before parsing', async () => {
    const provider = new QwenSpecFetchProvider({
      baseUrl: 'http://stub',
      fetchImpl: stubResponse(
        '<think>let me reason</think>\n```json\n{"fields":{"gvmKg":{"value":3000}}}\n```',
      ),
    });
    const result = await provider.fetchVehicleSpec(LC);
    expect(result.fields[0]).toMatchObject({ field: 'gvmKg', value: '3000' });
  });

  it('retries once then throws on persistent garbage', async () => {
    let calls = 0;
    const provider = new QwenSpecFetchProvider({
      baseUrl: 'http://stub',
      fetchImpl: (async () => {
        calls++;
        return new Response('not json', { status: 200 });
      }) as unknown as typeof fetch,
    });
    await expect(provider.fetchVehicleSpec(LC)).rejects.toThrow(/after retry/);
    expect(calls).toBe(2);
  });

  it('surfaces a non-200 as an error', async () => {
    const provider = new QwenSpecFetchProvider({
      baseUrl: 'http://stub',
      fetchImpl: (async () =>
        new Response('upstream down', {
          status: 503,
        })) as unknown as typeof fetch,
    });
    await expect(provider.fetchVehicleSpec(LC)).rejects.toThrow();
  });
});

describe('provider registry', () => {
  it('defaults to the mock provider', () => {
    expect(getSpecFetchProvider().id).toBe('MOCK');
    expect(getSpecFetchProvider('QWEN')).toBeInstanceOf(QwenSpecFetchProvider);
    expect(getSpecFetchProvider('CLAUDE')).toBeInstanceOf(
      ClaudeSpecFetchProvider,
    );
  });

  it('claude provider is a stub that refuses to run', async () => {
    await expect(
      new ClaudeSpecFetchProvider().fetchVehicleSpec(LC),
    ).rejects.toThrow(/not implemented/);
  });
});
