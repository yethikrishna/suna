/**
 * Shape rules for individual steps that the column refactor depends on.
 *
 * These are source assertions for the same reason as `shell-layout.test.ts`:
 * "this step does not render a tile grid" and "this step never gates" are
 * properties of the markup, invisible to a rendering test that only ever
 * exercises the happy path.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const step = (name: string) => readFileSync(join(import.meta.dir, 'steps', name), 'utf8');

const tools = step('tools-step.tsx');
const plan = step('plan-step.tsx');
const slack = step('slack-step.tsx');
const company = step('company-step.tsx');

describe('tools step', () => {
  test('uses a vertical list, not a tile grid', () => {
    expect(tools).not.toContain('grid-cols-2');
    expect(tools).not.toContain('sm:grid-cols-3');
    expect(tools).toContain('<ChoiceRow');
  });

  // The column sets the bound, not the viewport. A vh-relative height made this
  // the tallest step in the flow on large screens.
  test('does not pin its own viewport-relative height', () => {
    expect(tools).not.toContain('vh]');
  });

  // The step asks exactly one thing: which apps. The custom-API escape hatch
  // lives on the Connectors page, not inside onboarding.
  test('asks one thing — no tabs, no custom-API branch', () => {
    expect(tools).not.toContain('<Tabs');
    expect(tools).not.toContain('TabsTrigger');
    expect(tools).not.toContain('Connect a custom API');
    expect(tools).not.toContain('CustomConnectorForm');
  });

  // The fade says "there is more" without putting a scrollbar on screen.
  test('fades the scroll edges instead of showing a hard cut', () => {
    expect(tools).toContain('FadedScrollArea');
  });

  test('keeps the accessible name that distinguishes adding another profile', () => {
    expect(tools).toContain('aria-label={`Add ${app.name} profile`}');
  });
});

describe('slack step', () => {
  // Was a bordered card, a button inside it, and a disclosure beneath — three
  // unrelated shapes on a screen where every other step is a list of rows.
  test('offers both install paths as the shared row primitive', () => {
    expect(slack).toContain('<ChoiceRow');
    expect(slack).toContain('Add to Slack');
    expect(slack).toContain('Use a custom Slack app');
  });

  test('collapses to a single confirmed state once connected', () => {
    expect(slack).toContain('Connected to Slack');
  });

  // The custom-app setup sits BESIDE the chooser, not on top of it. An earlier
  // pass replaced the whole step with a sub-view, which hid what the user came
  // from — they are still adding Kortix to Slack, just by a longer route.
  test('opens the custom app as a second pane, not a replacement', () => {
    expect(slack).toContain('xl:flex-row');
    expect(slack).toContain('<motion.aside');
    expect(slack).toContain('Bring your own Slack app');
    // No drill-in: the chooser is never unmounted to make room.
    expect(slack).not.toContain("key={pane}");
  });

  // FLIP-derived transforms, not an animated width — a width animation would
  // lay out and paint every frame.
  test('shifts the chooser with a layout animation', () => {
    expect(slack).toContain('layout={!reduced}');
  });

  // Below xl there is no room for two panes side by side.
  test('stacks the pane underneath on narrow screens', () => {
    expect(slack).toContain('flex-col');
    expect(slack).toContain('xl:w-[420px]');
  });
});

describe('company step', () => {
  test('uses an input group with an icon for the domain', () => {
    expect(company).toContain('InputGroup');
    expect(company).toContain('GlobeIcon');
  });

  // Two separate questions on one screen must read as two, not as a form.
  test('separates the two questions properly', () => {
    expect(company).toContain('space-y-10');
  });
});

describe('plan step', () => {
  test('reuses the shared model-connection gate rather than new billing wiring', () => {
    expect(plan).toContain('useModelConnectionGate');
    expect(plan).not.toContain('useUpgradeDialogStore');
  });

  // The composer enforces model connection later. Blocking here would strand a
  // user who wants to look around before paying.
  test('never gates — Continue carries no disabled condition', () => {
    expect(plan).not.toContain('primaryDisabled');
  });

  // With billing disabled there is no <GlobalUpgradeModal/> mounted to respond,
  // so an Upgrade row would be a dead click.
  test('hides the paid option when billing is unavailable', () => {
    expect(plan).toContain('showUpgradeOption');
  });

  test('offers three ways forward, including deferring', () => {
    expect(plan).toContain('<ChoiceRow');
    expect(plan).toContain('Use Kortix models');
    expect(plan).toContain('Bring your own API key');
    expect(plan).toContain('Decide later');
  });

  // THE fix for this step. Clicking a row used to fire a modal instantly: the
  // user taps to consider an option, gets a whole separate flow thrown at them,
  // backs out, and loses the thread. Selection must only select.
  test('opens nothing on selection — the action is deferred to Continue', () => {
    expect(plan).not.toContain('openUpgrade();\n            }}');
    expect(plan).toContain('const handleContinue');
    // Each onSelect does exactly one thing: record the choice.
    for (const choice of ['kortix', 'byok', 'later']) {
      expect(plan).toContain(`onSelect={() => setChoice('${choice}')}`);
    }
  });

  // The modal that opens should never be a surprise, so the button names it.
  test('labels the primary with what it will actually do', () => {
    expect(plan).toContain("'See plans'");
    expect(plan).toContain("'Add a key'");
  });

  // An earlier version short-circuited to a confirm-only screen when a model
  // was already connected, which stranded anyone who wanted to add a second
  // provider or move onto a plan. A connected model is context, not an answer.
  test('keeps every option available even when a model is already connected', () => {
    expect(plan).not.toContain('if (hasSelectableModels)');
    expect(plan).toContain('Connect another provider');
    expect(plan).toContain('Keep what I have');
  });
});
