import { readFileSync } from 'fs';
import { join } from 'path';
import {
  getJwtSecret,
  DEV_JWT_SECRET,
  __resetGeneratedProdSecretForTests,
} from './jwt-secret';

describe('getJwtSecret', () => {
  const original = { secret: process.env.JWT_SECRET, env: process.env.NODE_ENV };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetGeneratedProdSecretForTests();
    warnSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.JWT_SECRET = original.secret;
    process.env.NODE_ENV = original.env;
    warnSpy.mockRestore();
  });

  it('returns a strong JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'this-is-a-long-enough-secret';
    process.env.NODE_ENV = 'production';
    expect(getJwtSecret()).toBe('this-is-a-long-enough-secret');
  });

  it('generates a strong random secret in production when missing (no crash, warns)', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    const s = getJwtSecret();
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThanOrEqual(16);
    expect(s).not.toBe(DEV_JWT_SECRET);
    // Stable within the process (sign and verify must match).
    expect(getJwtSecret()).toBe(s);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('generates (not the literal) in production when JWT_SECRET is too short', () => {
    process.env.JWT_SECRET = 'short';
    process.env.NODE_ENV = 'production';
    const s = getJwtSecret();
    expect(s).not.toBe('short');
    expect(s.length).toBeGreaterThanOrEqual(16);
  });

  it('falls back to an explicit dev default outside production', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    expect(getJwtSecret()).toBe(DEV_JWT_SECRET);
  });
});

/**
 * Anti-regression guard: scans the auth wiring for any hardcoded JWT secret
 * fallback (e.g. `process.env.JWT_SECRET || 'secretKey'`). If this fails, an
 * insecure fallback was re-introduced — fix it, do not weaken this test.
 */
describe('no hardcoded JWT secret fallback', () => {
  const authDir = join(__dirname, '..', '..', 'modules', 'auth');
  const files = [
    join(authDir, 'auth.module.ts'),
    join(authDir, 'strategies', 'jwt.strategy.ts'),
  ];
  // Matches `JWT_SECRET || '...'` / `JWT_SECRET ?? "..."` with any literal.
  const FALLBACK = /JWT_SECRET\s*(\|\||\?\?)\s*['"`]/;

  it.each(files)('%s uses getJwtSecret() and no inline fallback', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toMatch(/getJwtSecret/);
    expect(FALLBACK.test(src)).toBe(false);
  });
});
