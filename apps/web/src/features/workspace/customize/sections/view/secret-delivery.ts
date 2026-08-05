import type { SecretDeliveryStatus, SecretDeliveryStrategy } from '@kortix/sdk';

export type SecretDeliveryPresentation = {
  label: string;
  description: string;
  tone: 'warning' | 'secondary' | 'outline';
};

const PRESENTATIONS: Record<SecretDeliveryStrategy, SecretDeliveryPresentation> = {
  runtime: {
    label: 'Sandbox',
    description: 'Available to agent code and commands as an environment variable.',
    tone: 'warning',
  },
  broker: {
    label: 'Kortix service',
    description: 'Used by an approved Kortix service without entering the sandbox.',
    tone: 'secondary',
  },
  egress: {
    label: 'Network boundary',
    description: 'Added to approved outbound requests at the network boundary.',
    tone: 'secondary',
  },
  denied: {
    label: 'Disabled',
    description: 'Stored securely, but unavailable to sessions and Kortix services.',
    tone: 'outline',
  },
};

export function secretDeliveryPresentation(
  strategy: SecretDeliveryStrategy,
): SecretDeliveryPresentation {
  return PRESENTATIONS[strategy];
}

export type SecretDeliveryOption = SecretDeliveryPresentation & {
  strategy: SecretDeliveryStrategy;
  disabled: boolean;
};

export function secretDeliveryOptions(
  selected: SecretDeliveryStrategy,
  status: SecretDeliveryStatus,
): SecretDeliveryOption[] {
  return (Object.keys(PRESENTATIONS) as SecretDeliveryStrategy[]).map((strategy) => ({
    strategy,
    ...PRESENTATIONS[strategy],
    disabled:
      (strategy === 'broker' || strategy === 'egress') &&
      (strategy !== selected || status !== 'available'),
  }));
}

export function canSaveSecretDelivery(input: {
  isEdit: boolean;
  key: string;
  value: string;
  requiresValue: boolean;
  requiresRotation: boolean;
  currentStrategy: SecretDeliveryStrategy;
  nextStrategy: SecretDeliveryStrategy;
}): boolean {
  const hasValue = Boolean(input.value.trim());
  if (!input.isEdit && !input.key.trim()) return false;
  if (input.requiresValue && !hasValue) return false;
  if (input.nextStrategy === 'runtime' && input.requiresRotation && !hasValue) return false;
  return !input.isEdit || hasValue || input.nextStrategy !== input.currentStrategy;
}
