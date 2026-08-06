# Task 1 Report: Onboarding Context Rail Test Contract

## Status

Complete. The four requested onboarding test files now define the Task 2 and Task 3 implementation contract.

## Files Changed

- `apps/web/src/components/projects/onboarding/shell-layout.test.ts`
  - Requires the fixed `max-w-[520px]` decision lane.
  - Rejects Slack-specific shell widening.
  - Requires `w-[340px]` context-rail geometry.
  - Requires `role="progressbar"`.
- `apps/web/src/components/projects/onboarding/steps-shape.test.ts`
  - Requires `SelectionRow` for the use-case and plan selections.
  - Requires `ActionRow` for tools and Slack actions.
  - Requires `StepContext` for Slack custom setup.
  - Rejects the Slack `xl:flex-row` layout and tools radio-group semantics.
- `apps/web/src/components/projects/onboarding/done-step.test.ts`
  - Requires `ActionRow` for starter prompts.
- `apps/web/src/components/projects/onboarding/motion.test.ts`
  - Requires `contextVariants(reduced)`.
  - Requires an opacity fade with rail-direction travel normally.
  - Requires opacity-only context replacement with reduced motion.

## Test Execution

The command specified by the brief does not select a workspace in this checkout:

```bash
pnpm --filter web test apps/web/src/components/projects/onboarding/shell-layout.test.ts apps/web/src/components/projects/onboarding/steps-shape.test.ts apps/web/src/components/projects/onboarding/motion.test.ts apps/web/src/components/projects/onboarding/done-step.test.ts
```

Output:

```text
No projects matched the filters in "/Users/jay/root/kortix/suna-onboarding"
```

The web workspace is named `Kortix-Computer-Frontend`, and its test script runs from `apps/web`. I ran this equivalent focused command:

```bash
pnpm --filter Kortix-Computer-Frontend test src/components/projects/onboarding/shell-layout.test.ts src/components/projects/onboarding/steps-shape.test.ts src/components/projects/onboarding/motion.test.ts src/components/projects/onboarding/done-step.test.ts
```

Output summary:

```text
32 pass
11 fail
1 error
71 expect() calls
Ran 43 tests across 4 files.
Exit status 1
```

All failures are expected before Task 2 and Task 3. They identify missing `max-w-[520px]`, fixed shell geometry, `w-[340px]`, accessible progress, `SelectionRow`, `ActionRow`, `StepContext`, and `contextVariants`. The error is the expected missing `contextVariants` export from `motion.ts`.

## Self-review

- Edited only the four test files named by the brief, plus this required report.
- Used each required literal from the brief verbatim.
- Replaced obsolete widening and `ChoiceRow` expectations with the target semantic primitives.
- Ran `git diff --check`; it reported no whitespace errors.

## Concerns

- The brief's `--filter web` selector is stale for this checkout. Use `--filter Kortix-Computer-Frontend` and paths relative to `apps/web` until the package name or command is corrected.

## Review Follow-up

### Fixes

- Added `xl:left-[calc(100%+2rem)]` to protect the required 32px rail gap.
- Strengthened reduced-motion coverage to require `opacity` values for enter, center, and exit.
- Restricted reduced-motion context states to `opacity` and `transition` properties only.
- Added normal and reduced-motion checks that reject width, height, spacing, and inset animation properties.
- Required both row primitives to share `rowClassName`.
- Required `rounded-md`, `bg-popover`, `border-border`, and `text-foreground` row styling.
- Rejected direct neutral palette classes and banned container radii in `step-shell.tsx`.

### Test Execution

Command:

```bash
pnpm --filter Kortix-Computer-Frontend test src/components/projects/onboarding/shell-layout.test.ts src/components/projects/onboarding/steps-shape.test.ts src/components/projects/onboarding/motion.test.ts src/components/projects/onboarding/done-step.test.ts
```

Output:

```text
32 pass
12 fail
1 error
72 expect() calls
Ran 44 tests across 4 files.
Exit status 1
```

The 12 failures identify missing Task 2 and Task 3 geometry, primitive, and step migrations. The error identifies the missing Task 2 `contextVariants` export. No failure identifies a test syntax, fixture, or environment defect.

### Self-review

- The 32px assertion uses the implementation plan's exact `2rem` offset.
- The reduced-motion assertion rejects all animated properties except `opacity` and `transition`.
- The layout-property assertion checks normal and reduced variants.
- The row-style assertion requires one shared class contract across `SelectionRow` and `ActionRow`.
- `git diff --check` reports no whitespace errors.
