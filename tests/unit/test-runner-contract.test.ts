import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const makefile = readFileSync(resolve(root, 'Makefile'), 'utf8');

describe('local test runner contract', () => {
  it('uses the committed Bun lockfile for installation and test commands', () => {
    expect(existsSync(resolve(root, 'tests/bun.lock'))).toBe(true);
    expect(existsSync(resolve(root, 'tests/package-lock.json'))).toBe(false);
    expect(makefile).toContain('TEST_RUN := cd $(TESTS) && bun run');
    expect(makefile).toContain('cd $(TESTS) && bun install --frozen-lockfile');
    expect(makefile).toContain('cd $(TESTS) && bunx playwright install --with-deps chromium');
    expect(makefile).not.toContain('npm --prefix $(TESTS)');
  });
});
