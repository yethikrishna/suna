import { CANONICAL_ORIGIN } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* Same shape as the sibling `agent-computer/layout.tsx`, declared inline rather
   than through `marketingMetadata('/security')`: that helper throws unless the
   route has a record in `lib/seo/public-content.ts`. FOLLOW-UP: move to the
   helper in the same change that registers `/security` there. */
const TITLE = 'Kortix Security';
const DESCRIPTION =
  'How Kortix is built to survive a security review: microVM isolation per session, credentials the model never sees, permissions for people and agents, human approval gates, and a change request between an agent and main.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${CANONICAL_ORIGIN}/security` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${CANONICAL_ORIGIN}/security`,
    siteName: 'Kortix',
    type: 'website',
  },
};

export default function SecurityLayout({ children }: { children: ReactNode }) {
  return children;
}
