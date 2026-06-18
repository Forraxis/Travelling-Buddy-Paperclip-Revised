import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB so the route is testable without Postgres — the auth-gate and
// validation paths return before any DB call, and the 422 path is pure extraction.
vi.mock('@/lib/db', () => ({
  prisma: {
    roverDocument: {},
    vehicleSpecCandidate: {},
    $transaction: vi.fn(),
  },
}));

import { POST } from './route';

const TOKEN = 'test-secret-token';

function post(opts: { auth?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (opts.auth !== undefined) headers.authorization = opts.auth;
  return POST(
    new Request('http://localhost/api/rover/ingest', {
      method: 'POST',
      headers,
      body: JSON.stringify(opts.body ?? { detailHtml: '<div></div>' }),
    }),
  );
}

describe('POST /api/rover/ingest — auth gating', () => {
  beforeEach(() => {
    delete process.env.ROVER_INGEST_TOKEN;
  });

  it('returns 404 (invisible) when the token env is unset', async () => {
    const res = await post({ auth: `Bearer ${TOKEN}` });
    expect(res.status).toBe(404);
  });

  it('returns 401 when the bearer token is missing', async () => {
    process.env.ROVER_INGEST_TOKEN = TOKEN;
    const res = await post({});
    expect(res.status).toBe(401);
  });

  it('returns 401 when the bearer token mismatches', async () => {
    process.env.ROVER_INGEST_TOKEN = TOKEN;
    const res = await post({ auth: 'Bearer wrong-token' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for a non-string detailHtml once authorised', async () => {
    process.env.ROVER_INGEST_TOKEN = TOKEN;
    const res = await post({
      auth: `Bearer ${TOKEN}`,
      body: { detailHtml: 42 },
    });
    expect(res.status).toBe(400);
  });

  it('returns 422 when an authorised page contains no RVD document', async () => {
    process.env.ROVER_INGEST_TOKEN = TOKEN;
    const res = await post({
      auth: `Bearer ${TOKEN}`,
      body: { detailHtml: '<div>no download calls here</div>' },
    });
    expect(res.status).toBe(422);
  });
});
