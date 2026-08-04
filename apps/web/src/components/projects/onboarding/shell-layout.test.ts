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

  test('derives its step list and survey numbering from the shared helpers', () => {
    expect(shell).toContain('buildSteps(');
    expect(shell).toContain('surveyPosition(');
  });

  // Every step body lives in its own module; the shell is a frame, not a
  // grab-bag. Guards against the file drifting back into a 850-line monolith.
  test('holds no step bodies of its own', () => {
    expect(shell).not.toContain('function WelcomeStep');
    expect(shell).not.toContain('function ToolsStep');
    expect(shell).not.toContain('function SlackStep');
    expect(shell).not.toContain('function ModelStep');
  });
});
