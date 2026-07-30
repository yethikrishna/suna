import { CANONICAL_ORIGIN } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Metadata is declared here rather than via `marketingMetadata('/integrations')`
 * because that helper throws unless the path is also listed in
 * `lib/seo/public-content.ts` (STATIC_PUBLIC_ROUTES + MARKETING_RECORDS).
 * FOLLOW-UP: add the record there, then swap this for the helper so the sitemap
 * and the markdown mirror pick the page up too.
 */
const TITLE = 'Kortix connectors';
const DESCRIPTION =
  'Connect 3,000+ apps, MCP servers, OpenAPI, GraphQL and raw HTTP once for the whole company. Agents reach them through one scoped token — credentials stay server-side, every action is allowed, gated, or blocked, and every call is logged.';
const URL = `${CANONICAL_ORIGIN}/integrations`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: 'Kortix',
    type: 'website',
  },
};

export default function IntegrationsLayout({ children }: { children: ReactNode }) {
  return children;
}
