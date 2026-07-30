import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_STARTER_TEMPLATE_ID,
  EXPERIMENTAL_STARTER_TEMPLATE_ID,
  STABLE_STARTER_TEMPLATE_ID,
} from '@kortix/starter';

import { config } from '../../config';
import { acpStarterRefusal, starterScaffoldsAcpManifest } from './acp-runtime-gate';

describe('starterScaffoldsAcpManifest', () => {
  test('only the experimental multi-harness starter scaffolds a kortix_version 3 manifest', () => {
    expect(starterScaffoldsAcpManifest(EXPERIMENTAL_STARTER_TEMPLATE_ID)).toBe(true);
    expect(starterScaffoldsAcpManifest(STABLE_STARTER_TEMPLATE_ID)).toBe(false);
    expect(starterScaffoldsAcpManifest(DEFAULT_STARTER_TEMPLATE_ID)).toBe(false);
    expect(starterScaffoldsAcpManifest('minimal')).toBe(false);
  });

  test('an unknown or absent starter id resolves to the stable v2 default', () => {
    expect(starterScaffoldsAcpManifest(undefined)).toBe(false);
    expect(starterScaffoldsAcpManifest(null)).toBe(false);
    expect(starterScaffoldsAcpManifest('nope')).toBe(false);
  });
});

describe('acpStarterRefusal', () => {
  test('refuses a kortix_version 3 scaffold while ACP is off', () => {
    const refusal = acpStarterRefusal(EXPERIMENTAL_STARTER_TEMPLATE_ID, false);
    expect(refusal?.status).toBe(409);
    expect(refusal?.body.code).toBe('ACP_RUNTIME_DISABLED');
    expect(refusal?.body.error).toContain('KORTIX_ACP_RUNTIME');
    expect(refusal?.body.error).toContain('kortix_version 3');
  });

  test('allows a kortix_version 3 scaffold once an operator enables ACP', () => {
    expect(acpStarterRefusal(EXPERIMENTAL_STARTER_TEMPLATE_ID, true)).toBeNull();
  });

  test('never refuses the stable v2 starters, on or off', () => {
    for (const enabled of [true, false]) {
      expect(acpStarterRefusal(STABLE_STARTER_TEMPLATE_ID, enabled)).toBeNull();
      expect(acpStarterRefusal('minimal', enabled)).toBeNull();
      expect(acpStarterRefusal(undefined, enabled)).toBeNull();
    }
  });

  test('reads KORTIX_ACP_RUNTIME when no explicit state is passed, and it ships off', () => {
    expect(config.KORTIX_ACP_RUNTIME).toBe(false);
    expect(acpStarterRefusal(EXPERIMENTAL_STARTER_TEMPLATE_ID)?.status).toBe(409);
    expect(acpStarterRefusal(STABLE_STARTER_TEMPLATE_ID)).toBeNull();
  });
});
