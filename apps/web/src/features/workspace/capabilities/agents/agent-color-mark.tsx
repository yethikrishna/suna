'use client';

import { THEME_COLOR_SWATCH, THEME_COLORS } from '@/features/workspace/customize/sections/view/agent-editor-catalog';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

/**
 * The agent's badge colour as something a class or a style can paint. A
 * named theme colour maps through the editor's own swatch table, so the mark
 * here and the swatch in the editor are the same colour by construction; a
 * hex paints inline. Anything else — or nothing — is the muted ring, so a
 * list of agents keeps its alignment whether or not every one is coloured.
 */
export function agentColorPaint(color: string | null | undefined): {
  className?: string;
  style?: CSSProperties;
} {
  if (color && (THEME_COLORS as readonly string[]).includes(color)) {
    return { className: THEME_COLOR_SWATCH[color as (typeof THEME_COLORS)[number]] };
  }
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return { style: { backgroundColor: color } };
  return { className: 'bg-muted-foreground/25' };
}

/**
 * The colour mark beside an agent's name — on its card, in its page header,
 * in the compact bar. Stored per agent as `color:` in its frontmatter and
 * edited under Basics › Badge colour; the session list tints the agent's
 * badge with the same value, so the mark is how a person recognises the
 * agent across surfaces.
 */
export function AgentColorMark({
  color,
  size = 'sm',
  className,
}: {
  color: string | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const paint = agentColorPaint(color);
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-full',
        size === 'md' ? 'size-3' : 'size-2.5',
        paint.className,
        className,
      )}
      style={paint.style}
    />
  );
}
