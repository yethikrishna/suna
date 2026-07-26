/**
 * `kortix skills <subcommand>` — load Kortix system skills straight from the
 * CLI. The `kortix-*` system skills describe how Kortix itself works
 * (sessions, sandboxes, the executor/approval loop, memory, channels). Their
 * bodies are served live by the API from `/v1/skills`, so `get` always returns
 * the instructions that match the deployment you are talking to — no
 * re-install, no image re-bake, no repo checkout.
 *
 * This is the runtime entry path the seeded `kortix-system` skill points an
 * agent at: read the pointer, then `kortix skills get <name>` for the live body.
 * It is also what makes the CLI self-sufficient in ANY harness — Claude Code,
 * Codex, OpenCode: the binary plus a token is enough to learn the whole platform.
 *
 *   kortix skills                 list the system skills (how Kortix works)
 *   kortix skills get <name>      print one skill's current SKILL.md body
 *   kortix skills path [name]     locate the on-disk skill dir
 *
 * `--all` additionally folds in the browsable (non-managed) Kortix catalog
 * skills from `/v1/marketplace/items`. The managed floor is deliberately hidden
 * from that catalog (it is the platform floor, not a browse-and-install card),
 * which is exactly why the two sources are queried separately — querying only
 * the catalog, as this command used to, returned nothing at all.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadAuth, loadAuthForHost, type Auth } from '../api/auth.ts';
import { ApiError, clientFromAuth, type ApiClient } from '../api/client.ts';
import { emitJson, surfaceApiError, takeFlagBool, takeFlagValue } from '../command-helpers.ts';
import { C, help, status } from '../style.ts';

/** One entry of `GET /v1/skills` — cheap by design: no body, no file contents. */
interface SkillSummary {
  name: string;
  description: string;
  referenceCount?: number;
  bytes?: number;
  /** Set only for the extra `--all` entries pulled from the marketplace catalog. */
  optional?: boolean;
}

interface SkillReference {
  path: string;
  bytes?: number;
  content?: string;
}

/** `GET /v1/skills/:name` — the complete markdown the agent is meant to follow. */
interface SkillDetail {
  name: string;
  description: string;
  body: string;
  references: SkillReference[];
}

interface SkillsListResponse {
  skills: SkillSummary[];
  count: number;
}

interface CatalogItem {
  id: string;
  name: string;
  type: string;
  title: string;
  description: string | null;
}

interface SkillsFlags {
  host?: string;
  all: boolean;
  full: boolean;
  json: boolean;
}

const HELP = help`Usage: kortix skills <subcommand> [options]

Load Kortix system skills — how Kortix works — straight from the CLI.
Bodies are served live, so \`get\` always returns the current instructions.

Subcommands:
  list                 List the Kortix system skills (default).
  get <name>           Print one skill's current SKILL.md body.
  path [name]          Print the on-disk skill directory.

Options:
  --all                list: include every Kortix skill, not just the system floor.
  --full               get: also print the skill's referenced files.
  --host <name>        Use a configured Kortix host.
  --json               Machine-readable output.
  -h, --help           Show this help.

Examples:
  kortix skills
  kortix skills get kortix-system
  kortix skills get kortix-slack --json
`;

/** Where a skill's files live inside a Kortix project. */
const SKILLS_DIR = '.kortix/opencode/skills';

function parseFlags(argv: string[]): SkillsFlags {
  return {
    host: takeFlagValue(argv, ['--host']),
    all: takeFlagBool(argv, ['--all']),
    full: takeFlagBool(argv, ['--full']),
    json: takeFlagBool(argv, ['--json']),
  };
}

function resolveClient(host?: string): { client: ApiClient; auth: Auth } | null {
  const auth = host ? loadAuthForHost(host) : loadAuth();
  if (!auth?.token) {
    if (host) {
      process.stderr.write(
        `${status.err(`Host "${host}" is not logged in.`)} Run ${C.cyan}kortix login --host ${host}${C.reset}.\n`,
      );
    } else {
      process.stderr.write(`${status.err('Not logged in. Run `kortix login`.')}\n`);
    }
    return null;
  }
  return { client: clientFromAuth(auth), auth };
}

/** The system floor — the kortix-managed skills that describe how Kortix works. */
async function fetchSystemSkills(client: ApiClient): Promise<SkillSummary[]> {
  const res = await client.get<SkillsListResponse>('/skills');
  return res.skills ?? [];
}

/** Best-effort extra: the browsable Kortix catalog skills (`--all` only). A
 *  catalog scan can be slow or transiently unavailable; it must never take the
 *  system floor — the part that matters — down with it. */
async function fetchCatalogSkills(client: ApiClient): Promise<SkillSummary[]> {
  try {
    const res = await client.get<{ items: CatalogItem[] }>(
      '/marketplace/items?type=skill&source=kortix',
    );
    return (res.items ?? []).map((item) => ({
      name: item.name,
      description: item.description ?? item.title,
      optional: true,
    }));
  } catch {
    return [];
  }
}

async function skillsList(flags: SkillsFlags): Promise<number> {
  const ctx = resolveClient(flags.host);
  if (!ctx) return 1;

  let skills: SkillSummary[];
  try {
    skills = await fetchSystemSkills(ctx.client);
    if (flags.all) {
      const known = new Set(skills.map((s) => s.name));
      for (const extra of await fetchCatalogSkills(ctx.client)) {
        if (!known.has(extra.name)) skills.push(extra);
      }
    }
  } catch (err) {
    return surfaceApiError(err);
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));

  if (flags.json) {
    emitJson({ skills });
    return 0;
  }
  if (skills.length === 0) {
    process.stdout.write(`${status.info('No skills found.')}\n`);
    return 0;
  }
  const heading = flags.all ? 'Kortix skills' : 'System skills — how Kortix works';
  process.stdout.write(`\n  ${C.bold}${heading}${C.reset} ${C.faded}(live, kortix-managed)${C.reset}\n\n`);
  const width = Math.min(24, Math.max(...skills.map((s) => s.name.length)));
  for (const s of skills) {
    const tag = s.optional ? ` ${C.faded}[optional]${C.reset}` : '';
    process.stdout.write(
      `  ${C.cyan}${s.name.padEnd(width)}${C.reset}  ${summarize(s.description)}${tag}\n`,
    );
  }
  process.stdout.write(`\n  ${C.dim}Load one:${C.reset} ${C.cyan}kortix skills get <name>${C.reset}\n`);
  return 0;
}

/** Skill descriptions are agent-facing routing triggers and run to a paragraph.
 *  The human-readable list shows the first sentence; `--json` keeps them whole. */
function summarize(description: string): string {
  const first = (description ?? '').split(/(?<=\.)\s/)[0] ?? '';
  return first.length > 160 ? `${first.slice(0, 159)}…` : first;
}

async function skillsGet(argv: string[], flags: SkillsFlags): Promise<number> {
  const name = argv.find((a) => !a.startsWith('-'));
  if (!name) {
    process.stderr.write(`${status.err('pass a skill name: kortix skills get kortix-system')}\n`);
    return 2;
  }
  const ctx = resolveClient(flags.host);
  if (!ctx) return 1;

  // `--full` asks the API to inline every reference file in the same response —
  // one round trip instead of N, and the server already holds them in memory.
  const path = `/skills/${encodeURIComponent(name)}${flags.full ? '?full=1' : ''}`;
  let detail: SkillDetail;
  try {
    detail = await ctx.client.get<SkillDetail>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      process.stderr.write(
        `${status.err(`No Kortix skill matches "${name}".`)} Run ${C.cyan}kortix skills${C.reset}.\n`,
      );
      return 1;
    }
    return surfaceApiError(err);
  }

  const references = detail.references ?? [];

  if (flags.json) {
    emitJson({
      name: detail.name,
      description: detail.description,
      body: detail.body,
      files: flags.full
        ? references.map((f) => ({ target: f.path, content: f.content ?? '' }))
        : references.map((f) => f.path),
    });
    return 0;
  }

  // Raw markdown to stdout — this is what the agent reads.
  process.stdout.write(detail.body.endsWith('\n') ? detail.body : `${detail.body}\n`);
  if (flags.full) {
    for (const f of references) {
      if (f.content == null) continue;
      process.stdout.write(`\n\n===== ${f.path} =====\n\n`);
      process.stdout.write(f.content.endsWith('\n') ? f.content : `${f.content}\n`);
    }
  } else if (references.length > 0) {
    process.stderr.write(
      `\n${C.dim}${references.length} referenced file${references.length === 1 ? '' : 's'} not shown — add ${C.reset}${C.cyan}--full${C.reset}${C.dim} to include them.${C.reset}\n`,
    );
  }
  return 0;
}

/** Walk up from cwd to a Kortix project root, else use cwd. Keys on a project
 *  marker (a `kortix.yaml`/`kortix.toml` manifest or a `.kortix/opencode` dir),
 *  not a bare `.kortix/` — otherwise the CLI's own `~/.kortix` home dir matches. */
function projectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (
      existsSync(join(dir, 'kortix.yaml')) ||
      existsSync(join(dir, 'kortix.toml')) ||
      existsSync(join(dir, '.kortix', 'opencode'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function skillsPath(argv: string[], flags: SkillsFlags): number {
  const name = argv.find((a) => !a.startsWith('-'));
  const base = join(projectRoot(), SKILLS_DIR);
  const target = name ? join(base, name) : base;
  if (flags.json) {
    emitJson({ path: target, exists: existsSync(target) });
    return 0;
  }
  process.stdout.write(`${target}\n`);
  return 0;
}

export async function runSkills(argv: string[]): Promise<number> {
  if (argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(HELP);
    return 0;
  }

  const sub = argv[0];
  const rest = argv.slice(1);

  // Bare `kortix skills`, `list`/`ls`, or a leading flag (`kortix skills --json`)
  // all list the system floor. A leading flag isn't a subcommand, so its flags
  // come from the whole argv.
  if (!sub || sub === 'list' || sub === 'ls' || sub.startsWith('-')) {
    return skillsList(parseFlags(sub && sub.startsWith('-') ? argv.slice() : rest));
  }
  switch (sub) {
    case 'get':
    case 'show':
    case 'cat':
      return skillsGet(rest, parseFlags(rest));
    case 'path':
    case 'where':
      return skillsPath(rest, parseFlags(rest));
    default:
      process.stderr.write(`${status.err(`unknown subcommand "${sub}"`)}\n\n${HELP}`);
      return 2;
  }
}
