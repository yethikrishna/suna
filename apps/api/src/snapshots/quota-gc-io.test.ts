import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = join(import.meta.dir, '..', '..', '..', '..');
const MODULE_URL = pathToFileURL(join(import.meta.dir, 'quota-gc.ts')).href;
const RESULT_MARKER = '__KORTIX_QUOTA_GC_RESULT__';

function runQuotaGc(script: string): unknown {
  const output = execFileSync('bun', ['--eval', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:54322/postgres',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
      API_KEY_SECRET: 'test-api-key-secret',
      TUNNEL_SIGNING_SECRET: 'test-tunnel-signing-secret',
      ALLOWED_SANDBOX_PROVIDERS: 'daytona',
      DAYTONA_API_KEY: 'test-daytona-key',
      DAYTONA_SERVER_URL: 'https://daytona.example.test',
      DAYTONA_TARGET: 'test-target',
      FRONTEND_URL: 'http://localhost:3000',
      INTERNAL_KORTIX_ENV: 'dev',
    },
  });
  const marker = output.lastIndexOf(RESULT_MARKER);
  if (marker < 0) throw new Error(`quota GC subprocess returned no result: ${output}`);
  return JSON.parse(output.slice(marker + RESULT_MARKER.length));
}

describe('reconcileSnapshotQuota pin lookup boundary', () => {
  test('deletes safe non-ppwarm candidates but no ppwarm image when pin lookup fails', () => {
    const observed = runQuotaGc(`
      const { reconcileSnapshotQuota } = await import(${JSON.stringify(MODULE_URL)});
      const now = Date.parse('2026-08-21T00:00:00Z');
      const timestamp = new Date(now - 30 * 86400000).toISOString();
      const snapshots = [
        { id: 'ppwarm-id', name: 'kortix-ppwarm-12345678-37a8eec1-aaaaaaaaaaaa', state: 'error', createdAt: timestamp, lastUsedAt: timestamp },
        { id: 'default-id', name: 'kortix-default-broken', state: 'error', createdAt: timestamp, lastUsedAt: timestamp },
      ];
      while (snapshots.length < 80) {
        snapshots.push({
          id: 'stock-' + snapshots.length,
          name: 'daytonaio/stock-' + snapshots.length,
          state: 'active',
          createdAt: timestamp,
          lastUsedAt: timestamp,
        });
      }
      const deleted = [];
      const result = await reconcileSnapshotQuota(
        { now },
        {
          isConfigured: () => true,
          listSnapshots: async () => snapshots,
          loadReferencedSnapshotNames: async () => new Set(),
          loadPinnedImageRefs: async () => { throw new Error('pin database unavailable'); },
          deleteSnapshotById: async (id) => { deleted.push(id); return true; },
        },
      );
      process.stdout.write(${JSON.stringify(RESULT_MARKER)} + JSON.stringify({ deleted, result }));
    `) as {
      deleted: string[];
      result: { orgTotal: number; managedCount: number; eligible: number; deleted: number };
    };

    expect(observed.deleted).toEqual(['default-id']);
    expect(observed.result).toMatchObject({
      orgTotal: 80,
      managedCount: 2,
      eligible: 1,
      deleted: 1,
    });
  });
});
