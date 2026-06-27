import { describe, expect, it } from 'vitest';
import type { PickerVariant } from '../types';
import {
  displayYearSpan,
  variantTitle,
  variantHeading,
  isCrypticRow,
  byCleanThenYear,
} from '../display';

const NOW = new Date().getFullYear();

function v(p: Partial<PickerVariant>): PickerVariant {
  return {
    id: 'x',
    name: 'Name',
    yearFrom: 2020,
    yearTo: 2020,
    isCurrentProduction: false,
    entityType: 'vehicle',
    makeId: 'm',
    makeName: 'Make',
    modelId: 'md',
    modelName: 'Model',
    ...p,
  };
}

describe('displayYearSpan', () => {
  it('caps the upper bound at the current year', () => {
    expect(displayYearSpan(v({ yearFrom: 2021, yearTo: 2031 }))).toBe(
      `2021–${NOW}`,
    );
  });
  it('keeps past ranges intact', () => {
    expect(displayYearSpan(v({ yearFrom: 2015, yearTo: 2020 }))).toBe(
      '2015–2020',
    );
  });
  it('collapses a single year', () => {
    expect(displayYearSpan(v({ yearFrom: 2011, yearTo: 2011 }))).toBe('2011');
  });
  it('shows present for current production', () => {
    expect(
      displayYearSpan(
        v({ yearFrom: 2021, yearTo: 2031, isCurrentProduction: true }),
      ),
    ).toBe('2021–present');
  });
});

describe('variantTitle', () => {
  it('composes a vehicle facet name from a cryptic code', () => {
    expect(
      variantTitle(
        v({
          name: 'DC PU 4WD AT ST-X (#054)',
          badge: 'ST-X',
          cabType: 'DUAL_CAB',
          driveType: 'FOUR_WHEEL_DRIVE',
          transmission: 'Auto',
        }),
      ),
    ).toBe('ST-X Dual Cab 4x4 Auto');
  });
  it('leaves a caravan name as-is', () => {
    expect(
      variantTitle(
        v({ entityType: 'caravan', name: 'Discovery 2011 (17-55)' }),
      ),
    ).toBe('Discovery 2011 (17-55)');
  });
});

describe('variantHeading', () => {
  it('does not repeat the model for caravans', () => {
    expect(
      variantHeading(
        v({
          entityType: 'caravan',
          makeName: 'Jayco',
          modelName: 'Discovery',
          name: 'Discovery 2011 (17-55)',
        }),
      ),
    ).toBe('Jayco Discovery 2011 (17-55)');
  });
  it('uses make + model + facet label for vehicles', () => {
    expect(
      variantHeading(
        v({
          makeName: 'Nissan',
          modelName: 'Navara',
          name: 'DC PU 4WD AT ST-X (#054)',
          badge: 'ST-X',
          cabType: 'DUAL_CAB',
          driveType: 'FOUR_WHEEL_DRIVE',
          transmission: 'Auto',
        }),
      ),
    ).toBe('Nissan Navara ST-X Dual Cab 4x4 Auto');
  });
  it('drops a leading model token the raw name repeats', () => {
    expect(
      variantHeading(
        v({
          makeName: 'Toyota',
          modelName: 'HiLux',
          name: 'Hilux (base)',
        }),
      ),
    ).toBe('Toyota HiLux (base)');
  });
});

describe('isCrypticRow / byCleanThenYear', () => {
  const clean = v({
    name: 'DC PU 4WD AT ST-X',
    badge: 'ST-X',
    cabType: 'DUAL_CAB',
    driveType: 'FOUR_WHEEL_DRIVE',
    transmission: 'Auto',
    yearFrom: 2021,
  });
  const cryptic = v({ name: 'LM2TJLBPDR8', yearFrom: 2025 });

  it('flags only un-named code rows', () => {
    expect(isCrypticRow(clean)).toBe(false);
    expect(isCrypticRow(cryptic)).toBe(true);
  });
  it('sorts clean rows before cryptic ones despite newer year', () => {
    const sorted = [cryptic, clean].sort(byCleanThenYear);
    expect(sorted[0]).toBe(clean);
    expect(sorted[1]).toBe(cryptic);
  });
});
