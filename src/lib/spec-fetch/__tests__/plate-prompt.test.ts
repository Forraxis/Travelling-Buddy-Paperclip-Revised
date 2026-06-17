import { describe, it, expect } from 'vitest';
import {
  shouldPromptForMetric,
  decidePlatePrompt,
  type MetricProximity,
} from '../plate-prompt';

describe('shouldPromptForMetric — uncertainty × proximity', () => {
  it('does not prompt when the limit is verified, even if near it', () => {
    expect(
      shouldPromptForMetric({
        key: 'gvm',
        usageRatio: 0.99,
        limitEstimated: false,
      }),
    ).toBe(false);
  });

  it('does not prompt when far from an estimated limit', () => {
    expect(
      shouldPromptForMetric({
        key: 'gvm',
        usageRatio: 0.4,
        limitEstimated: true,
      }),
    ).toBe(false);
  });

  it('prompts when near AND the limit is estimated', () => {
    expect(
      shouldPromptForMetric({
        key: 'gvm',
        usageRatio: 0.95,
        limitEstimated: true,
      }),
    ).toBe(true);
  });
});

describe('decidePlatePrompt — picks the highest-stakes estimated metric', () => {
  it('returns the closest-to-limit estimated metric', () => {
    const metrics: MetricProximity[] = [
      { key: 'gvm', usageRatio: 0.92, limitEstimated: true },
      { key: 'rearAxle', usageRatio: 0.98, limitEstimated: true },
      { key: 'frontAxle', usageRatio: 0.99, limitEstimated: false }, // verified → ignored
    ];
    const d = decidePlatePrompt(metrics);
    expect(d.shouldPrompt).toBe(true);
    expect(d.reasonMetric).toBe('rearAxle');
  });

  it('does not prompt when nothing qualifies', () => {
    const d = decidePlatePrompt([
      { key: 'gvm', usageRatio: 0.5, limitEstimated: true },
      { key: 'gcm', usageRatio: 0.99, limitEstimated: false },
    ]);
    expect(d.shouldPrompt).toBe(false);
    expect(d.reasonMetric).toBeNull();
  });
});
