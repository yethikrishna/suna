import { CANONICAL_ORIGIN } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* Declared inline rather than through `marketingMetadata('/agents-and-skills')`:
   that helper throws unless the route has a record in `lib/seo/public-content.ts`.
   FOLLOW-UP: register `/agents-and-skills` there, then move this to the helper. */
const TITLE = 'Kortix Agents & Skills';
const DESCRIPTION =
  'A Kortix agent is a markdown persona with a deny-by-default reach into connectors, secrets and skills. A skill is the markdown that encodes how your company does one job. Both are files in your repo, versioned and reviewed.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${CANONICAL_ORIGIN}/agents-and-skills` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${CANONICAL_ORIGIN}/agents-and-skills`,
    siteName: 'Kortix',
    type: 'website',
  },
};

export default function AgentsAndSkillsLayout({ children }: { children: ReactNode }) {
  return children;
}
