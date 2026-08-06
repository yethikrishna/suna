# Task 2 Report: Shared Onboarding Context Frame

## Status

Complete. The shared frame, context rail, row primitives, focus behavior, and context motion contract are implemented.

## Files Changed

- `apps/web/src/components/projects/project-onboarding-wizard.tsx`
  - Replaced the custom dialog overlay with `Modal` and `ModalContent`.
  - Disabled the close button, outside-click close, Escape-close, and overlay/content animations.
  - Preserved the 8px inset full-frame panel with important size and transform overrides.
  - Fixed every step to one `max-w-[520px]` decision lane.
  - Removed the Slack-specific shell widening branch.
  - Added Escape-back behavior for every step after index `0`.
  - Moves focus to `#onboarding-step-title` on the next animation frame after `stepId` changes.
- `apps/web/src/components/projects/onboarding/step-shell.tsx`
  - Exposed segmented progress as a named `progressbar` with `min`, `max`, and current values.
  - Added the optional `context` slot to `StepShell`.
  - Added the focusable `#onboarding-step-title` target.
  - Added `StepContext` with a responsive stacked layout and a fixed `340px` desktop rail.
  - Positioned the desktop rail `32px` to the right of the `520px` decision lane.
  - Added `SelectionRow` around the existing `RadioGroupItem` primitive.
  - Added button-based `ActionRow` with active, disabled, select, and preload behavior.
  - Kept `ChoiceRow` as a deprecated compatibility export for the Task 3 step migration.
  - Shared one semantic-token `rowClassName` across all row primitives.
- `apps/web/src/components/projects/onboarding/motion.ts`
  - Added `contextVariants(reduced)`.
  - Normal motion enters and exits `24px` toward the rail side.
  - Reduced motion uses opacity only and creates no transform.
  - Context motion does not animate layout properties.

## Focused Tests

Command:

```bash
pnpm --filter Kortix-Computer-Frontend test src/components/projects/onboarding/shell-layout.test.ts src/components/projects/onboarding/steps-shape.test.ts src/components/projects/onboarding/motion.test.ts src/components/projects/onboarding/done-step.test.ts
```

Output:

```text
51 pass
6 fail
218 expect() calls
Ran 57 tests across 4 files.
Exit status 1
```

All Task 2 shared-shell and motion assertions pass. These six Task 3 assertions remain red:

1. `done step > renders prompts as the shared row primitive`
2. `use-case step > uses selection semantics for its single survey answer`
3. `tools step > uses a vertical list, not a tile grid`
4. `slack step > offers both install paths as the shared row primitive`
5. `slack step > opens the custom app in the shared context rail`
6. `plan step > offers three ways forward, including deferring`

## ESLint

Command:

```bash
pnpm --filter Kortix-Computer-Frontend exec eslint src/components/projects/project-onboarding-wizard.tsx src/components/projects/onboarding/step-shell.tsx src/components/projects/onboarding/motion.ts
```

Output:

```text
0 errors
1 warning
```

The warning is the existing `react-hooks/set-state-in-effect` warning at `project-onboarding-wizard.tsx:120`. It points to the unchanged `setIndex(0)` reset behavior.

## Typecheck

Command:

```bash
pnpm --filter Kortix-Computer-Frontend exec tsc --noEmit --pretty false
```

Output:

```text
15 errors in 3 existing test files
Exit status 2
```

All 15 errors match the documented `@types/bun` `test.each` and implicit parameter errors. The typecheck reports no error in a Task 2 file.

## Self-review

- `git diff --check` reports no whitespace errors.
- Prettier formatted all three source files.
- The row primitives use semantic tokens and `rounded-md`.
- The modal uses the canonical primitive and retains an inset frame on mobile and desktop.
- Important overrides defeat the canonical bottom-sheet and desktop-centering dimensions without changing `Modal` globally.

## Concerns

- Task 3 must migrate six step modules before all focused assertions pass and before `ChoiceRow` can be removed.
- This task does not render the context rail yet because no step supplies the new `context` slot until Task 3.
- Browser verification is deferred to the integrated Task 3 flow because the rail is not reachable in the current intermediate state.

## Fix Round 1

### Fixes

- Replaced the document-wide RAF title lookup with an `AnimatedStep` frame ref.
- Focus now moves after the entering frame completes its `center` animation.
- The frame ref queries only its own `[data-onboarding-step-title]` descendant.
- Each `StepShell` title now receives a unique React `useId()`-based ID.
- Concurrent `popLayout` frames no longer create duplicate `#onboarding-step-title` IDs.
- Added `motion-reduce:active:scale-100` to the shared row class.
- Added the same reduced-motion guard to the primary, skip, and Back actions.
- Corrected the concern above from five to six `ChoiceRow` step modules.
- Added four source-contract assertions for focus scoping, unique IDs, and reduced-motion press feedback.

The six modules are `company-step.tsx`, `done-step.tsx`, `plan-step.tsx`, `slack-step.tsx`, `tools-step.tsx`, and `use-case-step.tsx`.

### Regression Test: Red

Command:

```bash
pnpm --filter Kortix-Computer-Frontend test src/components/projects/onboarding/shell-layout.test.ts
```

Output:

```text
17 pass
4 fail
42 expect() calls
Ran 21 tests across 1 file.
Exit status 1
```

The four failures identified the document-wide title lookup, duplicate title ID, Back press scale, and StepShell/row press scale.

### Regression Test: Green

Command:

```bash
pnpm --filter Kortix-Computer-Frontend test src/components/projects/onboarding/shell-layout.test.ts
```

Output:

```text
21 pass
0 fail
46 expect() calls
Ran 21 tests across 1 file.
Exit status 0
```

### Focused Tests

Command:

```bash
pnpm --filter Kortix-Computer-Frontend test src/components/projects/onboarding/shell-layout.test.ts src/components/projects/onboarding/steps-shape.test.ts src/components/projects/onboarding/motion.test.ts src/components/projects/onboarding/done-step.test.ts
```

Output:

```text
55 pass
6 fail
226 expect() calls
Ran 61 tests across 4 files.
Exit status 1
```

All Task 2 assertions pass. The same six Task 3 assertions remain red.

### ESLint

Command:

```bash
pnpm --filter Kortix-Computer-Frontend exec eslint src/components/projects/project-onboarding-wizard.tsx src/components/projects/onboarding/step-shell.tsx src/components/projects/onboarding/motion.ts
```

Output:

```text
0 errors
1 warning
```

The warning is the unchanged `react-hooks/set-state-in-effect` warning at `project-onboarding-wizard.tsx:141`.

### Typecheck

Command:

```bash
pnpm --filter Kortix-Computer-Frontend exec tsc --noEmit --pretty false
```

Output:

```text
15 errors in 3 existing test files
Exit status 2
```

All 15 errors match the documented Bun `test.each` typing errors. No Task 2 file reports a type error.
