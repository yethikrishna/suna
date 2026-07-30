'use client';

import type { FileSource } from '@/features/file-viewer';
import { useFileContent } from './hooks';
import { useBinaryBlob } from './hooks/use-binary-blob';
import { downloadFile, uploadFile } from './api/runtime-files';
// Deliberately NOT `@/features/project-files` (the barrel). This module builds
// `workspaceFileSource` as a module constant, so it READS every imported binding
// at evaluation time — and the barrel re-exports the whole feature, including
// change-request-detail-dialog -> `@kortix/sdk/projects-client`. That barrel also
// comes back here via project-files/hooks/use-change-requests.ts ->
// @/features/files/hooks/use-git-status, so the two form an import cycle.
// Harmless on its own — except the SDK leg is a webpack ASYNC module
// (`__webpack_require__.a`), which registers its re-export getters before its
// `var` bindings are assigned. Evaluating the object literal below mid-cycle then
// reads an unassigned binding and throws `Cannot read properties of undefined
// (reading 'A')` during SSR on every authenticated project render. Importing the
// component directly keeps the cycle out entirely.
import { FilePathBreadcrumbs } from '@/features/project-files/components/file-breadcrumbs';

/**
 * Live-workspace data source for the shared file viewer/modal. The hooks are
 * module-stable and read the active sandbox, so this is a module constant.
 */
export const workspaceFileSource: FileSource = {
  useFileContent,
  useBinaryBlob,
  download: downloadFile,
  upload: uploadFile,
  Breadcrumbs: FilePathBreadcrumbs,
};
