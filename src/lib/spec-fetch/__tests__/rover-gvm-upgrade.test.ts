import { describe, it, expect } from 'vitest';
import {
  buildGvmUpgradeData,
  resolveBaseVariant,
  routeGvmUpgrade,
  toSlug,
  type GvmUpgradeIndexInfo,
} from '../rover/gvm-upgrade';
import type { VariantSpecPatch } from '../promotion';

const baseIndex: GvmUpgradeIndexInfo = {
  baseMake: 'Toyota',
  baseModel: 'Hilux',
  modifier: 'ironman tmca',
  vtaNumber: 'VTA-066264',
  category: 'NB1',
  baseCategory: null,
};

describe('buildGvmUpgradeData', () => {
  it('lifts the upgrade figures from the patch (tow → maxTowingKg)', () => {
    const patch: VariantSpecPatch = {
      gvmKg: 3800,
      maxTowingCapacityKg: 3500,
      // a non-upgrade field is ignored:
      kerbWeightKg: 2121,
    };
    const data = buildGvmUpgradeData(patch, baseIndex);
    expect(data.gvmKg).toBe(3800);
    expect(data.maxTowingKg).toBe(3500);
    expect(data.modifierName).toBe('ironman tmca');
    expect(data.vtaNumber).toBe('VTA-066264');
    expect(data.sourceVtaNumber).toBe('VTA-066264');
  });

  it('leaves a limit null when the kit does not state it (overlay keeps factory)', () => {
    const data = buildGvmUpgradeData({ gvmKg: 3800 }, baseIndex);
    expect(data.gvmKg).toBe(3800);
    expect(data.gcmKg).toBeNull();
    expect(data.frontAxleLimitKg).toBeNull();
    expect(data.rearAxleLimitKg).toBeNull();
    expect(data.maxTowingKg).toBeNull();
  });

  it('addedMassKg is null (RVD does not state spring mass; P5 estimates it)', () => {
    const data = buildGvmUpgradeData({ gvmKg: 3800 }, baseIndex);
    expect(data.addedMassKg).toBeNull();
  });

  it('infers PRE_REGO_SECOND_STAGE when the goods category is bumped (NA → NB1)', () => {
    const data = buildGvmUpgradeData(
      { gvmKg: 3800 },
      { ...baseIndex, category: 'NB1', baseCategory: 'NA' },
    );
    expect(data.isPreRego).toBe(true);
    expect(data.pathway).toBe('PRE_REGO_SECOND_STAGE');
  });

  it('defaults to POST_REGO_SSM when there is no category bump', () => {
    const data = buildGvmUpgradeData(
      { gvmKg: 3800 },
      { ...baseIndex, category: 'NB1', baseCategory: 'NB1' },
    );
    expect(data.isPreRego).toBe(false);
    expect(data.pathway).toBe('POST_REGO_SSM');
  });

  it('falls back to the base make then a placeholder for a missing modifier name', () => {
    expect(
      buildGvmUpgradeData({}, { ...baseIndex, modifier: null }).modifierName,
    ).toBe('Toyota');
    expect(
      buildGvmUpgradeData({}, { ...baseIndex, modifier: null, baseMake: null })
        .modifierName,
    ).toBe('Unknown modifier');
  });
});

describe('toSlug', () => {
  it('matches the slug minted by promoteSpecCandidate', () => {
    expect(toSlug('Toyota')).toBe('toyota');
    expect(toSlug('Mercedes-Benz')).toBe('mercedes-benz');
    expect(toSlug('  D-Max RG1 ')).toBe('d-max-rg1');
  });
});

// ── DB routing (mocked Prisma client) ─────────────────────────────────────────
function fakeDb(opts: {
  make?: { id: string } | null;
  model?: { id: string } | null;
  variant?: { id: string } | null;
  existingUpgrade?: { id: string } | null;
}) {
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const db = {
    vehicleMake: {
      findUnique: async () => opts.make ?? null,
    },
    vehicleModel: {
      findUnique: async () => opts.model ?? null,
    },
    vehicleVariant: {
      findFirst: async () => opts.variant ?? null,
    },
    gvmUpgrade: {
      findFirst: async () => opts.existingUpgrade ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { id: 'gvm-new' };
      },
      update: async (args: { data: Record<string, unknown> }) => {
        updated.push(args.data);
        return { id: opts.existingUpgrade?.id ?? 'gvm-upd' };
      },
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: db as any, created, updated };
}

describe('resolveBaseVariant', () => {
  it('returns null when the base make/model is missing', async () => {
    const { db } = fakeDb({});
    expect(await resolveBaseVariant(db, null, 'Hilux')).toBeNull();
    expect(await resolveBaseVariant(db, 'Toyota', null)).toBeNull();
  });

  it('returns null when the model has no CATALOGUE variant', async () => {
    const { db } = fakeDb({
      make: { id: 'mk' },
      model: { id: 'md' },
      variant: null,
    });
    expect(await resolveBaseVariant(db, 'Toyota', 'Hilux')).toBeNull();
  });

  it('resolves the base variant by make → model → CATALOGUE variant', async () => {
    const { db } = fakeDb({
      make: { id: 'mk' },
      model: { id: 'md' },
      variant: { id: 'v-base' },
    });
    expect(await resolveBaseVariant(db, 'Toyota', 'Hilux')).toEqual({
      id: 'v-base',
    });
  });
});

describe('routeGvmUpgrade', () => {
  it('returns unattached (no fabrication) when the base is not in the catalogue', async () => {
    const { db, created } = fakeDb({ make: null });
    const res = await routeGvmUpgrade(db, { gvmKg: 3800 }, baseIndex);
    expect(res.unattached).toBe(true);
    expect(res.gvmUpgradeId).toBeNull();
    expect(res.baseVariantId).toBeNull();
    expect(res.note).toContain('not in catalogue');
    expect(created).toHaveLength(0);
  });

  it('creates a GvmUpgrade on the resolved base variant', async () => {
    const { db, created } = fakeDb({
      make: { id: 'mk' },
      model: { id: 'md' },
      variant: { id: 'v-base' },
      existingUpgrade: null,
    });
    const res = await routeGvmUpgrade(db, { gvmKg: 3800 }, baseIndex);
    expect(res.unattached).toBe(false);
    expect(res.baseVariantId).toBe('v-base');
    expect(res.gvmUpgradeId).toBe('gvm-new');
    expect(created).toHaveLength(1);
    expect(created[0].gvmKg).toBe(3800);
  });

  it('refreshes in place when an upgrade for the same VTA already exists', async () => {
    const { db, created, updated } = fakeDb({
      make: { id: 'mk' },
      model: { id: 'md' },
      variant: { id: 'v-base' },
      existingUpgrade: { id: 'gvm-old' },
    });
    const res = await routeGvmUpgrade(db, { gvmKg: 3900 }, baseIndex);
    expect(res.gvmUpgradeId).toBe('gvm-old');
    expect(created).toHaveLength(0);
    expect(updated).toHaveLength(1);
    expect(updated[0].gvmKg).toBe(3900);
  });
});
