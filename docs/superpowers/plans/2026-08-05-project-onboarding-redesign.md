# Project Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the project onboarding wizard as a seven-step, single-column flow that asks for use case, company domain, and company size, offers a plan upgrade, and personalizes its finish screen.

**Architecture:** One 560px column governs every step. Two presentational primitives (`StepShell`, `ChoiceRow`) carry all seven screens, so adding a step never adds chrome. All step logic that can be pure — step-list derivation, survey numbering, domain prefill, starter-prompt selection — moves into one dependency-free module that is unit-tested directly. Answers persist into `projects.metadata.onboarding` through a new SDK function and an extended `PATCH /v1/projects/:projectId/onboarding` handler, using the existing `metadataMergeSubtree` SQL helper so no migration is needed.

**Tech Stack:** Next.js 16 / React 19, `motion/react`, TanStack Query, Tailwind v4 + `@/components/ui/*`, `@kortix/sdk`, Hono + `@hono/zod-openapi`, Drizzle, `bun:test`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-05-project-onboarding-redesign-design.md`. Every decision D1–D7 there is binding.
- **No database migration.** `projects.metadata` is jsonb and already exists. Do not add a column to `kortix.accounts`.
- **Nested metadata writes use `metadataMergeSubtree`**, never a top-level `metadataMerge` of a whole sub-object. Reason in `apps/api/src/projects/lib/metadata-merge.ts:51-61`.
- **`setProjectOnboardingComplete` is never renamed or re-signatured.** Exported names in `packages/sdk` are a public API contract.
- **Never bump `packages/sdk/package.json` `version`.** It is inert.
- **TDD is mandatory inside `packages/sdk`** (`packages/sdk/AGENTS.md`). Failing test first, real gate output pasted.
- **Column width is exactly `max-w-[560px]`.** No step may render wider.
- **Copy is plain English.** The repo's hardcoded-UI i18n keys are not generated for this component; keep the existing note in the file header.
- **Design system:** compose from `@/components/ui/*`. Loading is `<Loading />` only — never an icon with `animate-spin`.
- **Commits:** this repo's owner commits deliberately. Run the commit step only when explicitly asked; otherwise leave the work staged and report.

---

### Task 1: SDK — `setProjectOnboardingProfile`

**Files:**
- Modify: `packages/sdk/src/core/rest/projects-client/projects.ts:634-638`
- Test: `packages/sdk/src/core/rest/projects-client/projects-onboarding-profile.test.ts` (create)
- Modify: `packages/sdk/src/public-surface.snapshot.json` (regenerate, review diff)
- Modify: `packages/sdk/src/public-type-surface.snapshot.json` (regenerate, review diff)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type OnboardingUseCase =
    | 'sales' | 'support' | 'marketing' | 'engineering'
    | 'finance_ops' | 'hr_recruiting' | 'other';
  export type OnboardingCompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  export interface OnboardingProfile {
    use_case?: OnboardingUseCase;
    company_domain?: string;
    company_size?: OnboardingCompanySize;
  }
  export async function setProjectOnboardingProfile(
    projectId: string,
    profile: OnboardingProfile,
  ): Promise<KortixProject>;
  ```

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/src/core/rest/projects-client/projects-onboarding-profile.test.ts`:

```ts
import { beforeEach, expect, test } from 'bun:test';
import { configureKortix } from '../../http/config';
import { setProjectOnboardingProfile } from './projects';

let calls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (url: unknown, opts: { method?: string; body?: string } = {}) => {
    calls.push({
      url: String(url),
      method: opts.method ?? 'GET',
      body: opts.body ? JSON.parse(opts.body) : undefined,
    });
    return new Response(JSON.stringify({ project_id: 'p1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  configureKortix({ backendUrl: 'https://api.test/v1', getToken: async () => 't' });
});

test('PATCHes the onboarding route with a profile envelope', async () => {
  await setProjectOnboardingProfile('p1', { use_case: 'sales', company_size: '51-200' });

  expect(calls).toHaveLength(1);
  expect(calls[0]?.method).toBe('PATCH');
  expect(calls[0]?.url).toContain('/projects/p1/onboarding');
  expect(calls[0]?.body).toEqual({ profile: { use_case: 'sales', company_size: '51-200' } });
});

test('never sends a completed flag', async () => {
  await setProjectOnboardingProfile('p1', { company_domain: 'acme.com' });

  expect(calls[0]?.body).toEqual({ profile: { company_domain: 'acme.com' } });
  expect(JSON.stringify(calls[0]?.body)).not.toContain('completed');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/sdk && bun test --isolate src/core/rest/projects-client/projects-onboarding-profile.test.ts`
Expected: FAIL — `setProjectOnboardingProfile` is not exported from `./projects`.

- [ ] **Step 3: Write minimal implementation**

In `packages/sdk/src/core/rest/projects-client/projects.ts`, directly beneath `setProjectOnboardingComplete` (line 638):

```ts
/** Use case the account picked during guided project onboarding. */
export type OnboardingUseCase =
  | 'sales'
  | 'support'
  | 'marketing'
  | 'engineering'
  | 'finance_ops'
  | 'hr_recruiting'
  | 'other';

/** Company size buckets. Mirrors the demo-qualifier scale so a user who both
 *  onboards and books a demo is never offered two different scales. */
export type OnboardingCompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';

/** Every field optional — onboarding saves each answer as it is given, so a
 *  partial profile is the normal case, not an error case. */
export interface OnboardingProfile {
  use_case?: OnboardingUseCase;
  company_domain?: string;
  company_size?: OnboardingCompanySize;
}

/**
 * Persist guided-onboarding answers into `projects.metadata.onboarding`.
 *
 * Deliberately separate from {@link setProjectOnboardingComplete}: completion is
 * a lifecycle flag at the top level of `metadata`, the profile is a nested
 * object, and the two are written by different steps at different times.
 */
export async function setProjectOnboardingProfile(projectId: string, profile: OnboardingProfile) {
  return unwrap(
    await backendApi.patch<KortixProject>(`/projects/${projectId}/onboarding`, { profile }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/sdk && bun test --isolate src/core/rest/projects-client/projects-onboarding-profile.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Regenerate the public surface snapshots and READ the diff**

Run: `cd packages/sdk && UPDATE_SURFACE_SNAPSHOT=1 bun test --isolate src/public-surface.test.ts src/public-type-surface.test.ts`
Then: `git diff packages/sdk/src/public-surface.snapshot.json packages/sdk/src/public-type-surface.snapshot.json`

Expected diff: **four additions only** — `setProjectOnboardingProfile`, `OnboardingUseCase`, `OnboardingCompanySize`, `OnboardingProfile`. Purely additive, so no alias and no major version are needed.

**Stop if any existing name is removed or renamed in that diff.** A snapshot diff is a question, not a test to re-record.

- [ ] **Step 6: Run the SDK gates**

Run: `cd packages/sdk && bun test --isolate src && pnpm typecheck`
Expected: PASS. Paste the real output.

- [ ] **Step 7: Commit (only if asked)**

```bash
git add packages/sdk/src/core/rest/projects-client/projects.ts packages/sdk/src/core/rest/projects-client/projects-onboarding-profile.test.ts packages/sdk/src/public-surface.snapshot.json packages/sdk/src/public-type-surface.snapshot.json
git commit -m "feat(sdk): add setProjectOnboardingProfile"
```

---

### Task 2: API — accept a `profile` on `PATCH /:projectId/onboarding`

**Files:**
- Modify: `apps/api/src/projects/routes/r6.ts:69-93`
- Test: `apps/api/src/projects/routes/r6-onboarding-profile.test.ts` (create)

**Interfaces:**
- Consumes: `metadataMerge`, `metadataMergeSubtree` from `../lib/metadata-merge` (already imported at `r6.ts:25`).
- Produces: `PATCH /v1/projects/:projectId/onboarding` accepting `{ completed?: boolean, profile?: { use_case?, company_domain?, company_size? } }`.

**Why its own test file:** `mock.module` is process-global in `bun:test`. `scripts/test.sh` runs `--isolate`, giving each file its own process. Sharing a file with another suite would leak the db mock. Same rule the header of `r5-icon-patch.test.ts` states.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/projects/routes/r6-onboarding-profile.test.ts`:

```ts
/**
 * `PATCH /v1/projects/:projectId/onboarding` — the `profile` envelope.
 *
 * Drives the REAL r6.ts Hono handler and asserts on the SQL the update actually
 * SETs, serialized through Drizzle's own PgDialect. Asserting on the fragment
 * object would prove only that some object was built; serializing it proves the
 * statement Postgres would run.
 *
 * The profile is a NESTED object under `metadata.onboarding`, so it must be
 * written with `metadataMergeSubtree` (which re-reads the current sub-object
 * in SQL), not a top-level `||` merge of the whole sub-object — two concurrent
 * writers into different sub-keys would otherwise lose an update.
 */
import { beforeEach, expect, mock, test } from 'bun:test';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const PROJECT_ID = '00000000-0000-4000-a000-0000000099b0';
const ACCOUNT_ID = '00000000-0000-4000-a000-0000000099b1';
const USER_ID = '00000000-0000-4000-a000-0000000099b2';

function projectRow(over: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    projectId: PROJECT_ID,
    accountId: ACCOUNT_ID,
    name: 'onboarding-profile-test',
    repoUrl: 'https://github.com/acme/onboarding-profile-test.git',
    defaultBranch: 'main',
    manifestPath: 'kortix.yaml',
    status: 'active',
    metadata: {},
    lastOpenedAt: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

let setCalls: Record<string, unknown>[] = [];

mock.module('../../shared/db', () => ({
  hasDatabase: true,
  db: {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        setCalls.push(values);
        return { where: () => ({ returning: async () => [projectRow()] }) };
      },
    }),
  },
}));

const realAccess = await import('../lib/access');
mock.module('../lib/access', () => ({
  ...realAccess,
  loadProjectForUser: async () => ({
    userId: USER_ID,
    row: projectRow(),
    projectRole: 'manager',
    effectiveRole: 'manager',
  }),
  assertProjectCapability: async () => {},
  projectCapabilityAllowed: async () => true,
}));

const { projectsApp } = await import('../lib/app');
await import('./r6');

const dialect = new PgDialect();
const sqlOf = (i = 0) => dialect.sqlToQuery(setCalls[i]?.metadata as SQL).sql;

async function patch(body: unknown) {
  return projectsApp.request(`/${PROJECT_ID}/onboarding`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  setCalls = [];
});

test('writes the profile as an atomic nested merge under `onboarding`', async () => {
  const res = await patch({ profile: { use_case: 'sales', company_size: '51-200' } });

  expect(res.status).toBe(200);
  expect(setCalls).toHaveLength(1);
  // Nested merge re-reads metadata->'onboarding' in SQL, so a concurrent write
  // to a different sub-key survives.
  expect(sqlOf()).toContain(`jsonb_build_object`);
  expect(sqlOf()).toContain(`-> $`);
  expect(sqlOf()).not.toContain('onboarding_completed_at');
});

test('a profile write does not touch the completion flag', async () => {
  await patch({ profile: { company_domain: 'acme.com' } });

  expect(setCalls).toHaveLength(1);
  expect(sqlOf()).not.toContain('onboarding_completed_at');
});

test('completed:true still writes the top-level flag and no profile', async () => {
  await patch({ completed: true });

  expect(setCalls).toHaveLength(1);
  expect(sqlOf()).not.toContain('jsonb_build_object');
});

test('an empty profile object is a no-op, not a clobber', async () => {
  const res = await patch({ profile: {} });

  expect(res.status).toBe(200);
  expect(setCalls).toHaveLength(0);
});

test('unknown profile keys are dropped', async () => {
  await patch({ profile: { use_case: 'sales', evil: 'x' } });

  expect(JSON.stringify(setCalls[0]?.metadata)).not.toContain('evil');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test --isolate src/projects/routes/r6-onboarding-profile.test.ts`
Expected: FAIL — the handler ignores `profile`, so `setCalls[0].metadata` is the completion merge and `jsonb_build_object` is absent.

- [ ] **Step 3: Write minimal implementation**

Replace the handler body in `apps/api/src/projects/routes/r6.ts:69-93`:

```ts
  async (c: any) => {
  const projectId = c.req.param('projectId');
  const body = await readBody(c);
  const loaded = await loadProjectForUser(c, projectId, 'write');
  if (!loaded) return c.json({ error: 'Not found' }, 404);

  // Two independent writes share this route. `completed` is a top-level
  // lifecycle flag; `profile` is a nested object written answer-by-answer as
  // the user moves through the wizard. A request carries one or the other.
  const profile = pickOnboardingProfile(body.profile);

  let metadataExpr;
  if (profile) {
    // Nested → metadataMergeSubtree, which re-reads metadata->'onboarding' in
    // SQL. A top-level `||` of the whole sub-object would let two concurrent
    // writers into different sub-keys lose each other's update.
    metadataExpr = metadataMergeSubtree('onboarding', profile);
  } else if ('completed' in body) {
    metadataExpr = body.completed === true
      ? metadataMerge({ onboarding_completed_at: new Date().toISOString() })
      : metadataMerge({}, ['onboarding_completed_at']);
  } else {
    // Nothing to write. Return the project unchanged rather than issuing a
    // no-op UPDATE that bumps updated_at.
    return c.json(serializeProject(loaded.row, {
      projectRole: loaded.projectRole,
      effectiveRole: loaded.effectiveRole,
    }));
  }

  const [row] = await db
    .update(projects)
    .set({ metadata: metadataExpr, updatedAt: new Date() })
    .where(eq(projects.projectId, projectId))
    .returning();

  if (!row || row.status === 'archived') return c.json({ error: 'Not found' }, 404);
  return c.json(serializeProject(row, {
    projectRole: loaded.projectRole,
    effectiveRole: loaded.effectiveRole,
  }));
},
```

Add above the route registration (after `serializeProjectAccessRequest`, `r6.ts:51`):

```ts
const ONBOARDING_USE_CASES = new Set([
  'sales', 'support', 'marketing', 'engineering', 'finance_ops', 'hr_recruiting', 'other',
]);
const ONBOARDING_COMPANY_SIZES = new Set(['1-10', '11-50', '51-200', '201-1000', '1000+']);

/**
 * Allowlist the onboarding profile. Returns `null` when there is nothing to
 * write, so the caller can skip the UPDATE entirely. Unknown keys are dropped
 * rather than rejected — this is a best-effort survey capture, and a client
 * that sends a field we retired must not break a user's onboarding.
 */
function pickOnboardingProfile(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const out: Record<string, string> = {};

  if (typeof raw.use_case === 'string' && ONBOARDING_USE_CASES.has(raw.use_case)) {
    out.use_case = raw.use_case;
  }
  if (typeof raw.company_size === 'string' && ONBOARDING_COMPANY_SIZES.has(raw.company_size)) {
    out.company_size = raw.company_size;
  }
  if (typeof raw.company_domain === 'string') {
    const domain = raw.company_domain.trim().toLowerCase().slice(0, 253);
    if (domain) out.company_domain = domain;
  }

  return Object.keys(out).length > 0 ? out : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test --isolate src/projects/routes/r6-onboarding-profile.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verify no sibling route regressed**

Run: `cd apps/api && bun test --isolate src/projects/routes`
Expected: PASS. `r5-icon-patch`, `r5-glyph-patch`, `r2-icon-wiring`, `r2-glyph-wiring` all still green.

- [ ] **Step 6: Commit (only if asked)**

```bash
git add apps/api/src/projects/routes/r6.ts apps/api/src/projects/routes/r6-onboarding-profile.test.ts
git commit -m "feat(api): accept an onboarding profile on PATCH /projects/:id/onboarding"
```

---

### Task 3: Web — the pure onboarding logic module

Everything in the wizard that does not need React lives here, so it can be tested without rendering anything.

**Files:**
- Create: `apps/web/src/components/projects/onboarding/onboarding-profile.ts`
- Test: `apps/web/src/components/projects/onboarding/onboarding-profile.test.ts`

**Interfaces:**
- Consumes: `isWorkEmail` from `@/lib/personal-email`; the profile types from Task 1.
- Produces:
  ```ts
  export type StepId = 'welcome' | 'use-case' | 'company' | 'tools' | 'slack' | 'plan' | 'done';
  export const USE_CASE_OPTIONS: readonly UseCaseOption[];
  export const COMPANY_SIZES: readonly OnboardingCompanySize[];
  export function buildSteps(connectorsEnabled: boolean): StepId[];
  export function surveyPosition(stepId: StepId): { index: number; total: number } | null;
  export function deriveCompanyDomain(email: string | null | undefined): string;
  export function starterPromptsFor(useCase: OnboardingUseCase | null): StarterPrompt[];
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/projects/onboarding/onboarding-profile.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import {
  buildSteps,
  COMPANY_SIZES,
  deriveCompanyDomain,
  starterPromptsFor,
  surveyPosition,
  USE_CASE_OPTIONS,
} from './onboarding-profile';

describe('buildSteps', () => {
  test('includes the tools step when connectors are enabled', () => {
    expect(buildSteps(true)).toEqual([
      'welcome', 'use-case', 'company', 'tools', 'slack', 'plan', 'done',
    ]);
  });

  test('drops only the tools step when connectors are disabled', () => {
    expect(buildSteps(false)).toEqual([
      'welcome', 'use-case', 'company', 'slack', 'plan', 'done',
    ]);
  });
});

describe('surveyPosition', () => {
  test('numbers the two survey steps', () => {
    expect(surveyPosition('use-case')).toEqual({ index: 1, total: 2 });
    expect(surveyPosition('company')).toEqual({ index: 2, total: 2 });
  });

  // The eyebrow counts SURVEY questions, not wizard steps, so removing the
  // tools step must not renumber it.
  test('is null for every non-survey step', () => {
    for (const id of ['welcome', 'tools', 'slack', 'plan', 'done'] as const) {
      expect(surveyPosition(id)).toBeNull();
    }
  });
});

describe('deriveCompanyDomain', () => {
  test('extracts the domain from a work email', () => {
    expect(deriveCompanyDomain('sam@acme.com')).toBe('acme.com');
  });

  test('lowercases and trims', () => {
    expect(deriveCompanyDomain('  Sam@ACME.CO.UK ')).toBe('acme.co.uk');
  });

  test('returns empty for a consumer inbox', () => {
    expect(deriveCompanyDomain('sam@gmail.com')).toBe('');
    expect(deriveCompanyDomain('sam@icloud.com')).toBe('');
  });

  test('returns empty for missing or malformed input', () => {
    expect(deriveCompanyDomain(null)).toBe('');
    expect(deriveCompanyDomain(undefined)).toBe('');
    expect(deriveCompanyDomain('not-an-email')).toBe('');
    expect(deriveCompanyDomain('sam@')).toBe('');
  });
});

describe('starterPromptsFor', () => {
  test('returns three prompts for every option', () => {
    for (const option of USE_CASE_OPTIONS) {
      const prompts = starterPromptsFor(option.value);
      expect(prompts).toHaveLength(3);
      for (const p of prompts) {
        expect(p.title.length).toBeGreaterThan(0);
        expect(p.prompt.length).toBeGreaterThan(0);
      }
    }
  });

  test('falls back to three prompts when the survey was skipped', () => {
    expect(starterPromptsFor(null)).toHaveLength(3);
  });
});

describe('option sets', () => {
  test('offers seven use cases with unique values', () => {
    expect(USE_CASE_OPTIONS).toHaveLength(7);
    expect(new Set(USE_CASE_OPTIONS.map((o) => o.value)).size).toBe(7);
  });

  // Must match features/contact/demo-qualifier-modal.tsx so a user who both
  // onboards and books a demo is never offered two different scales.
  test('uses the canonical company-size scale', () => {
    expect(COMPANY_SIZES).toEqual(['1-10', '11-50', '51-200', '201-1000', '1000+']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/projects/onboarding/onboarding-profile.test.ts`
Expected: FAIL — module `./onboarding-profile` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/projects/onboarding/onboarding-profile.ts`:

```ts
/**
 * Pure onboarding logic — no React, no network, no DOM.
 *
 * Everything the wizard decides that does not need to render lives here so it
 * can be asserted directly instead of through a mounted component.
 */
import { isWorkEmail } from '@/lib/personal-email';
import type { OnboardingCompanySize, OnboardingUseCase } from '@kortix/sdk';

export type StepId = 'welcome' | 'use-case' | 'company' | 'tools' | 'slack' | 'plan' | 'done';

export interface UseCaseOption {
  value: OnboardingUseCase;
  label: string;
  description: string;
}

/** Ordered by how often the matching department appears in content/use-cases. */
export const USE_CASE_OPTIONS: readonly UseCaseOption[] = [
  { value: 'sales', label: 'Sales', description: 'Follow up on leads, keep the CRM clean' },
  { value: 'support', label: 'Customer support', description: 'Triage tickets, draft replies' },
  { value: 'marketing', label: 'Marketing', description: 'Watch the market, refresh content' },
  { value: 'engineering', label: 'Engineering', description: 'Triage errors, chase upgrades' },
  { value: 'finance_ops', label: 'Finance & operations', description: 'Invoices, expenses, close' },
  { value: 'hr_recruiting', label: 'HR & recruiting', description: 'Onboarding, scheduling, sourcing' },
  { value: 'other', label: 'Something else', description: 'We will start you with the basics' },
] as const;

/** Mirrors features/contact/demo-qualifier-modal.tsx. Onboarding does NOT hide
 *  `1-10` for personal-email signups — that is a lead-qualification rule, and
 *  hiding a truthful option here would corrupt the captured data. */
export const COMPANY_SIZES: readonly OnboardingCompanySize[] = [
  '1-10', '11-50', '51-200', '201-1000', '1000+',
] as const;

const ALL_STEPS: readonly StepId[] = [
  'welcome', 'use-case', 'company', 'tools', 'slack', 'plan', 'done',
];

/** Self-host without Pipedream configured has no catalogue to offer, so the
 *  tools step is dropped rather than landing the user on a dead 501. */
export function buildSteps(connectorsEnabled: boolean): StepId[] {
  return ALL_STEPS.filter((id) => connectorsEnabled || id !== 'tools');
}

const SURVEY_STEPS: readonly StepId[] = ['use-case', 'company'];

/** The eyebrow counts SURVEY questions, not wizard steps — so dropping the
 *  tools step never renumbers it. */
export function surveyPosition(stepId: StepId): { index: number; total: number } | null {
  const i = SURVEY_STEPS.indexOf(stepId);
  return i === -1 ? null : { index: i + 1, total: SURVEY_STEPS.length };
}

/**
 * Prefill for the company-domain field. Consumer inboxes yield '' so we never
 * suggest `gmail.com` as somebody's employer.
 */
export function deriveCompanyDomain(email: string | null | undefined): string {
  const trimmed = (email ?? '').trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return '';
  const domain = trimmed.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return '';
  return isWorkEmail(trimmed) ? domain : '';
}

export interface StarterPrompt {
  /** Matching template under apps/web/content/use-cases/. */
  template: string;
  title: string;
  prompt: string;
}

const STARTER_PROMPTS: Record<OnboardingUseCase, StarterPrompt[]> = {
  sales: [
    { template: 'lead-follow-up', title: 'Follow up on new leads', prompt: 'Research every new inbound lead from this week and draft a personalized follow-up email for each one.' },
    { template: 'outbound-outreach', title: 'Draft outbound outreach', prompt: 'Build a list of 20 prospects matching our ICP and draft a first-touch email for each.' },
    { template: 'crm-hygiene', title: 'Clean up the CRM', prompt: 'Find duplicate, stale, and incomplete records in our CRM and propose a cleanup.' },
  ],
  support: [
    { template: 'customer-support', title: 'Draft ticket replies', prompt: 'Read the open support tickets and draft a reply for each one, citing our docs.' },
    { template: 'escalation-manager', title: 'Catch escalations early', prompt: 'Scan open tickets for accounts at risk of escalating and summarize why.' },
    { template: 'inbox-triage', title: 'Triage the shared inbox', prompt: 'Sort the shared inbox into urgent, waiting-on-us, and no-action-needed.' },
  ],
  marketing: [
    { template: 'brand-monitor', title: 'Monitor brand mentions', prompt: 'Find where we were mentioned online this week and summarize the sentiment.' },
    { template: 'competitor-watch', title: 'Watch competitors', prompt: 'Check our top three competitors for pricing, product, and messaging changes.' },
    { template: 'content-refresh', title: 'Refresh stale content', prompt: 'Find published posts that are out of date and propose specific edits.' },
  ],
  engineering: [
    { template: 'error-triage', title: 'Triage new errors', prompt: 'Group this week new production errors by root cause and rank them by user impact.' },
    { template: 'oncall-triage', title: 'Summarize on-call', prompt: 'Summarize the last on-call rotation: what paged, what was noise, what needs a fix.' },
    { template: 'dependency-upgrades', title: 'Chase dependency upgrades', prompt: 'List our outdated dependencies, flag the breaking ones, and propose an upgrade order.' },
  ],
  finance_ops: [
    { template: 'ap-invoice-processing', title: 'Process invoices', prompt: 'Read the invoices received this month, extract the line items, and flag anything unusual.' },
    { template: 'expense-reconciliation', title: 'Reconcile expenses', prompt: 'Match this month card transactions against submitted receipts and list the gaps.' },
    { template: 'month-end-close', title: 'Prep month-end close', prompt: 'Build the month-end close checklist and tell me what is still outstanding.' },
  ],
  hr_recruiting: [
    { template: 'employee-onboarding', title: 'Onboard a new hire', prompt: 'Build a first-week onboarding plan for a new hire and draft their welcome email.' },
    { template: 'interview-scheduler', title: 'Schedule interviews', prompt: 'Find times that work for the panel and draft the invites for this week candidates.' },
    { template: 'candidate-sourcing', title: 'Source candidates', prompt: 'Find candidates matching our open role and summarize why each one fits.' },
  ],
  other: [
    { template: 'meeting-notes', title: 'Turn notes into actions', prompt: 'Read my meeting notes and turn them into a list of owned action items.' },
    { template: 'inbox-triage', title: 'Triage my inbox', prompt: 'Sort my inbox into urgent, waiting-on-me, and no-action-needed.' },
    { template: 'competitor-watch', title: 'Watch the market', prompt: 'Check our top three competitors for pricing, product, and messaging changes.' },
  ],
};

/** `null` means the user skipped the survey — they still get useful prompts. */
export function starterPromptsFor(useCase: OnboardingUseCase | null): StarterPrompt[] {
  return STARTER_PROMPTS[useCase ?? 'other'];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/components/projects/onboarding/onboarding-profile.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit (only if asked)**

```bash
git add apps/web/src/components/projects/onboarding/onboarding-profile.ts apps/web/src/components/projects/onboarding/onboarding-profile.test.ts
git commit -m "feat(web): add pure onboarding profile logic"
```

---

### Task 4: Web — `StepShell` and `ChoiceRow` primitives

**Files:**
- Create: `apps/web/src/components/projects/onboarding/step-shell.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`, `cn` from `@/lib/utils`.
- Produces:
  ```tsx
  export function StepShell(props: {
    eyebrow?: string;
    title: string;
    description?: string;
    children?: React.ReactNode;
    primaryLabel: string;
    primaryDisabled?: boolean;
    onPrimary: () => void;
    skipLabel?: string;
    onSkip?: () => void;
  }): JSX.Element;

  export function ChoiceRow(props: {
    selected: boolean;
    label: string;
    description?: string;
    onSelect: () => void;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    disabled?: boolean;
  }): JSX.Element;

  export function StepProgress(props: { total: number; current: number }): JSX.Element;
  ```

There is no test for this task. These are presentational; their behaviour is asserted through the steps that use them and through the source-shape tests in Task 5.

- [ ] **Step 1: Write the primitives**

Create `apps/web/src/components/projects/onboarding/step-shell.tsx`:

```tsx
'use client';

/**
 * The only two shapes onboarding is allowed to draw.
 *
 * Every step renders inside `StepShell` and every selectable option is a
 * `ChoiceRow`. That constraint is the whole redesign: the previous wizard gave
 * each step its own container (a tile grid here, a full-bleed card there), which
 * is what made five screens read as five unrelated screens.
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function StepProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors duration-300',
            i < current ? 'bg-foreground/60' : i === current ? 'bg-foreground' : 'bg-foreground/15',
          )}
        />
      ))}
    </div>
  );
}

export function StepShell({
  eyebrow,
  title,
  description,
  children,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  skipLabel,
  onSkip,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-muted-foreground text-xs font-medium tracking-wide">{eyebrow}</p>
        )}
        <h1 className="text-foreground text-[26px] leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-[15px] leading-7">{description}</p>
        )}
      </div>

      {children}

      <div className="flex flex-col items-center gap-1">
        <Button className="w-full" size="lg" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </Button>
        {skipLabel && onSkip && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onSkip}>
            {skipLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ChoiceRow({
  selected,
  label,
  description,
  onSelect,
  leading,
  trailing,
  disabled,
}: {
  selected: boolean;
  label: string;
  description?: string;
  onSelect: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'border-border/60 bg-card flex w-full items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors',
        'hover:border-primary/40 hover:bg-primary/[0.03] disabled:pointer-events-none disabled:opacity-60',
        selected && 'border-primary/60 bg-primary/[0.04]',
      )}
    >
      {leading ?? (
        <span
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
            selected ? 'border-primary' : 'border-border',
          )}
        >
          {selected && <span className="bg-primary size-2 rounded-full" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground block truncate text-xs">{description}</span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "onboarding/step-shell" ; npx eslint src/components/projects/onboarding/step-shell.tsx`
Expected: no output from the grep, and eslint reports no errors.

- [ ] **Step 3: Commit (only if asked)**

```bash
git add apps/web/src/components/projects/onboarding/step-shell.tsx
git commit -m "feat(web): add onboarding StepShell and ChoiceRow primitives"
```

---

### Task 5: Web — shell refactor to a single 560px column

This is the task that fixes the reported problem. The steps still render their current content; only the frame changes. Steps get rewritten in Tasks 6–8.

**Files:**
- Modify: `apps/web/src/components/projects/project-onboarding-wizard.tsx` (whole file)
- Create: `apps/web/src/components/projects/onboarding/steps/welcome-step.tsx`
- Create: `apps/web/src/components/projects/onboarding/steps/tools-step.tsx` (move `ToolsStep` + `ToolTile` verbatim for now)
- Create: `apps/web/src/components/projects/onboarding/steps/slack-step.tsx` (move `SlackStep` + `SlackGlyph` verbatim)
- Modify: `apps/web/src/components/projects/project-onboarding-wizard.connectors.test.ts`
- Test: `apps/web/src/components/projects/onboarding/shell-layout.test.ts` (create)

**Interfaces:**
- Consumes: `buildSteps`, `surveyPosition`, `StepId` from Task 3; `StepProgress` from Task 4.
- Produces: `ProjectOnboardingWizard({ projectId })` at its existing path, so `features/workspace/project-layout/project-shell.tsx:8` is unchanged.

**Critical:** `project-onboarding-wizard.connectors.test.ts` reads the **raw source string** of `project-onboarding-wizard.tsx`. After `ToolsStep` moves, all three assertions fail. Repoint them at `onboarding/steps/tools-step.tsx` — do not delete them.

- [ ] **Step 1: Write the failing layout test**

Create `apps/web/src/components/projects/onboarding/shell-layout.test.ts`:

```ts
/**
 * The redesign has exactly one structural rule: nothing renders outside a
 * single 560px column. These assertions are on the source string because the
 * rule is about what the markup is ALLOWED to contain, not about runtime state.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const shell = readFileSync(join(ROOT, '..', 'project-onboarding-wizard.tsx'), 'utf8');
const tools = readFileSync(join(ROOT, 'steps', 'tools-step.tsx'), 'utf8');

describe('onboarding shell', () => {
  test('constrains the body to one 560px column', () => {
    expect(shell).toContain('max-w-[560px]');
    expect(shell).not.toContain('max-w-2xl');
  });

  test('drops the bordered footer bar in favour of an in-column primary', () => {
    expect(shell).not.toContain('StepPrimaryAction');
    expect(shell).not.toContain('border-t');
  });

  test('renders the inset panel frame', () => {
    expect(shell).toContain('fixed inset-0');
    expect(shell).toContain('rounded-xl border');
  });

  test('derives its step list from the shared helper', () => {
    expect(shell).toContain('buildSteps(');
    expect(shell).toContain('surveyPosition(');
  });
});

describe('tools step', () => {
  test('uses a vertical list, not a tile grid', () => {
    expect(tools).not.toContain('sm:grid-cols-3');
    expect(tools).not.toContain('grid-cols-2');
  });

  test('does not pin its own viewport-relative height', () => {
    expect(tools).not.toContain('42vh');
    expect(tools).not.toContain('46vh');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/projects/onboarding/shell-layout.test.ts`
Expected: FAIL — `steps/tools-step.tsx` does not exist yet.

- [ ] **Step 3: Move the step components out**

Move verbatim, changing only imports:
- `WelcomeStep` (`project-onboarding-wizard.tsx:359-414`) → `onboarding/steps/welcome-step.tsx`
- `ToolsStep` + `ToolTile` (`:418-628`) → `onboarding/steps/tools-step.tsx`
- `SlackStep` + `SlackGlyph` (`:632-758`) → `onboarding/steps/slack-step.tsx`

Each gets `'use client';` at the top and a named export.

- [ ] **Step 4: Rewrite the shell**

Replace `project-onboarding-wizard.tsx` with the frame only. Keep the file header comment, updating the step list it documents. Body:

```tsx
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-muted/30 fixed inset-0 z-[70] p-2"
        role="dialog"
        aria-modal="true"
        aria-label="Project setup"
      >
        <div className="border-border/60 bg-background flex h-full flex-col overflow-hidden rounded-xl border">
          <div className="flex items-center px-5 py-4 md:px-8">
            <div className="flex items-center gap-2.5">
              <KortixAsterisk index={0} />
              <span className="text-foreground text-sm font-semibold tracking-tight">
                Set up your project
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 pb-10 md:items-center md:px-8">
            <div className="w-full max-w-[560px] py-6">
              <div className="mb-8 flex items-center gap-3">
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground -ml-2 h-7 gap-1.5 px-2"
                    onClick={back}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                )}
                <StepProgress total={steps.length} current={index} />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={stepId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {/* step render switch — see Tasks 6-8 */}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
      {/* DemoQualifierModal unchanged */}
    </>
  );
```

Replace the local `steps` memo with `useMemo(() => buildSteps(connectorsEnabled), [connectorsEnabled])`. Delete `StepPrimaryAction` entirely — each step now owns its own primary through `StepShell`.

- [ ] **Step 5: Repoint the connectors test**

In `project-onboarding-wizard.connectors.test.ts`, change line 5 from reading `project-onboarding-wizard.tsx` to:

```ts
const source = readFileSync(
  join(import.meta.dir, 'onboarding', 'steps', 'tools-step.tsx'),
  'utf8',
);
```

All three existing assertions then apply to the file that actually owns `ConnectorProfileModal`. Do not change the assertions themselves.

- [ ] **Step 6: Run the tests**

Run: `cd apps/web && bun test src/components/projects`
Expected: PASS — `onboarding-profile.test.ts` (11), `shell-layout.test.ts` (6), `project-onboarding-wizard.connectors.test.ts` (3).

- [ ] **Step 7: Commit (only if asked)**

```bash
git add apps/web/src/components/projects
git commit -m "refactor(web): onboarding renders in one 560px column"
```

---

### Task 6: Web — the two survey steps

**Files:**
- Create: `apps/web/src/components/projects/onboarding/steps/use-case-step.tsx`
- Create: `apps/web/src/components/projects/onboarding/steps/company-step.tsx`
- Create: `apps/web/src/components/projects/onboarding/use-onboarding-answers.ts`
- Test: `apps/web/src/components/projects/onboarding/use-onboarding-answers.test.ts`
- Modify: `apps/web/src/components/projects/project-onboarding-wizard.tsx` (wire the two steps)

**Interfaces:**
- Consumes: `setProjectOnboardingProfile`, `OnboardingProfile` from `@kortix/sdk`; `USE_CASE_OPTIONS`, `COMPANY_SIZES`, `deriveCompanyDomain`, `surveyPosition` from Task 3; `StepShell`, `ChoiceRow` from Task 4.
- Produces:
  ```ts
  export function useOnboardingAnswers(projectId: string): {
    answers: OnboardingProfile;
    save: (patch: OnboardingProfile) => void;   // fire-and-forget
  };
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/projects/onboarding/use-onboarding-answers.test.ts`:

```ts
/**
 * Saves are fire-and-forget by design: a failed survey write must never block
 * navigation and must never raise a toast. The user did not ask to save
 * anything — they asked to move to the next step.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(import.meta.dir, 'use-onboarding-answers.ts'), 'utf8');

describe('useOnboardingAnswers', () => {
  test('persists through the SDK, never a raw fetch', () => {
    expect(source).toContain('setProjectOnboardingProfile');
    expect(source).not.toContain('fetch(');
  });

  test('swallows save failures instead of toasting', () => {
    expect(source).toContain('.catch(');
    expect(source).not.toContain('errorToast');
  });

  test('saves each answer as it is given, not only on finish', () => {
    expect(source).toContain('export function useOnboardingAnswers');
    expect(source).toContain('save');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/projects/onboarding/use-onboarding-answers.test.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Write the hook**

Create `apps/web/src/components/projects/onboarding/use-onboarding-answers.ts`:

```ts
'use client';

/**
 * Holds the survey answers locally and mirrors each one to the server as it is
 * given, so a user who abandons onboarding at the tools step still leaves their
 * use case and company behind.
 *
 * Saves are deliberately fire-and-forget. A failed profile write must not block
 * navigation and must not raise a toast: the user asked to advance a step, not
 * to save a form.
 */
import { useCallback, useState } from 'react';

import { setProjectOnboardingProfile, type OnboardingProfile } from '@kortix/sdk';

export function useOnboardingAnswers(projectId: string) {
  const [answers, setAnswers] = useState<OnboardingProfile>({});

  const save = useCallback(
    (patch: OnboardingProfile) => {
      setAnswers((prev) => ({ ...prev, ...patch }));
      void setProjectOnboardingProfile(projectId, patch).catch(() => {
        // Intentionally silent — see the module comment.
      });
    },
    [projectId],
  );

  return { answers, save };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/components/projects/onboarding/use-onboarding-answers.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the use-case step**

Create `apps/web/src/components/projects/onboarding/steps/use-case-step.tsx`:

```tsx
'use client';

import type { OnboardingUseCase } from '@kortix/sdk';

import { ChoiceRow, StepShell } from '../step-shell';
import { USE_CASE_OPTIONS } from '../onboarding-profile';

export function UseCaseStep({
  value,
  onSelect,
  onContinue,
  onSkip,
}: {
  value: OnboardingUseCase | null;
  onSelect: (v: OnboardingUseCase) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      eyebrow="Question 1 of 2"
      title="What will you use Kortix for?"
      description="We use this to pick the right starting points for you. You can change it later."
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={onContinue}
      skipLabel="Skip these questions"
      onSkip={onSkip}
    >
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Use case">
        {USE_CASE_OPTIONS.map((option) => (
          <ChoiceRow
            key={option.value}
            selected={value === option.value}
            label={option.label}
            description={option.description}
            onSelect={() => onSelect(option.value)}
          />
        ))}
      </div>
    </StepShell>
  );
}
```

- [ ] **Step 6: Write the company step**

Create `apps/web/src/components/projects/onboarding/steps/company-step.tsx`:

```tsx
'use client';

import type { OnboardingCompanySize } from '@kortix/sdk';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ChoiceRow, StepShell } from '../step-shell';
import { COMPANY_SIZES } from '../onboarding-profile';

export function CompanyStep({
  domain,
  size,
  onDomainChange,
  onSizeChange,
  onContinue,
  onSkip,
}: {
  domain: string;
  size: OnboardingCompanySize | null;
  onDomainChange: (v: string) => void;
  onSizeChange: (v: OnboardingCompanySize) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      eyebrow="Question 2 of 2"
      title="Tell us about your company"
      description="Your agent uses the domain to research your own company. Nothing is shared publicly."
      primaryLabel="Continue"
      onPrimary={onContinue}
      skipLabel="Skip these questions"
      onSkip={onSkip}
    >
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <Label htmlFor="onboarding-company-domain">Company domain</Label>
          <Input
            id="onboarding-company-domain"
            value={domain}
            onChange={(e) => onDomainChange(e.target.value)}
            placeholder="acme.com"
            autoComplete="organization"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label>Company size</Label>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Company size">
            {COMPANY_SIZES.map((option) => (
              <ChoiceRow
                key={option}
                selected={size === option}
                label={`${option} people`}
                onSelect={() => onSizeChange(option)}
              />
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  );
}
```

- [ ] **Step 7: Wire both steps into the shell**

In `project-onboarding-wizard.tsx`:

```tsx
  const { answers, save } = useOnboardingAnswers(projectId);
  const { user } = useAuth();

  // Prefill once, and never overwrite what the user has typed.
  const [domain, setDomain] = useState(() => deriveCompanyDomain(user?.email));

  const skipSurvey = useCallback(() => {
    setIndex(steps.indexOf('tools') === -1 ? steps.indexOf('slack') : steps.indexOf('tools'));
  }, [steps]);
```

Render branches:

```tsx
{stepId === 'use-case' && (
  <UseCaseStep
    value={answers.use_case ?? null}
    onSelect={(v) => save({ use_case: v })}
    onContinue={next}
    onSkip={skipSurvey}
  />
)}
{stepId === 'company' && (
  <CompanyStep
    domain={domain}
    size={answers.company_size ?? null}
    onDomainChange={setDomain}
    onSizeChange={(v) => save({ company_size: v })}
    onContinue={() => {
      const trimmed = domain.trim();
      if (trimmed) save({ company_domain: trimmed });
      next();
    }}
    onSkip={skipSurvey}
  />
)}
```

- [ ] **Step 8: Run the tests**

Run: `cd apps/web && bun test src/components/projects`
Expected: PASS, all suites.

- [ ] **Step 9: Commit (only if asked)**

```bash
git add apps/web/src/components/projects/onboarding
git commit -m "feat(web): ask for use case, company domain, and company size"
```

---

### Task 7: Web — tools step as a list, plan step absorbs the model step

**Files:**
- Modify: `apps/web/src/components/projects/onboarding/steps/tools-step.tsx`
- Create: `apps/web/src/components/projects/onboarding/steps/plan-step.tsx`
- Delete: the `ModelStep` function (was `project-onboarding-wizard.tsx:762-819`)
- Modify: `apps/web/src/components/projects/project-onboarding-wizard.tsx`

**Interfaces:**
- Consumes: `useModelConnectionGate` from `@/features/session/use-model-connection-gate`, which already returns `{ openConnectProvider, openUpgrade, modal, hasSelectableModels, showUpgradeOption }`. No new billing wiring.
- Produces: `ToolsStep`, `PlanStep`.

- [ ] **Step 1: Convert the tools grid to a list**

In `tools-step.tsx`:
- Replace `<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">` with `<div className="flex flex-col gap-2">`.
- Replace `ToolTile` with `ChoiceRow`, passing the app icon as `leading` and a `Plus` (or `<Loading />` while pending) as `trailing`. `selected` is `existingSlugs.includes(app.slug)`.
- Replace `max-h-[42vh] min-h-[180px]` with `max-h-[320px]`. The column, not the viewport, sets the bound.
- Replace the `Tabs` with a single disclosure `Button` reading "Connect a custom API instead" that reveals `CustomConnectorForm`. The step asks one thing; a tab bar makes it ask two.
- Skeletons become `h-[56px] w-full rounded-md`, six of them.
- Wrap the whole thing in `StepShell` with `primaryLabel="Continue"`, `skipLabel="Skip for now"`.

- [ ] **Step 2: Write the plan step**

Create `apps/web/src/components/projects/onboarding/steps/plan-step.tsx`:

```tsx
'use client';

import { useState } from 'react';

import { flattenModels } from '@/features/session/session-chat-input';
import { useModelConnectionGate } from '@/features/session/use-model-connection-gate';
import { useRuntimeProviders } from '@kortix/sdk/react';

import { ChoiceRow, StepShell } from '../step-shell';

type PlanChoice = 'free' | 'paid';

/**
 * Absorbs what used to be a separate "Connect a model" step. Picking a paid
 * plan IS how a user gets Kortix models; `Start free` routes to
 * bring-your-own-key. Two steps would have asked the same question twice.
 *
 * Never a gate. `Continue` is always enabled — the composer enforces model
 * connection later if the user declines both.
 */
export function PlanStep({ onContinue }: { onContinue: () => void }) {
  const { data: providers } = useRuntimeProviders();
  const { openConnectProvider, openUpgrade, modal, hasSelectableModels, showUpgradeOption } =
    useModelConnectionGate(flattenModels(providers));
  const [choice, setChoice] = useState<PlanChoice | null>(null);

  return (
    <>
      {modal}
      <StepShell
        title="How do you want to start?"
        description={
          hasSelectableModels
            ? 'A model is already connected. Pick a plan now or stay on free — you can change this anytime.'
            : 'Your agent needs a model to think with. Both options take under a minute.'
        }
        primaryLabel="Continue"
        onPrimary={onContinue}
      >
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Plan">
          <ChoiceRow
            selected={choice === 'free'}
            label="Start free"
            description="Explore Kortix and bring your own API key from Anthropic, OpenAI, or any provider."
            onSelect={() => {
              setChoice('free');
              openConnectProvider('providers');
            }}
          />
          {showUpgradeOption && (
            <ChoiceRow
              selected={choice === 'paid'}
              label="Start with a paid plan"
              description="Instant access to Kortix models, higher limits, and priority support."
              onSelect={() => {
                setChoice('paid');
                openUpgrade();
              }}
            />
          )}
        </div>
      </StepShell>
    </>
  );
}
```

- [ ] **Step 3: Delete `ModelStep` and wire `PlanStep`**

Remove the `ModelStep` function and its `KeyRound` / `CreditCard` imports from the shell. Add:

```tsx
{stepId === 'plan' && <PlanStep onContinue={next} />}
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/web && bun test src/components/projects`
Expected: PASS. `shell-layout.test.ts` now passes its grid and `42vh` assertions.

- [ ] **Step 5: Commit (only if asked)**

```bash
git add apps/web/src/components/projects/onboarding apps/web/src/components/projects/project-onboarding-wizard.tsx
git commit -m "feat(web): tools as a list, plan step replaces the model step"
```

---

### Task 8: Web — personalized finish step

**Files:**
- Create: `apps/web/src/components/projects/onboarding/steps/done-step.tsx`
- Modify: `apps/web/src/components/projects/project-onboarding-wizard.tsx`
- Test: `apps/web/src/components/projects/onboarding/done-step.test.ts`

**Interfaces:**
- Consumes: `starterPromptsFor` from Task 3.
- Produces: `DoneStep({ useCase, profileCount, onStart, onUsePrompt })`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/projects/onboarding/done-step.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(import.meta.dir, 'steps', 'done-step.tsx'), 'utf8');

describe('done step', () => {
  test('derives its prompts from the survey answer', () => {
    expect(source).toContain('starterPromptsFor');
  });

  test('renders prompts as the shared row primitive', () => {
    expect(source).toContain('ChoiceRow');
  });

  test('stays inside the column — no full-bleed card', () => {
    expect(source).not.toContain('vh]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/projects/onboarding/done-step.test.ts`
Expected: FAIL — `steps/done-step.tsx` does not exist.

- [ ] **Step 3: Write the step**

Create `apps/web/src/components/projects/onboarding/steps/done-step.tsx`:

```tsx
'use client';

import { CheckIcon as Check } from '@phosphor-icons/react';
import type { OnboardingUseCase } from '@kortix/sdk';

import { ChoiceRow, StepShell } from '../step-shell';
import { starterPromptsFor } from '../onboarding-profile';

/**
 * The payoff for the two survey screens. Picking a prompt completes onboarding
 * AND seeds the composer, so the first thing the user sees after setup is work
 * already in progress rather than an empty box.
 */
export function DoneStep({
  useCase,
  profileCount,
  onStart,
  onUsePrompt,
}: {
  useCase: OnboardingUseCase | null;
  profileCount: number;
  onStart: () => void;
  onUsePrompt: (prompt: string) => void;
}) {
  const prompts = starterPromptsFor(useCase);

  return (
    <StepShell
      title="You're all set"
      description={
        profileCount > 0
          ? `Your command center is ready with ${profileCount} ${profileCount === 1 ? 'tool' : 'tools'} connected. Pick a starting point, or jump straight in.`
          : 'Your command center is ready. Pick a starting point, or jump straight in.'
      }
      primaryLabel="Start building"
      onPrimary={onStart}
    >
      <div className="flex flex-col gap-2">
        {prompts.map((p) => (
          <ChoiceRow
            key={p.template}
            selected={false}
            label={p.title}
            description={p.prompt}
            leading={<Check className="text-kortix-green size-4 shrink-0" />}
            onSelect={() => onUsePrompt(p.prompt)}
          />
        ))}
      </div>
    </StepShell>
  );
}
```

- [ ] **Step 4: Wire it**

In the shell:

```tsx
{stepId === 'done' && (
  <DoneStep
    useCase={answers.use_case ?? null}
    profileCount={connectorSlugs.length}
    onStart={complete}
    onUsePrompt={(prompt) => {
      onboardingPromptRef.current = prompt;
      void complete();
    }}
  />
)}
```

Seed the composer by writing the prompt to the existing draft store the session composer already reads. If no such store is reachable from this component, `onUsePrompt` falls back to `complete()` alone and the prompt is dropped — **do not invent a new global store for this.** Record which path was taken in the final report.

- [ ] **Step 5: Run the tests**

Run: `cd apps/web && bun test src/components/projects`
Expected: PASS, all suites.

- [ ] **Step 6: Commit (only if asked)**

```bash
git add apps/web/src/components/projects
git commit -m "feat(web): personalize the onboarding finish step"
```

---

### Task 9: Gates

- [ ] **Step 1: Web tests**

Run: `cd apps/web && bun test src/components/projects`
Expected: PASS. Paste real output.

- [ ] **Step 2: API tests**

Run: `cd apps/api && bun test --isolate src/projects/routes`
Expected: PASS. Paste real output.

- [ ] **Step 3: SDK tests + typecheck**

Run: `cd packages/sdk && bun test --isolate src && pnpm typecheck`
Expected: PASS. Paste real output.

- [ ] **Step 4: Web typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: only the ~15 known `@types/bun` `test.each` errors in `app/(system)/api/og/template/template-url.test.ts`, `features/file-viewer/preview-fit.test.tsx`, and `features/session/action-panel/easy/easy-panel-logic.test.ts`. **Any `TS2786` is a duplicate-`@types/react` regression — investigate, do not wave it through.**

- [ ] **Step 5: Lint the touched files**

Run: `cd apps/web && npx eslint src/components/projects`
Expected: zero errors.

- [ ] **Step 6: Confirm nothing references the deleted symbols**

Run: `grep -rn "StepPrimaryAction\|ModelStep\|ToolTile" apps/web/src || echo "clean"`
Expected: `clean`.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| D1 project metadata storage | 2 |
| D2 personalized finish screen | 3, 8 |
| D3 one question per screen | 6 |
| D4 domain + size on one screen | 6 |
| D5 two-option plan radio | 7 |
| D6 model step absorbed | 7 |
| D7 footer removed | 5 |
| 560px column rule | 4, 5 |
| `StepShell` / `ChoiceRow` primitives | 4 |
| Use case options + starter prompts | 3 |
| Company size scale reuse | 3 |
| `metadataMergeSubtree` persistence | 2 |
| SDK function | 1 |
| Save-on-selection | 6 |
| Error handling: silent profile failure | 6 |
| Error handling: plan step never gates | 7 |
| Existing source-string tests repointed | 5 |
| Gates | 9 |

No spec requirement is unassigned.

**Placeholder scan:** One deliberate conditional remains — Task 8 Step 4's composer seeding, which depends on a store this plan does not assume exists. It states the fallback explicitly and forbids inventing a new store, so the executor cannot stall on it.

**Type consistency:** `OnboardingUseCase`, `OnboardingCompanySize`, and `OnboardingProfile` are defined once in Task 1 and imported from `@kortix/sdk` everywhere after. `StepId` is defined once in Task 3. `buildSteps`, `surveyPosition`, `deriveCompanyDomain`, `starterPromptsFor` keep identical signatures across Tasks 3, 5, 6, and 8.
