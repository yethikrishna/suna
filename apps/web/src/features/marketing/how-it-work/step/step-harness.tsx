'use client';

import { Card } from '@/components/ui/card';
import { Icon } from '@/features/icon/icon';

const CONFIG = [
  { line: '# .kortix/opencode/agents/kortix.md', muted: true },
  { line: '---', muted: true },
  { line: 'model: auto', muted: false },
  { line: 'tools: [read, edit, bash, web, connectors]', muted: false },
  { line: 'permissions:', muted: false },
  { line: '  bash: ask', muted: false },
  { line: '  edit: allow', muted: false },
  { line: 'skills: [presentations, xlsx, website-building]', muted: false },
  { line: '---', muted: true },
  { line: 'You are a Kortix general knowledge worker…', muted: true },
];

/** Layer 03 — credit OpenCode plainly, and show that the harness is a file. */
export function StepHarness() {
  return (
    <Card className="flex h-full w-full flex-col gap-4 p-6">
      <div className="border-border flex items-center gap-3 border-b pb-4">
        <span className="border-border bg-background flex size-11 shrink-0 items-center justify-center rounded-sm border">
          <Icon.OpenCode className="size-6" />
        </span>
        <div>
          <p className="text-foreground text-sm font-medium">Powered by OpenCode</p>
          <p className="text-muted-foreground text-xs">Open source · swap or fork it</p>
        </div>
      </div>

      <div className="bg-foreground overflow-hidden rounded-sm p-4">
        <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
          <code>
            {CONFIG.map((c) => (
              <div key={c.line} className={c.muted ? 'text-background/40' : 'text-background/85'}>
                {c.line}
              </div>
            ))}
          </code>
        </pre>
      </div>

      <p className="text-muted-foreground mt-auto text-[13px] leading-relaxed">
        The harness is a file in your repo. Change how an agent plans, what it may run, and which
        skills it carries — then review it like any other change.
      </p>
    </Card>
  );
}
