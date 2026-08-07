import { createHash, createHmac } from 'node:crypto';

import { config } from '../config';
import { platinumJson } from '../shared/platinum';
import type { NetworkBoundarySecretBinding } from './network-boundary';

type PlatinumSecret = {
  id: string;
  name: string;
  description: string | null;
  current_gen: number;
  allow: string[];
  headers: string[];
  on_echo: 'block' | 'redact';
};

type PlatinumSandboxSecrets = {
  sandbox_id: string;
  state: 'armed' | 'arming' | 'unavailable';
  secrets: Array<{ secret_id: string; state: 'armed' | 'arming' | 'unavailable' }>;
};

const DESCRIPTION_PREFIX = 'kortix-network-v1';
const ARM_ATTEMPTS = 40;
const ARM_DELAY_MS = 250;

function httpStatus(error: unknown): number | null {
  const match = String(error instanceof Error ? error.message : error).match(/ -> (\d{3})(?: |$)/);
  return match ? Number(match[1]) : null;
}

function replicaName(externalId: string, secretId: string): string {
  const digest = createHash('sha256')
    .update(`${config.INTERNAL_KORTIX_ENV}\0${externalId}\0${secretId}`)
    .digest('hex');
  return `kortix-${digest.slice(0, 52)}`;
}

function fingerprint(value: string): string {
  if (!config.API_KEY_SECRET) throw new Error('API_KEY_SECRET is required for network secrets');
  return createHmac('sha256', config.API_KEY_SECRET).update(value).digest('hex');
}

function policyFingerprint(binding: NetworkBoundarySecretBinding): string {
  return fingerprint(JSON.stringify({
    hosts: [...binding.hosts].sort(),
    header: binding.header.toLowerCase(),
    onEcho: binding.onEcho,
  }));
}

function descriptionFor(binding: NetworkBoundarySecretBinding): string {
  return `${DESCRIPTION_PREFIX} material=${fingerprint(binding.value)} policy=${policyFingerprint(binding)}`;
}

function descriptorFingerprints(description: string | null): {
  material: string | null;
  policy: string | null;
} {
  if (!description?.startsWith(`${DESCRIPTION_PREFIX} `)) {
    return { material: null, policy: null };
  }
  const material = description.match(/(?:^| )material=([a-f0-9]{64})(?: |$)/)?.[1] ?? null;
  const policy = description.match(/(?:^| )policy=([a-f0-9]{64})(?: |$)/)?.[1] ?? null;
  return { material, policy };
}

async function readSecret(nameOrId: string): Promise<PlatinumSecret | null> {
  try {
    return await platinumJson<PlatinumSecret>(`/v1/secrets/${encodeURIComponent(nameOrId)}`);
  } catch (error) {
    if (httpStatus(error) === 404) return null;
    throw error;
  }
}

async function createSecret(
  name: string,
  binding: NetworkBoundarySecretBinding,
): Promise<PlatinumSecret> {
  const body = {
    name,
    description: descriptionFor(binding),
    value: binding.value,
    allow: binding.hosts,
    headers: [binding.header],
    on_echo: binding.onEcho,
  };
  try {
    return await platinumJson<PlatinumSecret>('/v1/secrets', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (httpStatus(error) !== 409) throw error;
    const raced = await readSecret(name);
    if (!raced) throw error;
    return raced;
  }
}

async function ensureSecret(
  externalId: string,
  binding: NetworkBoundarySecretBinding,
): Promise<PlatinumSecret> {
  const name = replicaName(externalId, binding.secretId);
  let secret = await readSecret(name);
  if (!secret) return createSecret(name, binding);

  const stored = descriptorFingerprints(secret.description);
  const material = fingerprint(binding.value);
  const policy = policyFingerprint(binding);
  if (stored.material !== material) {
    secret = await platinumJson<PlatinumSecret>(`/v1/secrets/${secret.id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ value: binding.value }),
    });
  }
  if (stored.policy !== policy || stored.material !== material) {
    secret = await platinumJson<PlatinumSecret>(`/v1/secrets/${secret.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        description: descriptionFor(binding),
        allow: binding.hosts,
        headers: [binding.header],
        on_echo: binding.onEcho,
      }),
    });
  }
  return secret;
}

async function waitUntilArmed(
  externalId: string,
  initial: PlatinumSandboxSecrets,
): Promise<PlatinumSandboxSecrets> {
  let current = initial;
  for (let attempt = 0; attempt < ARM_ATTEMPTS; attempt += 1) {
    if (current.state === 'armed') return current;
    if (current.state === 'unavailable') {
      throw new Error(`Platinum network-boundary secrets are unavailable for ${externalId}`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, ARM_DELAY_MS));
    current = await platinumJson<PlatinumSandboxSecrets>(
      `/v1/sandboxes/${encodeURIComponent(externalId)}/secrets`,
    );
  }
  throw new Error(`Platinum network-boundary secrets did not arm for ${externalId}`);
}

export async function syncPlatinumNetworkBoundary(
  externalId: string,
  bindings: NetworkBoundarySecretBinding[],
): Promise<{ state: 'armed'; attached: number }> {
  const sandboxPath = `/v1/sandboxes/${encodeURIComponent(externalId)}/secrets`;
  const before = await platinumJson<PlatinumSandboxSecrets>(sandboxPath);
  const desired = await Promise.all(
    bindings.map(async (binding) => ({
      binding,
      secret: await ensureSecret(externalId, binding),
    })),
  );
  const updated = await platinumJson<PlatinumSandboxSecrets>(sandboxPath, {
    method: 'PUT',
    body: JSON.stringify({
      secrets: desired.map(({ binding, secret }) => ({
        secret: secret.id,
        alias: binding.alias,
        header: binding.header,
      })),
    }),
  });
  await waitUntilArmed(externalId, updated);

  const desiredIds = new Set(desired.map(({ secret }) => secret.id));
  const removed = [...new Set(before.secrets.map((item) => item.secret_id))]
    .filter((secretId) => !desiredIds.has(secretId));
  for (const secretId of removed) {
    await platinumJson(`/v1/secrets/${encodeURIComponent(secretId)}`, { method: 'DELETE' });
  }
  return { state: 'armed', attached: desired.length };
}
