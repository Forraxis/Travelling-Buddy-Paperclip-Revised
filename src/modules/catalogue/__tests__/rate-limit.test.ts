import { describe, it, expect } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

function makeRequest(ip = '127.0.0.1'): Request {
  return new Request('http://localhost/api/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const ip = `test-${Date.now()}-${Math.random()}`;
    const result = rateLimit(makeRequest(ip));
    expect(result).toBeNull();
  });

  it('blocks requests over the limit', () => {
    const ip = `flood-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 60; i++) {
      rateLimit(makeRequest(ip));
    }
    const result = rateLimit(makeRequest(ip));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it('includes Retry-After header on 429', async () => {
    const ip = `retry-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 60; i++) {
      rateLimit(makeRequest(ip));
    }
    const result = rateLimit(makeRequest(ip));
    expect(result).not.toBeNull();
    expect(result!.headers.get('Retry-After')).toBeTruthy();
    const body = await result!.json();
    expect(body.error).toContain('Too many requests');
  });
});
