'use client';

import { Card } from '@/components/ui/card';

const VAULT = ['stripe/live', 'gmail/oauth', 'aws/deploy-key', 'slack/bot-token'];

const ROLES = [
  { who: 'Owner', can: 'everything' },
  { who: 'Member', can: 'own sessions, shared skills' },
  { who: 'Agent · go-to-market', can: 'slack, hubspot, gmail' },
];

const DEPLOY = ['Kortix Cloud', 'Your VPC', 'On-prem', 'Air-gapped'];

/** Layer 06 — three concrete mechanisms rather than a list of acronyms. */
export function StepSecurity() {
  return (
    <Card className="flex h-full w-full flex-col gap-4 p-6">
      <div>
        <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
          Secrets · injected at runtime, never seen by the model
        </p>
        <div className="bg-foreground mt-2.5 rounded-sm p-3">
          {VAULT.map((v) => (
            <div key={v} className="flex items-center justify-between py-0.5">
              <span className="text-background/80 font-mono text-[11px]">vault://{v}</span>
              <span className="text-background/30 font-mono text-[11px]">••••••••</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
          Permissions · people and agents
        </p>
        <div className="mt-2.5 space-y-1.5">
          {ROLES.map((r) => (
            <div
              key={r.who}
              className="border-border bg-background flex items-center justify-between gap-3 rounded-sm border px-3 py-2"
            >
              <span className="text-foreground text-[13px] font-medium">{r.who}</span>
              <span className="text-muted-foreground/80 font-mono text-[11px]">{r.can}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-border mt-auto border-t pt-4">
        <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
          Runs where you put it
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {DEPLOY.map((d) => (
            <span
              key={d}
              className="border-border text-muted-foreground rounded-sm border px-2.5 py-1 font-mono text-[11px]"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
