import { CANONICAL_ORIGIN } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* Declared inline rather than through `marketingMetadata('/automations')`: that
   helper throws unless the route has a record in `lib/seo/public-content.ts`.
   FOLLOW-UP: register `/automations` there, then move this to the helper. */
const TITLE = 'Kortix Automations';
const DESCRIPTION =
  'Cron schedules and signed webhooks start Kortix sessions with nobody present. Each trigger names the agent it runs as, carries a prompt template, and lands its work through a change request a person approves.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${CANONICAL_ORIGIN}/automations` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${CANONICAL_ORIGIN}/automations`,
    siteName: 'Kortix',
    type: 'website',
  },
};

export default function AutomationsLayout({ children }: { children: ReactNode }) {
  return children;
}
