import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const manifestUrl = new URL('../src/lib/seo/content-timestamps.json', import.meta.url);
const scriptUrl = new URL('./build-content-timestamps.mjs', import.meta.url);

describe('content timestamp manifest', () => {
  it('imports without writing', async () => {
    const beforeImport = await readFile(manifestUrl, 'utf8');
    const module = await import(`${scriptUrl.href}?test=${Date.now()}`);
    const afterImport = await readFile(manifestUrl, 'utf8');

    assert.equal(afterImport, beforeImport);
    assert.equal(typeof module.createContentTimestampManifest, 'function');
  });

  it('matches the current git history when full history is available', async () => {
    const module = await import(`${scriptUrl.href}?test=${Date.now()}`);
    const generatedManifest = module.createContentTimestampManifest();
    if (Object.keys(generatedManifest).length === 0) return;

    const committedManifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
    assert.ok(Object.values(generatedManifest).every((value) => value.endsWith('Z')));
    assert.deepEqual(committedManifest, generatedManifest);
  });
});
