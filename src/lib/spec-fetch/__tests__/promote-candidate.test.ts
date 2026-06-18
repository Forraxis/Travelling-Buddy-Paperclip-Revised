import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB: the gate is evaluated BEFORE any transaction, so a blocked
// promotion never touches $transaction — we assert exactly that.
const findUniqueOrThrow = vi.fn();
const $transaction = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    vehicleSpecCandidate: {
      findUniqueOrThrow: (...a: unknown[]) => findUniqueOrThrow(...a),
    },
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));

import { promoteSpecCandidate, PromotionGateError } from '../promote-candidate';

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cand-1',
    makeName: 'Nissan',
    modelName: 'Navara',
    variantName: 'ST-X (#030)',
    yearFrom: 2025,
    yearTo: 2025,
    market: 'AU',
    bodyType: null,
    status: 'PENDING',
    resultingVariantId: null,
    criticalOverrideById: null,
    criticalOverrideNote: null,
    fields: [
      // An uncorroborated compliance-critical field → blocks promotion.
      { field: 'gcmKg', value: '6000', adminValue: null, corroborated: false },
      {
        field: 'kerbWeightKg',
        value: '2100',
        adminValue: null,
        corroborated: true,
      },
    ],
    ...overrides,
  };
}

describe('promoteSpecCandidate gate enforcement', () => {
  beforeEach(() => {
    findUniqueOrThrow.mockReset();
    $transaction.mockReset();
  });

  it('throws PromotionGateError and never opens a transaction when a critical field is uncorroborated', async () => {
    findUniqueOrThrow.mockResolvedValue(candidate());
    await expect(
      promoteSpecCandidate('cand-1', 'user-1'),
    ).rejects.toBeInstanceOf(PromotionGateError);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('names the blocking field on the error', async () => {
    findUniqueOrThrow.mockResolvedValue(candidate());
    await expect(
      promoteSpecCandidate('cand-1', 'user-1'),
    ).rejects.toMatchObject({ blockingFields: ['gcmKg'] });
  });

  it('proceeds to the transaction once a critical override is recorded', async () => {
    findUniqueOrThrow.mockResolvedValue(
      candidate({ criticalOverrideById: 'admin-1' }),
    );
    $transaction.mockResolvedValue({
      variantId: 'v-1',
      created: true,
      patch: {},
      skipped: [],
    });
    const result = await promoteSpecCandidate('cand-1', 'user-1');
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(result.variantId).toBe('v-1');
  });
});
