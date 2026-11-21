import { describe, expect, it } from 'vitest';
import { parseAuthUrl } from './authUrl';

describe('parseAuthUrl', () => {
  it('reads a PKCE code from the query', () => {
    expect(parseAuthUrl('badyet://auth/callback?code=abc123').code).toBe('abc123');
  });
  it('reads implicit tokens from the fragment', () => {
    const p = parseAuthUrl('badyet://auth/callback#access_token=a.b.c&refresh_token=r1&type=bearer');
    expect(p.access_token).toBe('a.b.c');
    expect(p.refresh_token).toBe('r1');
  });
  it('decodes error descriptions', () => {
    expect(parseAuthUrl('badyet://auth/callback?error=access_denied&error_description=Signups%20not%20allowed').error_description).toBe(
      'Signups not allowed',
    );
  });
  it('returns nothing for a bare url', () => {
    expect(parseAuthUrl('badyet://auth/callback')).toEqual({});
  });
});
