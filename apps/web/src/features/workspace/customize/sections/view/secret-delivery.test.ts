import { describe, expect, test } from 'bun:test';

import {
  canSaveSecretDelivery,
  secretDeliveryOptions,
  secretDeliveryPresentation,
} from './secret-delivery';

describe('secretDeliveryPresentation', () => {
  test('states that runtime secrets are readable inside the sandbox', () => {
    expect(secretDeliveryPresentation('runtime')).toEqual({
      label: 'Sandbox',
      description: 'Available to agent code and commands as an environment variable.',
      tone: 'warning',
    });
  });

  test('states that denied secrets are stored but unavailable', () => {
    expect(secretDeliveryPresentation('denied')).toEqual({
      label: 'Disabled',
      description: 'Stored securely, but unavailable to sessions and Kortix services.',
      tone: 'outline',
    });
  });

  test('describes broker and egress without claiming sandbox access', () => {
    expect(secretDeliveryPresentation('broker').description).toBe(
      'Used by an approved Kortix service without entering the sandbox.',
    );
    expect(secretDeliveryPresentation('egress').description).toBe(
      'Added to approved outbound requests at the network boundary.',
    );
  });
});

describe('secretDeliveryOptions', () => {
  test('offers runtime and denied while server adapters are unavailable', () => {
    const options = secretDeliveryOptions('runtime', 'available');
    expect(options.map(({ strategy, disabled }) => ({ strategy, disabled }))).toEqual([
      { strategy: 'runtime', disabled: false },
      { strategy: 'broker', disabled: true },
      { strategy: 'egress', disabled: true },
      { strategy: 'denied', disabled: false },
    ]);
  });

  test('keeps a selected non-runtime policy visible when its adapter is available', () => {
    expect(secretDeliveryOptions('broker', 'available')[1]?.disabled).toBe(false);
    expect(secretDeliveryOptions('egress', 'available')[2]?.disabled).toBe(false);
  });

  test('disables a selected non-runtime policy when the server marks it unavailable', () => {
    expect(secretDeliveryOptions('broker', 'unavailable')[1]?.disabled).toBe(true);
  });
});

describe('canSaveSecretDelivery', () => {
  test('requires a replacement value before restoring sandbox access', () => {
    expect(
      canSaveSecretDelivery({
        isEdit: true,
        key: 'LOCAL_TEST_KEY',
        value: '',
        requiresValue: false,
        requiresRotation: true,
        currentStrategy: 'denied',
        nextStrategy: 'runtime',
      }),
    ).toBe(false);
  });

  test('allows sandbox access after a replacement value is entered', () => {
    expect(
      canSaveSecretDelivery({
        isEdit: true,
        key: 'LOCAL_TEST_KEY',
        value: 'replacement',
        requiresValue: false,
        requiresRotation: true,
        currentStrategy: 'denied',
        nextStrategy: 'runtime',
      }),
    ).toBe(true);
  });

  test('requires a changed value or delivery strategy for an existing secret', () => {
    expect(
      canSaveSecretDelivery({
        isEdit: true,
        key: 'LOCAL_TEST_KEY',
        value: '',
        requiresValue: false,
        requiresRotation: false,
        currentStrategy: 'runtime',
        nextStrategy: 'runtime',
      }),
    ).toBe(false);
  });
});
