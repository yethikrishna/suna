import { describe, expect, test } from 'bun:test';
import type { Database } from '@kortix/db';
import {
  ACTIVE_EXTERNAL_ID_META_KEY,
  ACTIVE_SNAPSHOT_NAME_META_KEY,
  PIN_META_KEY,
  readActiveRouting,
} from './provider-transition-store';

function databaseReturning(
  row: {
    metadata: Record<string, unknown> | null;
    generation: number | null;
  } | null,
): Database {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (row ? [row] : []),
        }),
      }),
    }),
  } as unknown as Database;
}

describe('readActiveRouting', () => {
  test('reads the activated image name with its provider and external id', async () => {
    const routing = await readActiveRouting(
      databaseReturning({
        metadata: {
          [PIN_META_KEY]: 'platinum',
          [ACTIVE_EXTERNAL_ID_META_KEY]: 'tpl_project_current',
          [ACTIVE_SNAPSHOT_NAME_META_KEY]: 'kortix-ppwarm-project-current',
        },
        generation: 7,
      }),
      'project-1',
    );

    expect(routing).toEqual({
      activeProvider: 'platinum',
      activeExternalTemplateId: 'tpl_project_current',
      activeSnapshotName: 'kortix-ppwarm-project-current',
      generation: 7,
    });
  });

  test('returns null image metadata for a legacy activation record', async () => {
    const routing = await readActiveRouting(
      databaseReturning({
        metadata: {
          [PIN_META_KEY]: 'platinum',
          [ACTIVE_EXTERNAL_ID_META_KEY]: 'tpl_legacy',
        },
        generation: null,
      }),
      'project-1',
    );

    expect(routing).toEqual({
      activeProvider: 'platinum',
      activeExternalTemplateId: 'tpl_legacy',
      activeSnapshotName: null,
      generation: 0,
    });
  });
});
