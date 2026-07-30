import { AuditSection } from '@/features/marketing/integrations/audit-section';
import { BrokerSection } from '@/features/marketing/integrations/broker-section';
import { CloseSection } from '@/features/marketing/integrations/close-section';
import { ConnectSection } from '@/features/marketing/integrations/connect-section';
import { IntegrationsHero } from '@/features/marketing/integrations/hero';
import { PolicySection } from '@/features/marketing/integrations/policy-section';
import { ScopeSection } from '@/features/marketing/integrations/scope-section';
import type { ReactNode } from 'react';

/**
 * /integrations — the connectors page.
 *
 * The route is /integrations because that is the word people search for. The
 * copy on it never uses "integration" as a noun; the product noun is
 * "connector" (the `comms` skill, §7).
 *
 * The arc, in order: connect once → the credential never reaches the agent →
 * reach is scoped → every action is allowed, gated, or blocked → everything is
 * written down.
 */
export default function IntegrationsPage(): ReactNode {
  return (
    <div className="bg-background relative">
      <IntegrationsHero />
      <ConnectSection />
      <BrokerSection />
      <ScopeSection />
      <PolicySection />
      <AuditSection />
      <CloseSection />
      <div className="h-24 sm:h-28" />
    </div>
  );
}
