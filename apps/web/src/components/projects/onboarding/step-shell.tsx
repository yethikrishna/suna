'use client';

/**
 * The onboarding layout primitives.
 *
 * One rule governs all of them: **every element starts at the same left edge.**
 * The counter, the headline, the sub-copy, the options, and the actions share
 * one x. That is the whole reason this reads as structured — the previous
 * version left-aligned its text, stretched its buttons edge-to-edge, and
 * centred two of its steps, so no two elements agreed on where a line begins.
 *
 * Consequences worth stating, because they are easy to undo by accident:
 *   - Buttons are AUTO-WIDTH. A `w-full` or `flex-1` button spans to both edges
 *     and stops participating in the rail.
 *   - Nothing is centred. No `mx-auto`, no `items-center`, no `text-center`.
 *   - Options are uniform cards on a grid, not bespoke rows per step.
 */

import { CheckIcon as Check } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function StepShell({
  stepLabel,
  title,
  description,
  children,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  /** e.g. "2 of 6". First line of the rail. */
  stepLabel?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-col items-start">
      {stepLabel && (
        <p className="text-muted-foreground text-xs font-medium tabular-nums">{stepLabel}</p>
      )}

      <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-tight">{title}</h1>

      {description && (
        // Capped by character count, not by the container: a measure this long
        // stays readable without the paragraph running to the rail's full width.
        <p className="text-muted-foreground mt-2 max-w-[56ch] text-sm leading-6">{description}</p>
      )}

      {children && <div className="mt-8 w-full">{children}</div>}

      {/* Auto-width and left-aligned. Stretching these to the rail's full width
          is what broke the alignment before — a full-bleed button belongs to
          both edges and therefore to neither. */}
      <div className="mt-10 flex items-center gap-2.5">
        <Button size="lg" onClick={onPrimary} disabled={primaryDisabled} className="min-w-[132px]">
          {primaryLabel}
        </Button>
        {secondaryLabel && onSecondary && (
          <Button size="lg" variant="outline" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Two columns of uniform cards. The shape Okta, Attio, and Postman all use. */
export function OptionGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * One option. Fixed height so a grid row never staggers, which is most of what
 * makes a grid read as deliberate rather than assembled.
 *
 * `description` switches it to a taller two-line card — use it only where the
 * distinction between options genuinely needs a sentence. Adding a line of
 * helper text under every choice is filler, and filler is what makes an
 * interface feel generated.
 */
export function OptionCard({
  selected,
  label,
  description,
  icon,
  onSelect,
  onPreload,
  disabled,
  trailing,
  'aria-label': ariaLabel,
}: {
  selected: boolean;
  label: string;
  description?: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Hover/focus hook for prefetching a lazily-loaded surface behind this card. */
  onPreload?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onSelect}
      onPointerEnter={onPreload}
      onFocus={onPreload}
      className={cn(
        'bg-popover flex w-full items-center gap-3 rounded-md border px-4 text-left',
        description ? 'py-3' : 'h-[52px]',
        'transition-[background-color,border-color] duration-150',
        'hover:border-primary/30 hover:bg-primary/[0.03]',
        'focus-visible:ring-kortix-base focus-visible:ring-[0.6px] focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        selected && 'border-primary/50 bg-primary/[0.05]',
      )}
    >
      {icon && <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground mt-0.5 block text-xs leading-5">{description}</span>
        )}
      </span>
      {trailing ?? (selected && <Check className="text-primary size-4 shrink-0" />)}
    </button>
  );
}
