# Project onboarding redesign — design

- **Date:** 2026-08-05
- **Branch:** `onboarding` (worktree `suna-onboarding`)
- **Surface:** `apps/web/src/components/projects/project-onboarding-wizard.tsx`
- **Linear team:** JAY

## Problem

The project onboarding wizard opened for a brand-new project reads busy and
unfocused. Three specific defects:

1. **No single content width.** The shell declares `max-w-2xl` (672px) at
   `project-onboarding-wizard.tsx:218`, but individual steps break out of it:
   the tools step renders a `grid-cols-2 sm:grid-cols-3` tile grid inside a
   `max-h-[42vh]` scroller, and the Slack and model steps render full-bleed
   centered cards. Each step invents its own container, so the flow reads as
   five unrelated screens rather than one.
2. **It asks nothing about the user.** The flow collects connectors, a Slack
   install, and a model. It never learns what the user wants to do, who they
   work for, or how big their company is — so the finish screen cannot say
   anything specific, and sales has no qualification signal from self-serve
   signup.
3. **No plan step.** Upgrading is buried as one of two buttons inside the model
   step. There is no moment in the flow that presents choosing a plan as a
   decision.

## Non-goals

- Changing when the wizard opens. It still self-gates on
  `metadata.onboarding_completed_at` being absent.
- Changing Slack install behaviour. Polling, gating, and the custom-Slack-app
  fallback stay exactly as they are.
- Account-level company profile storage. Explicitly rejected — see Decisions.
- Localisation. The repo's hardcoded-UI i18n keys are still ungenerated for this
  component; that remains true after this change and is called out in the file
  header comment as it is today.

## References

Both flows were read screen-by-screen from Mobbin before designing.

- **Laravel Cloud onboarding** — <https://mobbin.com/flows/93a93e48-c570-4843-8780-d78b2da20a42> (19 screens)
  - Full-viewport page, thin inset panel, minimal top bar, quiet footer.
  - One narrow centered column (~520px) for every step without exception.
  - Survey steps: `Question 1 of 3` eyebrow, segmented progress bar, one
    headline, a stack of bordered single-select rows, one full-width dark
    primary button, one quiet `Skip survey` text link beneath it.
  - Plan step: two bordered radio rows (`Start without a card` / `Start with a
    paid plan`) above a full-width `Continue`.
- **Replit onboarding** — <https://mobbin.com/flows/bf2d66e8-7abb-48d0-9d04-317e39ff65c7> (16 screens)
  - Personalization vocabulary: "Where do you plan to use Replit?" and "How much
    experience do you have?" rendered as short segmented chip rows.

The operative lesson: Laravel Cloud stays calm across 19 screens because every
screen asks exactly one thing using exactly one row primitive. Screen count is
not what makes onboarding feel heavy; container variety is.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | All answers persist in `projects.metadata.onboarding` | No migration. `kortix.accounts` has no `metadata` jsonb column, so account-level storage would require a schema change, API surface, and SDK surface. Accepted cost: a second project re-asks for domain and size. |
| D2 | Answers personalize the finish screen | The use case selects three starter prompts on the final step. Domain and size are captured only. The user gets something visible back for the two extra screens. |
| D3 | One question per screen | Matches both references. Collapsing questions onto one card produces a denser screen, which is the defect being fixed. |
| D4 | Domain and size share one screen | They are one thought ("about your company") and both are short controls. Survey is therefore 2 screens, not 3. |
| D5 | Plan step is a two-option radio | Laravel Cloud's exact shape. Inline pricing cards were rejected as too heavy for a flow whose goal is spaciousness. |
| D6 | The model step is absorbed by the plan step | Picking a paid plan is how a user gets Kortix models; `Start free` routes to bring-your-own-key. Keeping both would add a screen that asks the same question twice. |
| D7 | The bordered footer bar is removed | The primary action moves into the column as a full-width button with the skip link beneath it. One less piece of chrome, and it is what both references do. |

## Design

### Shell

One rule governs the whole redesign: **no step renders outside a single 560px
column.**

- Canvas: `fixed inset-0 z-[70]` on `bg-muted/30`, containing an inset panel
  (`m-2 rounded-xl border bg-background`). This is the Laravel Cloud frame.
- Top bar: `KortixAsterisk` + "Set up your project". Nothing else. The progress
  indicator moves out of the header.
- Body: a single `max-w-[560px]` centered column. Steps fill it; nothing exceeds
  it.
- Footer bar: deleted. See D7.
- Progress: a segmented bar at the top of the column, one segment per step.

### Primitives

Two components carry every screen. Adding a step must not require new chrome.

**`StepShell`** — the frame for all seven steps:

```
eyebrow?        e.g. "Question 1 of 2"
h1              the single question or statement
sub-copy?       one or two sentences
children        the step's controls
primary         full-width button
skip?           quiet text link beneath the primary
```

**`ChoiceRow`** — bordered selectable row with a selection dot, a label, and an
optional description. Used by the use case list, the company size list, the
tools list, and the plan list.

### Steps

Seven steps. `Question N of 2` applies to steps 2 and 3 only.

| # | Step | Asks | Notes |
|---|------|------|-------|
| 1 | Welcome | — | Unchanged, keeps the `usePersonalContactTier() === 'personal'` founder branch and the `DemoQualifierModal`. |
| 2 | Use case | "What will you use Kortix for?" | 7 `ChoiceRow`s. Single select. |
| 3 | Your company | Domain + size | `Input` prefilled from the signup email domain when `isWorkEmail()` passes; size as `ChoiceRow`s. |
| 4 | Connect your tools | — | Vertical `ChoiceRow` list replaces the tile grid. Custom-connector form moves behind a disclosure link, not a tab. |
| 5 | Add to Slack | — | Behaviour unchanged. |
| 6 | Choose your plan | "How do you want to start?" | Two `ChoiceRow`s. `Start with a paid plan` opens the existing `useUpgradeDialogStore` modal. |
| 7 | You're all set | — | Three starter prompts selected by the step-2 answer. |

Step 4 is skipped entirely when `isConnectorsEnabled()` is false, exactly as
today.

### Use case options and starter prompts

Options and prompts map onto templates that already exist in
`apps/web/content/use-cases/`. Nothing is invented.

| Option | Starter prompt templates |
|--------|--------------------------|
| Sales | `lead-follow-up`, `outbound-outreach`, `crm-hygiene` |
| Customer support | `customer-support`, `escalation-manager`, `inbox-triage` |
| Marketing | `brand-monitor`, `competitor-watch`, `content-refresh` |
| Engineering | `error-triage`, `oncall-triage`, `dependency-upgrades` |
| Finance & operations | `ap-invoice-processing`, `expense-reconciliation`, `month-end-close` |
| HR & recruiting | `employee-onboarding`, `interview-scheduler`, `candidate-sourcing` |
| Something else | `meeting-notes`, `inbox-triage`, `competitor-watch` |

### Company size options

Reuses the canonical set already shipped in
`apps/web/src/features/contact/demo-qualifier-modal.tsx:39` so a user who both
onboards and books a demo is never offered two different scales:
`1-10`, `11-50`, `51-200`, `201-1000`, `1000+`.

The demo qualifier hides `1-10` for personal-email signups. Onboarding does
**not** replicate that filter — it is a lead-qualification rule, not a data
model rule, and hiding a truthful option here would corrupt the captured data.

### Persistence

`PATCH /v1/projects/:projectId/onboarding` gains an optional `profile` object:

```jsonc
{
  "completed": true,          // existing, unchanged
  "profile": {                // new, all fields optional
    "use_case": "sales",
    "company_domain": "acme.com",
    "company_size": "51-200"
  }
}
```

Written with `metadataMergeSubtree('onboarding', profile)` from
`apps/api/src/projects/lib/metadata-merge.ts:59`, which re-reads the current
nested value in SQL. This matters: a top-level `||` merge of a whole sub-object
would let two concurrent writers lose each other's update one level down, and
`onboarding_completed_at` already lives at the top level.

`onboarding_completed_at` keeps its current top-level position and its current
set/delete semantics. The two writes are independent.

**Answers save on selection, not on finish.** A user who drops out at step 5
still leaves their step-2 and step-3 answers behind. Saves are fire-and-forget:
a failed profile write must never block navigation, and never surfaces an error
toast — the user did not ask to save anything.

### SDK surface

`packages/sdk` is a published package with a hard rule that adding an export is
three synchronized edits and that exported names are a public API contract.
This change adds one function:

```ts
setProjectOnboardingProfile(projectId: string, profile: OnboardingProfile)
```

`setProjectOnboardingComplete` is untouched — renaming or changing it would be a
breaking change. Per `packages/sdk/AGENTS.md`, TDD is mandatory for this file
and the gates must be run with real output pasted.

## Error handling

| Failure | Behaviour |
|---------|-----------|
| Profile save rejects | Swallowed. Navigation continues. No toast. The answer is lost; onboarding is not. |
| `listPipedreamApps` returns 501 | Existing `InfoBanner` "not configured on this deployment" path, unchanged. |
| Slack install never lands | Existing poll + `Skip` path, unchanged. |
| Upgrade modal dismissed | Step 6 stays on screen. `Continue` is always enabled — the plan step is never a gate. |
| `getProjectDetail` not yet hydrated | Wizard renders nothing, as today (`shouldRender = isPending`). |

## Testing

Per the repo `testing` skill, every change ships with tests in the same change.

**Unit — co-located `bun:test`:**

- Step list derivation with and without `isConnectorsEnabled()`.
- `Question N of 2` numbering stays correct when step 4 is absent.
- Company-domain prefill: derives from a work-email address, stays empty for a
  consumer domain, and never overwrites a value the user has typed.
- Starter-prompt selection returns three templates for every use-case option,
  including the fallback branch.
- Skip semantics: skipping the survey advances past both survey steps.

**API — co-located `bun:test`:**

- `PATCH /onboarding` with a `profile` body writes
  `metadata.onboarding.use_case` and leaves a pre-existing
  `metadata.default_sandbox_provider` intact.
- `PATCH /onboarding` with `completed: true` and no `profile` does not clear a
  previously written profile.

**Existing tests:** `project-onboarding-wizard.connectors.test.ts` asserts
against the **raw source string** of `project-onboarding-wizard.tsx`. Splitting
the component into modules breaks all three assertions. They must be repointed
at the module that ends up owning `ConnectorProfileModal` in the same change —
not deleted.

**Gates:** `tsc --noEmit` for `apps/web` (clean apart from the ~15 known
`@types/bun` `test.each` errors in 3 unrelated files) and `npx eslint` on the
touched files, error-free.

## Risks

- **Two extra screens before value.** Mitigated by D2 (the finish screen pays
  them back) and by the survey being skippable in one click.
- **Per-project re-asking.** Accepted under D1. If it becomes a complaint, the
  fix is an account-level column and a migration, not a redesign.
- **Source-string tests.** Called out above; the plan must treat repointing them
  as part of the refactor task, not a follow-up.
