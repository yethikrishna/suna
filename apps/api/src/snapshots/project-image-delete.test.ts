import { describe, expect, mock, test } from 'bun:test';
import { legacyPerProjectWarmImageName, perProjectWarmImageName } from './ppwarm-names';

function setTestEnv(name: string, value: string): void {
  if (!process.env[name] || process.env[name]?.startsWith('encrypted:')) {
    process.env[name] = value;
  }
}

setTestEnv('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:54322/postgres');
setTestEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
setTestEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
setTestEnv('API_KEY_SECRET', 'test-api-key-secret');
setTestEnv('TUNNEL_SIGNING_SECRET', 'test-tunnel-signing-secret');
setTestEnv('ALLOWED_SANDBOX_PROVIDERS', 'daytona');
setTestEnv('DAYTONA_API_KEY', 'test-daytona-key');
setTestEnv('DAYTONA_SERVER_URL', 'https://daytona.example.test');
setTestEnv('DAYTONA_TARGET', 'test-target');
setTestEnv('FRONTEND_URL', 'http://localhost:3000');
setTestEnv('INTERNAL_KORTIX_ENV', 'dev');

const realSnapshotProviders = await import('./providers');

const deletedNames: string[] = [];
const stateReads: string[] = [];
const providerRequests: string[] = [];

mock.module('./providers', () => ({
  ...realSnapshotProviders,
  getSandboxProvider: (provider: string) => {
    providerRequests.push(provider);
    return {
      id: provider,
      isConfigured: () => true,
      getSnapshotState: async (snapshotName: string) => {
        stateReads.push(snapshotName);
        return 'active' as const;
      },
      deleteSnapshot: async (snapshotName: string) => {
        deletedNames.push(snapshotName);
      },
      listSnapshots: async () => [],
      buildSnapshot: async () => {},
    };
  },
}));

const { deleteProjectSandboxImage } = await import('./project-image-delete');

describe('deleteProjectSandboxImage', () => {
  test.each([
    perProjectWarmImageName(
      '9ee8bc9c-5108-437f-a01f-6c5e26f2062c',
      'a'.repeat(40),
      'kortix-default-e881f000eae5',
      'default',
    ),
    legacyPerProjectWarmImageName(
      '9ee8bc9c-5108-437f-a01f-6c5e26f2062c',
      'a'.repeat(40),
      'kortix-default-e881f000eae5',
    ),
  ])('deletes only the exact project-image name %s', async (snapshotName) => {
    deletedNames.length = 0;
    stateReads.length = 0;
    providerRequests.length = 0;

    await expect(deleteProjectSandboxImage(snapshotName, 'daytona')).resolves.toEqual({
      deleted: true,
      snapshotName,
    });

    expect(providerRequests).toEqual(['daytona']);
    expect(stateReads).toEqual([snapshotName]);
    expect(deletedNames).toEqual([snapshotName]);
  });

  test.each([
    'kortix-default-e881f000eae5',
    'kortix-tpl-custom-e881f000eae5',
    'kortix-ppwarm-9ee8bc9c-aaaaaaaaaaaa__deleted_tpl_1',
    'kortix-ppwarm-9ee8bc9c-not-hex',
  ])('rejects %s before provider lookup', async (snapshotName) => {
    deletedNames.length = 0;
    stateReads.length = 0;
    providerRequests.length = 0;

    await expect(deleteProjectSandboxImage(snapshotName, 'daytona')).rejects.toThrow(
      'Refusing to delete non-project sandbox image',
    );

    expect(providerRequests).toEqual([]);
    expect(stateReads).toEqual([]);
    expect(deletedNames).toEqual([]);
  });
});
