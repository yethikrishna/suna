import { CANONICAL_ORIGIN } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* Same shape as the sibling `agent-computer/layout.tsx`, declared inline rather
   than through `marketingMetadata('/self-hosted')`: that helper throws unless
   the route has a record in `lib/seo/public-content.ts`. FOLLOW-UP: move to the
   helper in the same change that registers `/self-hosted` there. */
const TITLE = 'Self-host Kortix';
const DESCRIPTION =
  'Run the same Kortix on your own box. One Docker Compose stack, the same images the managed cloud runs, your database and your files on disk you control. kortix self-host start, then kortix hosts use selfhost.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${CANONICAL_ORIGIN}/self-hosted` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${CANONICAL_ORIGIN}/self-hosted`,
    siteName: 'Kortix',
    type: 'website',
  },
};

export default function SelfHostedLayout({ children }: { children: ReactNode }) {
  return children;
}
