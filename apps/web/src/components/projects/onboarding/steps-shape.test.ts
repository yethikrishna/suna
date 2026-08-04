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

  // The step asks one thing. A tab bar makes it ask two.
  test('offers the custom connector as a disclosure, not a second tab', () => {
    expect(tools).not.toContain('<Tabs');
    expect(tools).not.toContain('TabsTrigger');
    expect(tools).toContain('Connect a custom API instead');
  });

  test('keeps the accessible name that distinguishes adding another profile', () => {
    expect(tools).toContain('aria-label={`Add ${app.name} profile`}');
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

  test('renders both options as the shared row primitive', () => {
    expect(plan).toContain('<ChoiceRow');
    expect(plan).toContain('Start free');
  });
});
