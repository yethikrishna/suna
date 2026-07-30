'use client';

import { PageHead, Panel, Row, StatusDot } from '@/components/home/interactive-demo/primitives';
import { Badge } from '@/components/ui/badge';
import { WebPanelWrapper } from '../web-panel-wrapper';

const SECRETS = [
  { name: 'STRIPE_API_KEY', scope: 'finance · 2 agents' },
  { name: 'GMAIL_OAUTH', scope: 'per person' },
  { name: 'AWS_DEPLOY_KEY', scope: 'platform group' },
];

const PRINCIPALS = [
  { who: 'Owner', can: 'everything', on: true },
  { who: 'Member', can: 'own sessions · shared skills', on: true },
  { who: 'Agent · go-to-market', can: 'slack, hubspot, gmail', on: true },
];

const DEPLOY = ['Kortix Cloud', 'Your VPC', 'On-prem', 'Air-gapped'];

/** Layer 06 — the mechanisms, not a wall of acronyms. */
export function StepSecurity() {
  return (
    <WebPanelWrapper activeTab="security">
      <PageHead
        title="Security & governance"
        sub="People and agents answer to the same permissions."
        action={
          <Badge variant="kortix" className="rounded">
            SSO · RBAC
          </Badge>
        }
      />

      <div className="space-y-3">
        <Panel title="Secrets" count="granted, not pasted">
          {SECRETS.map((s) => (
            <Row
              key={s.name}
              leading={
                <span className="border-border text-muted-foreground flex size-8 items-center justify-center rounded-md border font-mono text-[10px]">
                  •••
                </span>
              }
              title={<span className="font-mono text-[12.5px]">{s.name}</span>}
              subtitle={s.scope}
              trailing={
                <span className="text-muted-foreground font-mono text-[11px]">encrypted</span>
              }
            />
          ))}
        </Panel>

        <Panel title="Who can do what">
          {PRINCIPALS.map((p) => (
            <Row
              key={p.who}
              leading={
                <span className="border-border bg-background text-muted-foreground flex size-8 items-center justify-center rounded-md border text-xs font-semibold">
                  {p.who.startsWith('Agent') ? 'A' : p.who[0]}
                </span>
              }
              title={p.who}
              subtitle={p.can}
              trailing={<StatusDot on={p.on} />}
            />
          ))}
        </Panel>

        <Panel title="Runs where you put it">
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {DEPLOY.map((d) => (
              <span
                key={d}
                className="border-border text-muted-foreground rounded-md border px-2.5 py-1 font-mono text-[11px]"
              >
                {d}
              </span>
            ))}
          </div>
        </Panel>
      </div>
    </WebPanelWrapper>
  );
}
