/**
 * The redesign has exactly one structural rule: nothing renders outside a
 * single 560px column.
 *
 * These assertions read the source string because the rule is about what the
 * markup is ALLOWED to contain, not about runtime state. A rendering test would
 * pass just as happily with a `max-w-2xl` container as with a `max-w-[560px]`
 * one — the defect being fixed here is invisible to the DOM API and visible
 * only in the classes.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const shell = readFileSync(
  join(import.meta.dir, '..', 'project-onboarding-wizard.tsx'),
  'utf8',
);

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
    expect(shell).toContain('rounded-md border');
  });

  // rounded-xl / rounded-2xl are banned on app containers by the design system.
  // The spec and plan both originally specified rounded-xl for this panel.
  test('uses no banned container radius', () => {
    expect(shell).not.toContain('rounded-xl');
    expect(shell).not.toContain('rounded-2xl');
  });

  test('derives its step list from the shared helper', () => {
    expect(shell).toContain('buildSteps(');
  });

  // Every step body lives in its own module; the shell is a frame, not a
  // grab-bag. Guards against the file drifting back into a 850-line monolith.
  test('holds no step bodies of its own', () => {
    expect(shell).not.toContain('function WelcomeStep');
    expect(shell).not.toContain('function ToolsStep');
    expect(shell).not.toContain('function SlackStep');
    expect(shell).not.toContain('function ModelStep');
  });

  // The top bar is a back control and progress. Nothing competes with the
  // question — no mark, no title, no product name.
  test('carries no branding in the chrome', () => {
    expect(shell).not.toContain('KortixAsterisk');
    expect(shell).not.toContain('Set up your project');
  });

  test('renders progress centred and a back control, nothing else', () => {
    expect(shell).toContain('<StepProgress');
    expect(shell).toContain('justify-center');
    expect(shell).toContain('aria-label="Back"');
  });

  // The welcome screen is gone, so the founder-concierge CTA has to survive
  // somewhere or the deletion silently dropped a conversion path.
  test('keeps the founder call reachable from the finish step', () => {
    expect(shell).toContain('showFounderCall');
    expect(shell).toContain('onBookCall');
  });
});

describe('step shell primitive', () => {
  const stepShell = readFileSync(join(import.meta.dir, 'step-shell.tsx'), 'utf8');

  // "Question 1 of 2" told the user how much interrogation was left. The
  // progress bar already does that, more quietly.
  test('has no eyebrow prop at all', () => {
    expect(stepShell).not.toContain('eyebrow');
  });

  // A skip tucked directly beneath the primary reads as a footnote to it. Side
  // by side, as a secondary, it reads as the other choice — which it is.
  test('renders skip as a secondary sibling of the primary', () => {
    expect(stepShell).toContain('variant="outline"');
    expect(stepShell).toContain('gap-3');
  });

  test('puts real distance between the content and the actions', () => {
    expect(stepShell).toContain('mt-10');
  });
});
