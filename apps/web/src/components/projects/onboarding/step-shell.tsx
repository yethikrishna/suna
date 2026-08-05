'use client';

/**
 * The only two shapes onboarding is allowed to draw.
 *
 * Every step renders inside `StepShell` and every selectable option is a
 * `ChoiceRow`. That constraint IS the redesign: the previous wizard gave each
 * step its own container — a tile grid here, a full-bleed card there — which is
 * what made five screens read as five unrelated screens rather than one flow.
 *
 * Adding an eighth step must never require inventing new chrome.
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * One segment per wizard step. Sits at the top of the column, not in the header
 * bar — the reference flows keep progress with the content it describes.
 */
/**
 * Six short ticks, centred in the top bar. Segments rather than one continuous
 * bar so the flow states honestly how much is left — "six short things" is a
 * promise a filling bar cannot make.
 */
export function StepProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex w-[200px] items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors duration-300',
            i < current ? 'bg-foreground/50' : i === current ? 'bg-foreground' : 'bg-foreground/15',
          )}
        />
      ))}
    </div>
  );
}

export function StepShell({
  title,
  description,
  children,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  skipLabel,
  onSkip,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="space-y-2.5">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm leading-6 text-pretty">{description}</p>
        )}
      </div>

      {children && <div className="mt-8">{children}</div>}

      {/* Skip and Continue are siblings with real distance between them and from
          the content above. A skip tucked directly under the primary reads as a
          footnote to it; side by side it reads as the other choice, which is
          what it is. */}
      <div className="mt-10 flex items-center gap-3">
        {skipLabel && onSkip && (
          <Button
            size="lg"
            variant="outline"
            className="flex-1 active:scale-[0.96]"
            onClick={onSkip}
          >
            {skipLabel}
          </Button>
        )}
        <Button
          size="lg"
          className="flex-1 active:scale-[0.96]"
          onClick={onPrimary}
          disabled={primaryDisabled}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

export function ChoiceRow({
  selected,
  label,
  description,
  onSelect,
  leading,
  trailing,
  disabled,
  'aria-label': ariaLabel,
}: {
  selected: boolean;
  label: string;
  description?: string;
  onSelect: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  /**
   * Overrides the accessible name when the visible label alone would mislead.
   * The tools step needs this: a connected app still offers "Add <app> profile",
   * because a second profile for the same provider is legal and the row's
   * selected state would otherwise read as "already done, nothing to do here".
   */
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
      className={cn(
        // py-3 + two text lines clears the 40px minimum hit area comfortably.
        'bg-popover flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left',
        // Named properties, never `transition-all`. Scale is 0.99, not the usual
        // 0.96: at the column's 560px this row is wide enough that 4% reads as a
        // lurch rather than a press.
        'transition-[background-color,border-color,scale] duration-150 active:scale-[0.99]',
        'hover:border-primary/30 hover:bg-primary/[0.03]',
        'focus-visible:ring-kortix-base focus-visible:ring-[0.6px] focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        // Selection is a tinted primary wash, never `bg-muted`.
        selected && 'border-primary/40 bg-primary/[0.05]',
      )}
    >
      {leading ?? (
        <span
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
            selected ? 'border-primary' : 'border-border',
          )}
        >
          {selected && <span className="bg-primary size-2 rounded-full" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-sm font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground block truncate text-xs">{description}</span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}
