import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../..');
const manifestPath = resolve(repositoryRoot, 'tests/spec/routes.generated.json');
const outputPath = resolve(
  repositoryRoot,
  'apps/web/src/components/iam/audit-http-routes.generated.ts',
);

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const routes = manifest.routes.map(({ method, path }) => `${method} ${path}`);
const uniqueRoutes = [...new Set(routes)];

if (uniqueRoutes.length !== manifest.count) {
  throw new Error(
    `Route manifest contains ${manifest.count} routes but ${uniqueRoutes.length} unique routes`,
  );
}

const output =
  `// Generated from tests/spec/routes.generated.json. Do not edit directly.\n` +
  `// Run: node apps/web/scripts/generate-audit-http-routes.mjs\n\n` +
  `export const AUDIT_HTTP_ROUTES = ${JSON.stringify(uniqueRoutes, null, 2)} as const;\n`;

writeFileSync(outputPath, output);
console.log(`Wrote ${uniqueRoutes.length} audit routes to ${outputPath}`);
