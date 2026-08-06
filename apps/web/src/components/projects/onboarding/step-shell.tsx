'use client';

/**
 * The shared shapes onboarding is allowed to draw.
 *
 * Every step renders inside `StepShell`. Survey choices use `SelectionRow`.
 * Actions use `ActionRow`. Optional supporting content uses `StepContext`.
 *
 * Adding an eighth step must never require inventing new chrome.
 */

import { motion, useReducedMotion } from 'motion/react';
import { useId, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

import { contextVariants } from './motion';

const rowClassName = cn(
  'border-border bg-popover text-foreground flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-left',
  'transition-[background-color,border-color,scale] duration-150 active:scale-[0.99]',
  'hover:border-primary/30 hover:bg-primary/[0.03]',
  'focus-visible:ring-kortix-base focus-visible:ring-[0.6px] focus-visible:outline-none',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
);

/**
 * Six short ticks, centred in the top bar. Segments rather than one continuous
 * bar so the flow states honestly how much is left — "six short things" is a
 * promise a filling bar cannot make.
 */
export function StepProgress({ total, current }: { total: number; current: number }) {
  return (
    <div
      className="flex w-[200px] items-center gap-1.5"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            // 200ms, not 300: a 1px tick taking longer than a dropdown reads as lag.
            'h-1 flex-1 rounded-full transition-colors duration-200',
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
  context,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  skipLabel?: string;
  onSkip?: () => void;
  context?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col">
      <div className="space-y-2.5">
        <h1
          id="onboarding-step-title"
          tabIndex={-1}
          className="text-foreground text-2xl font-semibold tracking-tight text-balance focus:outline-none"
        >
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

      {context}
    </div>
  );
}

export function StepContext({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.aside
      variants={contextVariants(reduced)}
      initial="enter"
      animate="center"
      exit="exit"
      className="mt-6 w-full xl:absolute xl:top-0 xl:left-[calc(100%+2rem)] xl:mt-0 xl:w-[340px]"
    >
      {children}
    </motion.aside>
  );
}

export function SelectionRow({
  value,
  label,
  description,
  leading,
  disabled,
}: {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        rowClassName,
        'has-data-[state=checked]:border-primary/40 has-data-[state=checked]:bg-primary/[0.05]',
        'has-focus-visible:ring-kortix-base has-focus-visible:ring-[0.6px] has-focus-visible:outline-none',
        disabled && 'pointer-events-none cursor-not-allowed opacity-50',
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground block text-xs text-pretty">{description}</span>
        )}
      </span>
      <RadioGroupItem id={id} value={value} disabled={disabled} />
    </label>
  );
}

export function ActionRow({
  label,
  description,
  leading,
  trailing,
  active,
  disabled,
  onSelect,
  onPreload,
}: {
  label: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onPreload?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onSelect}
      onPointerEnter={onPreload}
      onFocus={onPreload}
      className={cn(rowClassName, active && 'border-primary/40 bg-primary/[0.05]')}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground block text-xs text-pretty">{description}</span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}

/** @deprecated Use SelectionRow or ActionRow for new onboarding steps. */
export function ChoiceRow({
  selected,
  label,
  description,
  onSelect,
  leading,
  trailing,
  disabled,
  onPreload,
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
   * Fired on hover and focus, ahead of any click. Rows that reveal a
   * lazily-loaded surface use this to fetch the chunk early — otherwise the
   * download and parse land in the middle of the open animation and drop
   * frames. Must stay idempotent and cheap; it can fire many times.
   */
  onPreload?: () => void;
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
      onPointerEnter={onPreload}
      onFocus={onPreload}
      className={cn(rowClassName, selected && 'border-primary/40 bg-primary/[0.05]')}
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
