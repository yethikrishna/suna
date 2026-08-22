'use client';

/**
 * Which surface draws the session plan, as a hook both surfaces read.
 *
 * There are two candidates and they must never both mount: `PlanPanelCard` in
 * the Easy panel's card column, and the plan card under a user message in the
 * transcript. `turn/plan-anchor.ts`'s `planBelongsToChat` holds the rule; this
 * is the only place that gathers the live state it needs.
 *
 * ONE hook, not a predicate copied into each consumer. The regression this
 * replaces came from exactly that: `session-chat.tsx` and `easy-panel.tsx`
 * each called `useIsMobile()` and each drew its own conclusion, so the three
 * desktop states where the panel column is on screen but not VISIBLE
 * (collapsed, covered by a detail panel, Advanced mode) left both surfaces
 * standing down and the plan rendered nowhere. Reading one hook means the two
 * answers are the same answer.
 */

import { useIsSidePanelOpen, useIsActionPanelOpen } from '@/stores/kortix-computer-store';
import { useUserPreferencesStore } from '@/stores/user-preferences-store';
import { useIsMobile } from '@/hooks/utils';

import { planBelongsToChat } from './turn/plan-anchor';

/**
 * True when the TRANSCRIPT owns the plan, false when the Easy panel does.
 *
 * The chat is the fallback, deliberately. Every state this returns true for is
 * one where the panel is not drawing the plan, and a plan that has moved is
 * recoverable in a way a plan that has vanished is not — collapse the panel
 * mid-run and the checklist reappears in the transcript rather than leaving
 * the session with no plan at all.
 */
export function usePlanInChat(): boolean {
  const isMobile = useIsMobile();
  const panelOpen = useIsActionPanelOpen();
  // The right-hand detail panel (terminal, browser, files, a file preview)
  // takes the whole right side; `session-action-panel-column.tsx` gives the
  // card column `hidden` for as long as it is up.
  const detailOpen = useIsSidePanelOpen();
  // Users whose preferences were persisted before `panelMode` existed have no
  // key — same `?? 'easy'` default `action-panel/index.tsx` applies.
  const panelMode = useUserPreferencesStore((s) => s.preferences.panelMode ?? 'easy');

  return planBelongsToChat({ isMobile, panelOpen, detailOpen, panelMode });
}
