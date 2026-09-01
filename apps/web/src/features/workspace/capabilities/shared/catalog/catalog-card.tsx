'use client';

import type { CSSProperties, ReactNode } from 'react';

import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface CatalogCardProps {
  leading?: ReactNode;
  title: ReactNode;
  description?: string | null;
  badges?: ReactNode;
  trailing?: ReactNode;
  /** A card that NAVIGATES renders as a real `next/link` — prefetched, middle-
   *  clickable, and a client transition rather than a `router.push` from a
   *  button (see the no-hard-refresh nav contract). Cards that open a modal
   *  in place keep `onClick`. Exactly one of the two. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function CatalogCard({
  leading,
  title,
  description,
  badges,
  trailing,
  href,
  onClick,
  disabled,
  className,
  style,
}: CatalogCardProps) {
  const classes = cn(
    'bg-accent/50 group border-border/60  flex w-full items-start gap-3 rounded-md border px-4 py-3.5 text-left',
    'transition-[background-color,border-color] duration-150 ease-out',
    'hover:bg-accent hover:border-border',
    'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
    disabled && 'pointer-events-none opacity-60',
    className,
  );
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-center gap-1.5">
          <span className="text-foreground truncate text-sm font-medium">{title}</span>
          {badges}
        </span>
        {description ? (
          <span className="text-muted-foreground line-clamp-2 text-xs text-pretty">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch
        aria-disabled={disabled || undefined}
        style={style}
        className={classes}
      >
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style} className={classes}>
      {body}
    </button>
  );
}
