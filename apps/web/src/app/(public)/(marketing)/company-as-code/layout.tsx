import { CANONICAL_ORIGIN } from '@/lib/site-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* Same shape as the sibling `agent-computer/layout.tsx`, declared inline
   rather than through `marketingMetadata('/company-as-code')`: that helper
   throws unless the route has a record in `lib/seo/public-content.ts`.
   FOLLOW-UP: register `/company-as-code` there, then move this file to the
   helper in that same change. */
const TITLE = 'Company as Code';
const DESCRIPTION =
  'A Kortix project is a git repo, and that repo is the company. kortix.yaml and the OpenCode config define it; agents, skills and memory are files beside your code. Every change is a commit a person approves.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${CANONICAL_ORIGIN}/company-as-code` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${CANONICAL_ORIGIN}/company-as-code`,
    siteName: 'Kortix',
    type: 'website',
  },
};

export default function CompanyAsCodeLayout({ children }: { children: ReactNode }) {
  return children;
}
