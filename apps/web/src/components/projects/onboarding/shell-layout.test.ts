/**
 * The alignment contract.
 *
 * The redesign rests on one rule — every element in a step starts at the same
 * left edge — and the previous version failed it in four separate ways at
 * once: it centred the column and the content inside it, stretched the actions
 * edge-to-edge, and centre-aligned two whole steps. No amount of spacing or
 * motion work fixed how that read, so the rule is asserted rather than trusted.
 *
 * Source assertions, because "nothing here is centred" is a property of the
 * markup that a rendering test cannot see.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(import.meta.dir, ...p), 'utf8');

const shell = read('..', 'project-onboarding-wizard.tsx');
const stepShell = read('step-shell.tsx');

const STEPS = [
  'use-case-step.tsx',
  'company-step.tsx',
  'tools-step.tsx',
  'slack-step.tsx',
  'plan-step.tsx',
  'done-step.tsx',
] as const;

describe('the rail', () => {
  test('is a single fixed width', () => {
    expect(shell).toContain('max-w-[640px]');
    expect(shell).not.toContain('max-w-2xl');
  });

  // A full-bleed button belongs to both edges and therefore to neither. This
  // was the single most visible alignment break.
  test('actions are auto-width, never stretched', () => {
    expect(stepShell).not.toContain('w-full active:scale');
    expect(stepShell).not.toContain('flex-1 active:scale');
    expect(stepShell).toContain('items-start');
  });

  test('no step centres its own content', () => {
    for (const step of STEPS) {
      const src = read('steps', step);
      expect(`${step}: ${src.includes('text-center')}`).toBe(`${step}: false`);
      expect(`${step}: ${src.includes('items-center justify-center')}`).toBe(`${step}: false`);
      expect(`${step}: ${src.includes('mx-auto')}`).toBe(`${step}: false`);
    }
  });

  test('every step renders through the shared shell', () => {
    for (const step of STEPS) {
      expect(`${step}: ${read('steps', step).includes('<StepShell')}`).toBe(`${step}: true`);
    }
  });
});

describe('chrome', () => {
  test('carries no branding and no progress widget', () => {
    expect(shell).not.toContain('KortixAsterisk');
    expect(shell).not.toContain('Set up your project');
    expect(shell).not.toContain('StepProgress');
  });

  // The count lives on the rail as the first line, so it shares the left edge
  // with everything else instead of floating in the header.
  test('the step count is a rail line, not a floating element', () => {
    expect(shell).toContain('stepLabel(index, steps.length)');
    expect(stepShell).toContain('stepLabel');
    expect(stepShell).toContain('tabular-nums');
  });

  test('keeps a back control and nothing else', () => {
    expect(shell).toContain('aria-label="Back"');
  });

  // The welcome screen is gone, so the founder CTA has to survive somewhere or
  // the deletion silently dropped a conversion path.
  test('keeps the founder call reachable from the finish step', () => {
    expect(shell).toContain('showFounderCall');
  });

  test('holds no step bodies of its own', () => {
    expect(shell).not.toContain('function WelcomeStep');
    expect(shell).not.toContain('function ToolsStep');
    expect(shell).not.toContain('function SlackStep');
  });
});

describe('options', () => {
  // Uniform height is most of what makes a grid read as deliberate rather than
  // assembled — a staggered row is the tell.
  test('single-line cards share one fixed height', () => {
    expect(stepShell).toContain('h-[52px]');
  });

  // A sentence of helper text under every choice is padding, and padding is
  // what makes an interface feel generated.
  test('use case options are label-only', () => {
    const useCase = read('steps', 'use-case-step.tsx');
    expect(useCase).not.toContain('description={option.description}');
  });
});
