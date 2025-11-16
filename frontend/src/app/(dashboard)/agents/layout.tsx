import { agentPlaygroundFlagFrontend } from '@/flags';
import { isFlagEnabled } from '@/lib/feature-flags';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Agent Conversation | Yeti AI',
  description: 'Interactive agent conversation powered by Yeti AI',
  openGraph: {
    title: 'Agent Conversation | Yeti AI',
  description: 'Interactive agent conversation powered by Yeti AI',
    type: 'website',
  },
};

export default async function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
