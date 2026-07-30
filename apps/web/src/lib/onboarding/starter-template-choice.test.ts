import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FIRST_PROJECT_TEMPLATE } from './ensure-first-project';

const WEB_SRC = join(import.meta.dir, '..', '..');

/** Every web surface that names a starter template when it creates a project. */
const PROJECT_CREATE_SURFACES = [
  'features/projects/modal/project-create-modal.tsx',
  'features/marketplace/add-to-project-modal.tsx',
  'lib/onboarding/ensure-first-project.ts',
];

const EXPERIMENTAL_STARTER_ID = 'acp-multi-harness';
const STABLE_STARTER_ID = 'general-knowledge-worker';

describe('the web app never puts a user on the experimental multi-harness starter', () => {
  test('the auto-provisioned first project uses the stable starter', () => {
    expect(FIRST_PROJECT_TEMPLATE).toBe(STABLE_STARTER_ID);
  });

  test('no project-create surface names the experimental starter', () => {
    const offenders = PROJECT_CREATE_SURFACES.filter((relative) =>
      readFileSync(join(WEB_SRC, relative), 'utf8').includes(EXPERIMENTAL_STARTER_ID),
    );

    expect(offenders).toEqual([]);
  });

  test('every project-create surface still names the stable starter explicitly', () => {
    for (const relative of PROJECT_CREATE_SURFACES) {
      expect(readFileSync(join(WEB_SRC, relative), 'utf8')).toContain(STABLE_STARTER_ID);
    }
  });

  test('no web surface branches on a runtime harness id to choose a starter', () => {
    for (const relative of PROJECT_CREATE_SURFACES) {
      const source = readFileSync(join(WEB_SRC, relative), 'utf8');
      for (const harness of ['runtime_harness', 'harness:']) {
        expect(source).not.toContain(harness);
      }
    }
  });
});
