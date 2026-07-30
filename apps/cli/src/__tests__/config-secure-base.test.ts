import { describe, expect, test } from 'bun:test';

import { secureRemoteBase } from '../api/config.ts';

describe('secureRemoteBase', () => {
  test('upgrades a remote http base to https — the case the redirect would break', () => {
    expect(secureRemoteBase('http://api.kortix.com')).toBe('https://api.kortix.com');
    expect(secureRemoteBase('http://kortix.example.com:8080/v1')).toBe(
      'https://kortix.example.com:8080/v1',
    );
  });

  test('leaves https and non-URLs alone', () => {
    expect(secureRemoteBase('https://api.kortix.com')).toBe('https://api.kortix.com');
    expect(secureRemoteBase('not a url')).toBe('not a url');
  });

  test('leaves loopback alone', () => {
    for (const base of [
      'http://localhost:3000',
      'http://127.0.0.1:8000',
      'http://0.0.0.0:8000',
      'http://api.localhost:8000',
    ]) {
      expect(secureRemoteBase(base)).toBe(base);
    }
  });

  // A self-host never reaches its API over a public name. Upgrading these to
  // https opens a TLS handshake against a cleartext port, and the only symptom
  // is an opaque "Unable to connect".
  test('leaves private hosts alone — container names, LAN/VPC addresses, private suffixes', () => {
    for (const base of [
      'http://kortix-api:8000', // compose service name (single label)
      'http://api:8000',
      'http://192.168.1.50:8000', // RFC1918
      'http://10.2.0.7:8000',
      'http://172.16.4.9:8000',
      'http://169.254.10.1:8000', // link-local
      'http://100.100.2.3:8000', // CGNAT (tailscale et al)
      'http://kortix.internal:8000',
      'http://box.local:8000',
      'http://nas.lan:8000',
      'http://host.home.arpa:8000',
    ]) {
      expect(secureRemoteBase(base)).toBe(base);
    }
  });

  test('does not mistake a public host for a private one', () => {
    // 172.32 is outside 172.16/12; 11.x and 192.169.x are public.
    expect(secureRemoteBase('http://172.32.0.1:8000')).toBe('https://172.32.0.1:8000');
    expect(secureRemoteBase('http://11.0.0.1:8000')).toBe('https://11.0.0.1:8000');
    expect(secureRemoteBase('http://192.169.1.1:8000')).toBe('https://192.169.1.1:8000');
    expect(secureRemoteBase('http://notlocal.com')).toBe('https://notlocal.com');
  });
});
