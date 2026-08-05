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

  // Asking someone to pick a model source when one is already connected is a
  // question with no answer that matters.
  test('skips the question entirely when a model is already connected', () => {
    expect(plan).toContain('if (hasSelectableModels)');
  });
});
