import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB so the worker core is testable without Postgres.
const updateMock = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    vehicleSpecCandidate: { update: (...a: unknown[]) => updateMock(...a) },
  },
}));

import { runSpecFetchJob } from '../../workers/spec-fetch.worker';

const INPUT = { makeName: 'Toyota', modelName: 'LandCruiser 100', yearFrom: 2005 };

describe('runSpecFetchJob safety gate', () => {
  beforeEach(() => {
    updateMock.mockReset();
    delete process.env.SPEC_FETCH_LIVE_ENABLED;
  });

  it('no-ops for the MOCK provider (it never uses the queue)', async () => {
    const status = await runSpecFetchJob({
      candidateId: 'c1',
      providerId: 'MOCK',
      input: INPUT,
    });
    expect(status).toMatch(/skipped/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('refuses to call a model when the live gate is closed', async () => {
    const status = await runSpecFetchJob({
      candidateId: 'c1',
      providerId: 'QWEN',
      input: INPUT,
    });
    expect(status).toMatch(/gated/);
    // It records a fetchError and writes NO fields.
    expect(updateMock).toHaveBeenCalledTimes(1);
    const arg = updateMock.mock.calls[0][0];
    expect(arg.data.fetchError).toMatch(/disabled/i);
    expect(arg.data.fields).toBeUndefined();
  });
});
