'use client';

/**
 * `ConnectAppsStrip` — 3-4 broadly useful connectors, ready to connect
 * without leaving the panel, plus a way to the full catalogue.
 *
 * A brand-new project has an empty Context card and nothing to look at. The
 * strip is what fills that gap: a handful of apps most sessions eventually
 * reach for, one click from connected, so the first thing a project owner
 * sees is a start, not a blank promise.
 *
 * **Row idiom matches `ContextCard`'s** (`hover:bg-accent rounded-sm px-1
 * py-1.5 gap-2.5`, `size-7` leading box) — this strip is meant to live beside
 * or inside that card, so the two must read as one system. Unlike a
 * `ContextCard` row, the whole row is not a button: a nested "Connect"
 * `<button>` inside a row `<button>` is invalid HTML (`PanelCard`'s header
 * hit the same constraint — see its own comment), so the row is a plain
 * `<div>` and only "Connect" carries a click.
 *
 * **The gate opens for ONE connector at a time.** `openConnectorGate` is the
 * same store `ConnectorRequiredNotice` uses for a failed-send refusal, but
 * that caller hands it every connector a blocked turn needs; this one hands
 * it a single-item list — "connect this app, in place, no navigation" — so
 * the modal it opens shows exactly the row that was clicked, nothing else.
 * `retry` is a no-op: there is no refused send waiting behind this click.
 *
 * **Read via `getState()`, not the `useConnectorGateStore(selector)` hook.**
 * The action is a stable reference created once by `create()`, so nothing
 * here needs to re-render when the gate's OWN state changes — this
 * component doesn't care whether the gate is open. That keeps the component
 * hook-free, which is what lets its tests call it as a plain function and
 * inspect the returned element tree directly, the same harness
 * `context-card.test.tsx` uses (see that file's `cardBody`).
 *
 * **The icon is `FaviconAvatar`,** the same favicon-avatar primitive
 * `ContextCard`'s own web-source rows already render, not the connectors
 * page's `ConnectorAppIcon`/`ConnectorIcon`. Both of those key off an
 * `AdminConnector` (a real project connector row) or a fetched catalogue
 * entry's `icon` URL — data this strip deliberately doesn't fetch, since its
 * whole point is to render before a project has connected anything. A
 * domain plus `FaviconAvatar` gets the same visual language with zero
 * network calls beyond the icon image itself.
 */

import { Button } from '@/components/ui/button';
import { FaviconAvatar } from '@/components/ui/favicon-avatar';
import { useConnectorGateStore } from '@/stores/connector-gate-store';
import Link from 'next/link';

interface DefaultConnector {
  /** `connector_alias` / catalogue slug — verified against real usage below. */
  slug: string;
  name: string;
  /** One line: what connecting this actually gets you. */
  value: string;
  /** Domain `FaviconAvatar` resolves a real favicon from. */
  domain: string;
}

/**
 * A curated default, not the full ~5,758-app catalogue (that lives at
 * `/projects/{id}/connectors`) — four apps a first-time project is likely to
 * want, picked for breadth (mail, chat, docs, storage) rather than any
 * ranking the catalogue itself exposes.
 *
 * Every slug is verified against a real usage site in this repo, not
 * invented:
 * - `gmail` — `connector_alias: 'gmail'` in
 *   `packages/sdk/src/core/rest/projects-client/connectors.test.ts:49`, and
 *   the marketing copy's `connector.call("gmail", "send_email", …)` example
 *   (`features/marketing/connectors/content.ts`).
 * - `slack` — `setConnectorCredentialMode('P1', 'slack', …)` in the same SDK
 *   test file (line 325), and channel copy referring to Slack by name.
 * - `notion` — named alongside Gmail/Linear/GitHub in the same marketing
 *   copy's connector-catalogue screenshot caption.
 * - `google_drive` — the literal slug asserted in
 *   `features/workspace/customize/sections/connector-connection-form.test.ts:80`
 *   (`{ slug: 'google_drive', name: 'Google Drive' }`).
 *
 * `CATEGORY_PICKS` in `catalog/connector-picks.ts` independently pins all
 * four under `communication`/`productivity`, confirming they are apps the
 * catalogue itself treats as recognisable defaults.
 */
export const DEFAULT_CONNECTORS: readonly DefaultConnector[] = [
  {
    slug: 'gmail',
    name: 'Gmail',
    value: 'Read and send email from your inbox.',
    domain: 'gmail.com',
  },
  {
    slug: 'slack',
    name: 'Slack',
    value: 'Post updates and read channels.',
    domain: 'slack.com',
  },
  {
    slug: 'notion',
    name: 'Notion',
    value: 'Read and write pages and databases.',
    domain: 'notion.so',
  },
  {
    slug: 'google_drive',
    name: 'Google Drive',
    value: 'Read and organize your files.',
    domain: 'drive.google.com',
  },
];

/** Full-width row, matching `ContextCard`'s dense idiom minus the click
 *  semantics — see this file's header for why it's a `div`, not a `button`. */
const ROW_CLASS =
  'hover:bg-accent -mx-0.5 flex min-h-10 w-full items-center gap-2.5 rounded-sm px-1 py-1.5';

export function ConnectAppsStrip({ projectId }: { projectId: string | undefined }) {
  if (!projectId) return null;

  return (
    <div className="flex flex-col gap-0">
      <ul className="flex flex-col gap-0">
        {DEFAULT_CONNECTORS.map((connector) => (
          <li key={connector.slug} className="flex items-center">
            <div className={ROW_CLASS}>
              <span className="flex size-7 shrink-0 items-center justify-center">
                <FaviconAvatar value={connector.domain} size="sm" alt="" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-foreground truncate text-sm">{connector.name}</span>
                <span className="text-muted-foreground truncate text-xs">{connector.value}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() =>
                  useConnectorGateStore.getState().openConnectorGate({
                    projectId,
                    connectorConnections: [
                      {
                        id: connector.slug,
                        slug: connector.slug,
                        name: connector.name,
                        authorization_strategy: 'project',
                      },
                    ],
                    retry: () => {},
                  })
                }
              >
                Connect
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button asChild variant="ghost" size="sm" className="justify-start">
        <Link href={`/projects/${projectId}/connectors`}>View all</Link>
      </Button>
    </div>
  );
}
