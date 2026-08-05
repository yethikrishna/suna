import { describe, expect, test } from 'bun:test';

import {
  buildBrokerPolicy,
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
  test('offers the HTTPS broker and keeps transparent egress unavailable', () => {
    const options = secretDeliveryOptions('runtime', 'available');
    expect(options.map(({ strategy, disabled }) => ({ strategy, disabled }))).toEqual([
      { strategy: 'runtime', disabled: false },
      { strategy: 'broker', disabled: false },
      { strategy: 'egress', disabled: true },
      { strategy: 'denied', disabled: false },
    ]);
  });

  test('keeps the broker available and transparent egress disabled', () => {
    expect(secretDeliveryOptions('broker', 'available')[1]?.disabled).toBe(false);
    expect(secretDeliveryOptions('egress', 'available')[2]?.disabled).toBe(true);
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
        brokerPolicyValid: false,
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
        brokerPolicyValid: false,
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
        brokerPolicyValid: false,
      }),
    ).toBe(false);
  });

  test('requires a complete broker policy', () => {
    expect(
      canSaveSecretDelivery({
        isEdit: true,
        key: 'LOCAL_TEST_KEY',
        value: '',
        requiresValue: false,
        requiresRotation: false,
        currentStrategy: 'runtime',
        nextStrategy: 'broker',
        brokerPolicyValid: false,
      }),
    ).toBe(false);
    expect(
      canSaveSecretDelivery({
        isEdit: true,
        key: 'LOCAL_TEST_KEY',
        value: '',
        requiresValue: false,
        requiresRotation: false,
        currentStrategy: 'runtime',
        nextStrategy: 'broker',
        brokerPolicyValid: true,
      }),
    ).toBe(true);
  });
});

describe('buildBrokerPolicy', () => {
  test('normalizes hosts and methods into strict broker rules', () => {
    expect(
      buildBrokerPolicy({
        hosts: ' api.example.com, *.example.com ',
        methods: 'post, GET',
        path: '/v1/*',
        injectionKind: 'header',
        injectionTarget: 'Authorization',
        template: 'Bearer {{secret}}',
      }),
    ).toEqual({
      backend: 'kortix_fetch',
      rules: [
        { host: 'api.example.com', methods: ['POST', 'GET'], path: '/v1/*' },
        { host: '*.example.com', methods: ['POST', 'GET'], path: '/v1/*' },
      ],
      inject: { kind: 'header', name: 'Authorization', template: 'Bearer {{secret}}' },
      on_no_match: 'deny',
      tls: 'terminate',
    });
  });

  test('rejects missing hosts, invalid methods, and an empty injection target', () => {
    const base = {
      hosts: 'api.example.com',
      methods: 'POST',
      path: '/v1/*',
      injectionKind: 'header' as const,
      injectionTarget: 'authorization',
      template: '',
    };
    expect(buildBrokerPolicy({ ...base, hosts: '' })).toBeNull();
    expect(buildBrokerPolicy({ ...base, methods: 'TRACE' })).toBeNull();
    expect(buildBrokerPolicy({ ...base, injectionTarget: '' })).toBeNull();
  });
});
