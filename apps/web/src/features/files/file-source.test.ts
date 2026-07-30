import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `workspaceFileSource` is a module constant, so every import in this file is read
// at module-evaluation time. Pulling FilePathBreadcrumbs from the
// `@/features/project-files` barrel drags the whole feature — and its
// `@kortix/sdk/projects-client` leg, a webpack async module — into an import cycle
// with `@/features/files`, which crashes SSR with
// `Cannot read properties of undefined (reading 'A')` on every authenticated
// project render. Keep the import concrete.
test('file-source imports FilePathBreadcrumbs directly, never through the barrel', () => {
  const source = readFileSync(join(import.meta.dir, 'file-source.tsx'), 'utf8');
  expect(source).toContain("from '@/features/project-files/components/file-breadcrumbs'");
  expect(source).not.toMatch(/from '@\/features\/project-files';/);
});
