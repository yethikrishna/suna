# Task 3 Report: Onboarding Step Context

## Status

Complete. All six onboarding steps use the Task 2 semantic primitives. No `ChoiceRow` export, import, or use remains.

## Changes

| Before | After |
| --- | --- |
| Use-case and company answers used button rows with manual radio roles. | Both lists use controlled `RadioGroup` roots and `SelectionRow` items. |
| Tool search used a hand-composed icon and input. | Tool search uses `InputGroupSearch`, `InputGroupSearchIcon`, and `InputGroupSearchInput`. |
| Tool connections used selection semantics. | Tool connections use `ActionRow` and retain the `Add <app> profile` accessible name. |
| Tool status appeared below the list. | A functional `StepContext` reports the connected profile count and explains provider authorization. |
| Custom Slack setup widened and moved the decision lane with layout motion. | The lazy `SlackConnectForm` renders in `StepContext` with the existing preload, `380px` scroll bound, and matching skeleton. |
| Plan options used manual radio rows and an inline model status banner. | A controlled `RadioGroup` uses `SelectionRow`. The context title and copy derive from `choice`, `hasSelectableModels`, and `showUpgradeOption`. |
| Starter prompts used radio semantics. | Starter prompts use `ActionRow` and keep the existing `onUsePrompt` callback. |
| The done primary label was `Start building`. | The primary label is `Open project`. A setup-summary context appears when `profileCount > 0`. |
| Stacked context rendered after the actions. | `StepShell` renders context before actions on narrow layouts. Desktop context remains in the fixed rail. |
| `ActionRow` could not override its accessible name. | `ActionRow` accepts and forwards `aria-label`. |

## Preserved Contracts

- `UseCaseStep`, `CompanyStep`, `ToolsStep`, `SlackStep`, `PlanStep`, and `DoneStep` keep their existing prop signatures.
- `ToolsStep` keeps `useInfiniteQuery`, `listPipedreamApps`, `useToolConnect`, pagination, `ConnectorProfileModal`, and its mutation payload.
- `SlackStep` keeps `useSlackMode`, `useSlackInstall`, popup installation, 2.5-second polling, lazy loading, hover/focus preload, and `install.refetch()` after custom connection.
- `PlanStep` keeps `useRuntimeProviders`, `useModelConnectionGate`, `openUpgrade`, `openConnectProvider`, and deferred modal actions in `handleContinue`.
- `DoneStep` keeps `starterPromptsFor`, `onUsePrompt`, `onStart`, and the founder-call callback.

## TDD Evidence

Initial focused command:

```bash
pnpm --filter Kortix-Computer-Frontend test src/components/projects/onboarding/shell-layout.test.ts src/components/projects/onboarding/steps-shape.test.ts src/components/projects/onboarding/motion.test.ts src/components/projects/onboarding/done-step.test.ts
```

Initial output:

```text
55 pass
6 fail
226 expect() calls
Ran 61 tests across 4 files.
Exit status 1
```

The six failures matched the six required primitive and context migrations.

Final focused output from the same command:

```text
61 pass
0 fail
232 expect() calls
Ran 61 tests across 4 files.
Exit status 0
```

## All Onboarding Tests

Command:

```bash
pnpm --filter Kortix-Computer-Frontend test src/components/projects/onboarding
```

Output:

```text
82 pass
0 fail
344 expect() calls
Ran 82 tests across 6 files.
Exit status 0
```

## ESLint

Command:

```bash
pnpm --filter Kortix-Computer-Frontend exec eslint src/components/projects/onboarding/step-shell.tsx src/components/projects/onboarding/steps/use-case-step.tsx src/components/projects/onboarding/steps/company-step.tsx src/components/projects/onboarding/steps/tools-step.tsx src/components/projects/onboarding/steps/slack-step.tsx src/components/projects/onboarding/steps/plan-step.tsx src/components/projects/onboarding/steps/done-step.tsx src/components/projects/onboarding/steps-shape.test.ts
```

Output:

```text
No output.
Exit status 0.
```

## TypeScript

Command:

```bash
pnpm --filter Kortix-Computer-Frontend exec tsc --noEmit --pretty false
```

Output:

```text
15 errors in 3 files.
Exit status 1.
```

All 15 errors are the documented existing `@types/bun` `test.each` and implicit-parameter errors in:

- `src/app/(system)/api/og/template/template-url.test.ts`
- `src/features/file-viewer/preview-fit.test.tsx`
- `src/features/session/action-panel/easy/easy-panel-logic.test.ts`

TypeScript reports no error in an onboarding file.

## Static Checks

- `git diff --check` reports no whitespace error.
- `rg -n "ChoiceRow" apps/web/src` returns no match.
- Prettier completed on the shared primitive, six step files, and updated source-contract test.

## Concerns

- Browser geometry and interaction verification remains part of Task 4. This task did not start the local stack or create screenshots.
- TypeScript remains non-zero because of the 15 documented unrelated Bun test typing errors.
