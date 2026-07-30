import { CANONICAL_ORIGIN } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* Declared inline rather than through `marketingMetadata('/channels')`: that
   helper throws unless the route has a record in `lib/seo/public-content.ts`.
   FOLLOW-UP: register `/channels` there, then move this to the helper. */
const TITLE = 'Kortix Channels';
const DESCRIPTION =
  'Connect Slack or Microsoft Teams to a Kortix project and a message in a thread starts a session. The agent works on its own cloud computer and replies in the same thread. Email and voice are in preview.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${CANONICAL_ORIGIN}/channels` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${CANONICAL_ORIGIN}/channels`,
    siteName: 'Kortix',
    type: 'website',
  },
};

export default function ChannelsLayout({ children }: { children: ReactNode }) {
  return children;
}
