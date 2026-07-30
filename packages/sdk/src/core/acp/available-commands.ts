import type { Command } from '@opencode-ai/sdk/v2/client';

/**
 * Slash commands for a session, resolved from whichever runtime actually serves
 * them.
 *
 * A managed ACP sandbox serves no OpenCode REST API (see
 * `SessionRuntimePolicy.servesOpenCodeRest`), so `GET /command` can never answer
 * there. ACP carries the same information over the wire instead: the agent sends
 * a `session/update` notification with `sessionUpdate: 'available_commands_update'`
 * and an `availableCommands` array, which `AcpProjection.availableCommands`
 * already accumulates. This module is the seam between that raw notification
 * payload and the published `Command` shape every renderer reads.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Project raw ACP `availableCommands` entries onto the published `Command`
 * contract.
 *
 * `template` is deliberately always the empty string: ACP advertises a command's
 * name and description, never the expanded prompt body OpenCode REST returns. It
 * must still be a string — `apps/web`'s `detectCommandFromText` calls
 * `.trim()` on it, and a non-string template is a known production crash
 * (`TypeError: e.template.trim is not a function`). An empty template simply
 * fails that detector's `prefix.length < 20` guard, so ACP commands stay
 * selectable from the palette while template-replay detection sits out.
 */
export function acpAvailableCommandsToCommands(
  entries: ReadonlyArray<Record<string, unknown>> | undefined,
): Command[] {
  if (!entries) return [];
  const commands: Command[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isObject(entry)) continue;
    const name = asString(entry.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const description = asString(entry.description);
    const hint = isObject(entry.input) ? asString(entry.input.hint) : null;
    commands.push({
      name,
      ...(description ? { description } : {}),
      template: '',
      hints: hint ? [hint] : [],
    });
  }
  return commands;
}

/**
 * Pick the command list for one session.
 *
 * A runtime that serves OpenCode REST keeps the REST list verbatim — templates
 * included — so nothing about a REST session changes. A runtime that does not
 * serve it reads what ACP advertised, and resolves to an EMPTY list until the
 * first `available_commands_update` arrives. Never fall back to the REST list
 * there: on a managed ACP session it is the stale list of whatever sandbox the
 * ambient OpenCode client last pointed at.
 */
export function resolveSessionCommands(input: {
  servesOpenCodeRest: boolean;
  rest: readonly Command[] | undefined;
  advertised: ReadonlyArray<Record<string, unknown>> | undefined;
}): Command[] {
  if (input.servesOpenCodeRest) return [...(input.rest ?? [])];
  return acpAvailableCommandsToCommands(input.advertised);
}
