import { CANONICAL_ORIGIN } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* Same shape as the sibling `enterprise/layout.tsx`, declared inline rather
   than through `marketingMetadata('/agent-computer')`: that helper throws
   unless the route has a record in `lib/seo/public-content.ts`. Move to the
   helper in the same change that registers the route there. */
const TITLE = 'Kortix Agent Computer';
const DESCRIPTION =
  'Every Kortix session gets its own computer: a microVM-isolated Linux machine that clones your repo, cuts a branch named after the session, and runs OpenCode. Work lands through a change request a person approves.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${CANONICAL_ORIGIN}/agent-computer` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${CANONICAL_ORIGIN}/agent-computer`,
    siteName: 'Kortix',
    type: 'website',
  },
};

export default function AgentComputerLayout({ children }: { children: ReactNode }) {
  return children;
}
