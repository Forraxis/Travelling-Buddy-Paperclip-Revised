import { describe, it, expect } from 'vitest';
import { computeFlow, stepsFor } from '../facet-steps';
import type { PickerVariant } from '../types';

// Minimal vehicle-variant factory — only the fields the facet steps read.
function v(p: Partial<PickerVariant>): PickerVariant {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'x',
    yearFrom: 2008,
    yearTo: 2008,
    isCurrentProduction: false,
    entityType: 'vehicle',
    makeId: 'm',
    makeName: 'Nissan',
    modelId: 'md',
    modelName: 'Navara',
    cabType: 'DUAL_CAB',
    driveType: 'FOUR_WHEEL_DRIVE',
    ...p,
  };
}

const STEPS = stepsFor('vehicle');

describe('build-origin facet step', () => {
  it('auto-hides Origin when every variant shares one build (ships dark)', () => {
    // Two Dual-Cab 4x4 variants, both with NO buildOrigin → no Origin step ever.
    const variants = [v({ badge: 'ST' }), v({ badge: 'SL' })];
    const flow = computeFlow(variants, STEPS, {
      cab: 'DUAL_CAB',
      drive: 'FOUR_WHEEL_DRIVE',
    });
    // Next decision is Grade (badge), NOT Origin — origin had 0 options.
    expect(flow.activeStep?.key).not.toBe('origin');
  });

  it('surfaces Origin once a model-year carries >1 build', () => {
    const variants = [
      v({ badge: 'ST', buildOrigin: 'ES' }),
      v({ badge: 'ST', buildOrigin: 'TH' }),
    ];
    const flow = computeFlow(variants, STEPS, {
      cab: 'DUAL_CAB',
      drive: 'FOUR_WHEEL_DRIVE',
    });
    expect(flow.activeStep?.key).toBe('origin');
    expect(flow.activeOptions.map((o) => o.label).sort()).toEqual([
      '🇪🇸 Spain',
      '🇹🇭 Thailand',
    ]);
  });

  it('narrows to the chosen build', () => {
    const variants = [
      v({ badge: 'ST', buildOrigin: 'ES' }),
      v({ badge: 'ST', buildOrigin: 'TH' }),
    ];
    const flow = computeFlow(variants, STEPS, {
      cab: 'DUAL_CAB',
      drive: 'FOUR_WHEEL_DRIVE',
      origin: 'ES',
    });
    expect(flow.filtered).toHaveLength(1);
    expect(flow.filtered[0].buildOrigin).toBe('ES');
  });
});
