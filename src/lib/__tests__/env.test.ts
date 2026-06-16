import { describe, it, expect } from 'vitest';
import { parseEnv } from '../env';

const prodBase = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  AUTH_SECRET: 'secret',
  GOOGLE_CLIENT_ID: 'gid',
  GOOGLE_CLIENT_SECRET: 'gsecret',
  NEXT_PUBLIC_SITE_URL: 'https://example.com',
};

describe('parseEnv', () => {
  it('accepts a complete production env', () => {
    expect(() => parseEnv(prodBase)).not.toThrow();
  });

  it('always requires DATABASE_URL', () => {
    expect(() => parseEnv({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL/);
  });

  it('is lenient in development (only DB required)', () => {
    const env = parseEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    });
    expect(env.AUTH_SECRET).toBeUndefined();
  });

  it('requires AUTH_SECRET + OAuth + site URL in production', () => {
    const { AUTH_SECRET, ...noSecret } = prodBase;
    void AUTH_SECRET;
    expect(() => parseEnv(noSecret)).toThrow(/AUTH_SECRET is required in production/);
  });

  it('rejects a partially-configured R2 set in production', () => {
    expect(() =>
      parseEnv({ ...prodBase, CLOUDFLARE_R2_ENDPOINT: 'https://r2.example.com' }),
    ).toThrow(/R2 config is incomplete/);
  });

  it('accepts a fully-configured R2 set', () => {
    expect(() =>
      parseEnv({
        ...prodBase,
        CLOUDFLARE_R2_ENDPOINT: 'https://r2.example.com',
        CLOUDFLARE_R2_ACCESS_KEY_ID: 'k',
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: 's',
        CLOUDFLARE_R2_BUCKET: 'b',
      }),
    ).not.toThrow();
  });
});
