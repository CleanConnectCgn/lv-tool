import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

let encryptToken, decryptToken;

beforeAll(async () => {
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  const mod = await import('./crypto.js');
  encryptToken = mod.encryptToken;
  decryptToken = mod.decryptToken;
});

describe('encryptToken/decryptToken', () => {
  it('round-trips a plain text token', () => {
    const stored = encryptToken('ya29.mein-google-access-token');
    expect(stored).not.toContain('ya29');
    expect(decryptToken(stored)).toBe('ya29.mein-google-access-token');
  });

  it('returns null for null input instead of throwing', () => {
    expect(encryptToken(null)).toBeNull();
    expect(decryptToken(null)).toBeNull();
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptToken('gleicher-text');
    const b = encryptToken('gleicher-text');
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe('gleicher-text');
    expect(decryptToken(b)).toBe('gleicher-text');
  });

  it('fails to decrypt if the stored value was tampered with', () => {
    const stored = encryptToken('geheim');
    const [iv, tag, data] = stored.split('.');
    const tampered = `${iv}.${tag}.${Buffer.from('anderer-text').toString('base64')}`;
    expect(() => decryptToken(tampered)).toThrow();
  });
});
