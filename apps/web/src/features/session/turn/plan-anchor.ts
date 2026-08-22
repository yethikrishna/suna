/**
 * Which user message owns the plan card.
 *
 * `PlanCard` renders LIVE session todo state (`useRuntimeSessionTodo` + the
 * `todo.updated` SSE event), so exactly ONE turn may show it — the same
 * checklist repeated under every message would read as several plans.
 *
 * That single slot used to be "the last turn". The plan therefore migrated
 * onto each new message the user sent, even when that message never touched
 * the plan: ask a follow-up question, and the checklist from three turns ago
 * reappeared underneath it as though the question had produced it.
 *
 * Anchor it to the turn that actually wrote the todos instead. A later
 * re-plan moves the anchor forward, because that turn is now where the plan
 * was made.
 *
 * ONLY ASKED WHEN THE CHAT OWNS THE PLAN. The Easy panel draws it instead
 * whenever its card column is actually on screen — that card is session-scoped
 * and needs no anchor at all. `planBelongsToChat` below decides which surface
 * is live, and `chatPlanAnchorId` turns this whole module off for the other.
 * See `action-panel/easy/plan-card.tsx`.
 *
 * No React import. Every rule here is unit-tested in plan-anchor.test.ts.
 */
import { isToolPart, type MessageWithParts } from '@/ui';

/**
 * Both spellings reach the UI — the registry registers `todowrite` and
 * `todo_write`, and `action-panel/shared/narration.ts` maps both to "plan".
 */
export function isPlanWriteTool(tool: string): boolean {
  return tool === 'todowrite' || tool === 'todo_write';
}

export function planAnchorMessageId(
  allMessages: ReadonlyArray<MessageWithParts>,
): string | null {
  let currentUserId: string | null = null;
  let anchorId: string | null = null;
  let lastUserId: string | null = null;

  for (const message of allMessages) {
    if (message.info.role === 'user') {
      currentUserId = message.info.id;
      lastUserId = message.info.id;
      continue;
    }

    // A todo write before any user message belongs to no turn — skip it
    // rather than anchoring the card above the transcript.
    if (currentUserId === null) continue;

    if (message.parts.some((part) => isToolPart(part) && isPlanWriteTool(part.tool))) {
      anchorId = currentUserId;
    }
  }

  // No turn wrote todos, yet the session may still hold some: compaction drops
  // old parts, and the todo list comes from the runtime rather than from the
  // transcript. Fall back to the last turn so the plan stays reachable.
  return anchorId ?? lastUserId;
}

/**
 * Where the plan is drawn right now.
 *
 * Exactly one surface may mount it: `PlanPanelCard` in the Easy panel, or the
 * card under a user message in the transcript. Two would render the same live
 * checklist twice; zero would lose it.
 *
 * This used to be `isMobile` alone, which was a proxy standing in for the real
 * question and got it wrong in three states. Width tells you a panel COLUMN
 * exists; it does not tell you the column is currently drawing anything. On
 * desktop the column is hidden whenever:
 *
 *   - the user collapses it (the chevron, or Cmd/Ctrl+I) — the column animates
 *     to `width: 0` and goes `inert`, so the card is mounted, invisible, and
 *     unreachable by pointer and screen reader alike;
 *   - a detail panel is up (terminal, browser, files, a file preview) — the
 *     column takes `hidden` and steps aside entirely;
 *   - the panel is in Advanced mode, which renders a stepper and no cards at
 *     all.
 *
 * In each the panel had no plan on screen and the chat had already stood down,
 * so the session showed no plan anywhere. The chat is the fallback surface: it
 * takes the plan back whenever the panel is not drawing it.
 *
 * Pure, and the single source both surfaces read (through `usePlanInChat`),
 * so they cannot disagree about who owns the plan.
 */
export interface PlanSurfaceState {
  /** Under 768px there is no panel column at all — only a drawer, shut by
   *  default. See `session-action-panel-column.tsx`. */
  isMobile: boolean;
  /** The action-panel column is expanded. Collapsed it is zero-width and
   *  `inert`, which is invisible, not "showing a small version". */
  panelOpen: boolean;
  /** A detail panel (terminal / browser / files / preview) is on screen, which
   *  hides the card column entirely. */
  detailOpen: boolean;
  /** Only the Easy panel has a Plan card. Advanced is a tool-call stepper. */
  panelMode: 'easy' | 'advanced';
}

export function planBelongsToChat(state: PlanSurfaceState): boolean {
  if (state.isMobile) return true;
  if (state.panelMode !== 'easy') return true;
  if (!state.panelOpen) return true;
  if (state.detailOpen) return true;
  return false;
}

/**
 * The anchor the CHAT should use — which is "none" unless the chat is the
 * plan's surface, per `planBelongsToChat`.
 *
 * The gate wraps the scan rather than sitting beside it, for two reasons.
 * `planAnchorMessageId` walks every part of every message — where the panel
 * owns the plan that is work with no consumer, and skipping it is free. And
 * returning `null` (which matches no message id) means every `ownsPlan`
 * downstream, including the user bubble's own column cap, falls out of ONE
 * decision instead of two that can disagree.
 */
export function chatPlanAnchorId(
  allMessages: ReadonlyArray<MessageWithParts> | null | undefined,
  chatOwnsPlan: boolean,
): string | null {
  if (!chatOwnsPlan || !allMessages) return null;
  return planAnchorMessageId(allMessages);
}
