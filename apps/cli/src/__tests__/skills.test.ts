import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runSkills } from '../commands/skills.ts';
import { stripAnsi } from '../style.ts';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_STDOUT_WRITE = process.stdout.write;
const ORIGINAL_STDERR_WRITE = process.stderr.write;

const ENV_KEYS = [
  'KORTIX_CLI_TOKEN',
  'KORTIX_EXECUTOR_TOKEN',
  'KORTIX_TOKEN',
  'KORTIX_API_URL',
  'KORTIX_PROJECT_ID',
  'KORTIX_DISABLE_SANDBOX_ENV_FILE',
  'KORTIX_CONFIG_FILE',
  'KORTIX_AUTH_FILE',
] as const;

const SYSTEM_BODY = '---\nname: kortix-system\n---\n\n<skill name="kortix-system">live body</skill>\n';
const SLACK_BODY = '---\nname: kortix-slack\n---\n\nHow to connect Slack.\n';
const REF_CONTENT = '# reference doc\n';

// The system floor as `GET /v1/skills` serves it: name + frontmatter
// description only, no bodies.
const SYSTEM_SKILLS = [
  {
    name: 'kortix-system',
    description: 'How Kortix works. Load whenever the user asks about the platform.',
    referenceCount: 1,
    bytes: 4096,
  },
  { name: 'kortix-slack', description: 'Connect Slack.', referenceCount: 0, bytes: 1024 },
];

// The browsable (non-managed) catalog skill — reachable only via `--all`, which
// is the one thing the marketplace catalog is still queried for.
const CATALOG_ITEMS = [
  {
    id: 'kortix-starter:pdf',
    name: 'pdf',
    type: 'registry:skill',
    title: 'pdf',
    description: 'Work with PDFs.',
  },
];

const DETAILS: Record<string, unknown> = {
  'kortix-system': {
    name: 'kortix-system',
    description: SYSTEM_SKILLS[0].description,
    body: SYSTEM_BODY,
    references: [{ path: 'references/manifest.md', bytes: REF_CONTENT.length }],
  },
  'kortix-slack': {
    name: 'kortix-slack',
    description: SYSTEM_SKILLS[1].description,
    body: SLACK_BODY,
    references: [],
  },
};

let saved: Record<string, string | undefined>;
let tmp: string;
let originalCwd: string;
let stdout = '';
let stderr = '';
let requests: string[] = [];

function writeConfig(): void {
  const file = join(tmp, 'config.json');
  writeFileSync(
    file,
    JSON.stringify({
      active: 'test',
      hosts: {
        test: {
          url: 'https://api.test',
          token: 'tok_test',
          user_id: 'user_1',
          user_email: 'user@example.test',
          account_id: 'account_1',
          logged_in_at: '2026-01-01T00:00:00.000Z',
        },
      },
    }),
    'utf8',
  );
  process.env.KORTIX_CONFIG_FILE = file;
}

function captureOutput() {
  stdout = '';
  stderr = '';
  (process.stdout as any).write = (chunk: unknown) => ((stdout += String(chunk)), true);
  (process.stderr as any).write = (chunk: unknown) => ((stderr += String(chunk)), true);
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

function mockApi() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    const path = url.split('/v1/')[1] ?? '';

    // Detail: /skills/{name}[?full=1]
    const detailMatch = path.match(/^skills\/([^/?]+)/);
    if (detailMatch) {
      const detail = DETAILS[decodeURIComponent(detailMatch[1])] as any;
      if (!detail) {
        return new Response(JSON.stringify({ error: true, message: 'Not found', status: 404 }), {
          status: 404,
        });
      }
      const full = new URL(url).searchParams.get('full');
      if (full !== '1') return json(detail);
      return json({
        ...detail,
        references: detail.references.map((f: any) => ({ ...f, content: REF_CONTENT })),
      });
    }
    // List: /skills
    if (path === 'skills' || path.startsWith('skills?')) {
      return json({ skills: SYSTEM_SKILLS, count: SYSTEM_SKILLS.length });
    }
    // `--all` only: the browsable catalog skills.
    if (path.startsWith('marketplace/items')) {
      return json({ items: CATALOG_ITEMS, total: CATALOG_ITEMS.length, hasMore: false });
    }
    return new Response(JSON.stringify({ error: `unexpected ${url}` }), { status: 500 });
  }) as typeof fetch;
}

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.KORTIX_DISABLE_SANDBOX_ENV_FILE = '1';
  originalCwd = process.cwd();
  tmp = mkdtempSync(join(tmpdir(), 'kortix-skills-test-'));
  process.chdir(tmp);
  writeConfig();
  captureOutput();
  requests = [];
  mockApi();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  (process.stdout as any).write = ORIGINAL_STDOUT_WRITE;
  (process.stderr as any).write = ORIGINAL_STDERR_WRITE;
  process.chdir(originalCwd);
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  rmSync(tmp, { recursive: true, force: true });
});

describe('kortix skills — list', () => {
  test('default lists the kortix-managed system floor from /v1/skills', async () => {
    const code = await runSkills([]);
    expect(code).toBe(0);
    const out = stripAnsi(stdout);
    expect(out).toContain('kortix-system');
    expect(out).toContain('kortix-slack');
    expect(out).not.toContain('pdf');
    expect(out).toContain('kortix skills get <name>');
    // The managed floor is NOT in the browse catalog — querying it was the bug.
    expect(requests.some((u) => u.includes('/v1/skills'))).toBe(true);
    expect(requests.some((u) => u.includes('marketplace'))).toBe(false);
  });

  test('list shows only the first sentence of a paragraph-long description', async () => {
    await runSkills([]);
    const out = stripAnsi(stdout);
    expect(out).toContain('How Kortix works.');
    expect(out).not.toContain('Load whenever the user asks');
  });

  test('--all folds in the browsable catalog skills too', async () => {
    const code = await runSkills(['list', '--all']);
    expect(code).toBe(0);
    const out = stripAnsi(stdout);
    expect(out).toContain('pdf');
    expect(out).toContain('kortix-system');
  });

  test('--all still lists the system floor when the catalog scan fails', async () => {
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('marketplace')) throw new Error('catalog down');
      return inner(input as any, init);
    }) as typeof fetch;
    const code = await runSkills(['list', '--all']);
    expect(code).toBe(0);
    expect(stripAnsi(stdout)).toContain('kortix-system');
  });

  test('--json emits the whole description, untruncated', async () => {
    const code = await runSkills(['--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.skills.map((s: any) => s.name).sort()).toEqual(['kortix-slack', 'kortix-system']);
    expect(parsed.skills.find((s: any) => s.name === 'kortix-system').description).toContain(
      'Load whenever the user asks',
    );
  });
});

describe('kortix skills — get', () => {
  test('prints the live SKILL.md body for a bare skill name', async () => {
    const code = await runSkills(['get', 'kortix-system']);
    expect(code).toBe(0);
    expect(stdout).toContain('<skill name="kortix-system">live body');
    // Bare name is the address — no id namespacing, no search round trip.
    expect(requests.some((u) => u.endsWith('/v1/skills/kortix-system'))).toBe(true);
    expect(requests.length).toBe(1);
  });

  test('--json returns name, description, body and referenced file paths', async () => {
    const code = await runSkills(['get', 'kortix-system', '--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.name).toBe('kortix-system');
    expect(parsed.body).toContain('live body');
    expect(parsed.description).toContain('How Kortix works.');
    expect(parsed.files).toEqual(['references/manifest.md']);
  });

  test('--full inlines referenced files in one round trip', async () => {
    const code = await runSkills(['get', 'kortix-system', '--full']);
    expect(code).toBe(0);
    expect(stdout).toContain('===== references/manifest.md =====');
    expect(stdout).toContain('# reference doc');
    expect(requests.length).toBe(1);
    expect(requests[0]).toContain('full=1');
  });

  test('without --full, references are named on stderr but not downloaded', async () => {
    const code = await runSkills(['get', 'kortix-system']);
    expect(code).toBe(0);
    expect(stripAnsi(stderr)).toContain('1 referenced file not shown');
    expect(stdout).not.toContain('# reference doc');
  });

  test('unknown skill exits 1 with a hint', async () => {
    const code = await runSkills(['get', 'does-not-exist']);
    expect(code).toBe(1);
    expect(stripAnsi(stderr)).toContain('No Kortix skill matches');
  });

  test('missing name exits 2', async () => {
    const code = await runSkills(['get']);
    expect(code).toBe(2);
  });
});

describe('kortix skills — path', () => {
  test('resolves the on-disk skill dir under a project root', async () => {
    mkdirSync(join(tmp, '.kortix', 'opencode'), { recursive: true });
    const code = await runSkills(['path', 'kortix-system']);
    expect(code).toBe(0);
    expect(stdout.trim().endsWith('.kortix/opencode/skills/kortix-system')).toBe(true);
  });

  test('--json reports the path and whether it exists', async () => {
    const code = await runSkills(['path', 'kortix-memory', '--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.path.endsWith('.kortix/opencode/skills/kortix-memory')).toBe(true);
    expect(parsed.exists).toBe(false);
  });
});
