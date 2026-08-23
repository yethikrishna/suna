import { describe, expect, test } from 'bun:test';
import { config } from '../config';
import {
  currentSessionSandboxUrl,
  runtimeRelayRepairDue,
  runtimeRelayRepairNeeded,
} from './routes/shared';

describe('active sandbox kortixd relay repair', () => {
  const now = Date.parse('2026-08-23T06:00:00.000Z');

  test('repairs immediately when the API relay URL rotated', () => {
    expect(runtimeRelayRepairDue({
      runtimeRelayRepairUrl: 'https://old.example',
      runtimeRelayRepairStartedAt: new Date(now - 1_000).toISOString(),
    }, 'https://new.example', now)).toBe(true);
  });

  test('coalesces browser polling during one repair attempt', () => {
    expect(runtimeRelayRepairDue({
      runtimeRelayRepairUrl: 'https://api.example',
      runtimeRelayRepairStartedAt: new Date(now - 29_999).toISOString(),
    }, 'https://api.example', now)).toBe(false);
  });

  test('retries a failed repair after the bounded cooldown', () => {
    expect(runtimeRelayRepairDue({
      runtimeRelayRepairUrl: 'https://api.example',
      runtimeRelayRepairStartedAt: new Date(now - 30_000).toISOString(),
    }, 'https://api.example', now)).toBe(true);
  });

  test('does not restart kortixd after its relay channel reconnects', () => {
    expect(runtimeRelayRepairNeeded({
      runtimeRelayRepairUrl: 'https://api.example',
      runtimeRelayRepairStartedAt: new Date(now - 30_000).toISOString(),
    }, 'https://api.example', true, now)).toBe(false);
  });

  test('rewrites a resumed session URL onto the current API relay', () => {
    const original = config.KORTIX_URL;
    config.KORTIX_URL = 'https://new-tunnel.example/v1';
    try {
      expect(currentSessionSandboxUrl('sbx_123')).toBe(
        'https://new-tunnel.example/v1/p/sbx_123/8000',
      );
    } finally {
      config.KORTIX_URL = original;
    }
  });
});
