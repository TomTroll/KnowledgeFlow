// packages/obsidian-plugin/src/tests/auth.test.ts
// Tests for the auth module — Bearer token hashing and validation.
// These are pure-function tests; no HTTP or Obsidian APIs involved.

import { describe, it, expect } from 'vitest';
import { hashToken, validateBearer } from '../auth';

describe('hashToken', () => {
  it('produces a consistent 64-character hex SHA-256 digest', async () => {
    const hash = await hashToken('my-secret-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('returns the same hash for the same input', async () => {
    const hash1 = await hashToken('same-token');
    const hash2 = await hashToken('same-token');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', async () => {
    const hash1 = await hashToken('token-a');
    const hash2 = await hashToken('token-b');
    expect(hash1).not.toBe(hash2);
  });
});

describe('validateBearer', () => {
  it('returns true when the raw token matches the stored hash', async () => {
    const rawToken = 'abc-123-valid-uuid';
    const storedHash = await hashToken(rawToken);
    const result = await validateBearer(`Bearer ${rawToken}`, storedHash);
    expect(result).toBe(true);
  });

  it('returns false when the token is tampered', async () => {
    const rawToken = 'abc-123-valid-uuid';
    const storedHash = await hashToken(rawToken);
    const result = await validateBearer('Bearer tampered-token', storedHash);
    expect(result).toBe(false);
  });

  it('returns false when the Authorization header is missing', async () => {
    const storedHash = await hashToken('some-token');
    const result = await validateBearer(undefined, storedHash);
    expect(result).toBe(false);
  });

  it('returns false when the header format is wrong (no Bearer prefix)', async () => {
    const rawToken = 'abc-123-valid-uuid';
    const storedHash = await hashToken(rawToken);
    const result = await validateBearer(rawToken, storedHash); // missing "Bearer "
    expect(result).toBe(false);
  });

  it('returns false when the stored hash is empty (unconfigured plugin)', async () => {
    const result = await validateBearer('Bearer some-token', '');
    expect(result).toBe(false);
  });
});
