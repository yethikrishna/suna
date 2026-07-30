'use client';

import { PageHead, Panel, Row } from '@/components/home/interactive-demo/primitives';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/features/icon/icon';
import { WebPanelWrapper } from '../web-panel-wrapper';

const CONFIG: { line: string; muted?: boolean }[] = [
  { line: '# .kortix/opencode/agents/kortix.md', muted: true },
  { line: 'model: auto' },
  { line: 'tools: [read, edit, bash, web, connectors]' },
  { line: 'permissions:' },
  { line: '  bash: ask' },
  { line: '  edit: allow' },
  { line: 'skills: [presentations, xlsx, website-building]' },
];

const CAPABILITIES = [
  { title: 'Planning', sub: 'breaks a request into steps it finishes' },
  { title: 'Tool use', sub: 'reads, edits, runs, fetches, calls connectors' },
  { title: 'Permissions', sub: 'what runs freely, what stops to ask' },
];

/** Layer 03 — credit OpenCode plainly, and show the harness is an editable file. */
export function StepHarness() {
  return (
    <WebPanelWrapper activeTab="agents">
      <PageHead
        title="Agent harness"
        sub="Powered by OpenCode."
        action={
          <Badge variant="kortix" className="rounded">
            Open source
          </Badge>
        }
      />

      <div className="space-y-3">
        <Panel
          title="kortix"
          count="primary"
          action={
            <span className="border-border bg-background flex size-7 items-center justify-center rounded-md border">
              <Icon.OpenCode className="size-4" />
            </span>
          }
        >
          <div className="bg-background px-4 py-3">
            <pre className="overflow-x-auto font-mono text-[11.5px] leading-[1.75]">
              <code>
                {CONFIG.map((c) => (
                  <div
                    key={c.line}
                    className={c.muted ? 'text-muted-foreground/55' : 'text-foreground/85'}
                  >
                    {c.line}
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </Panel>

        <Panel title="What the harness does">
          {CAPABILITIES.map((c) => (
            <Row
              key={c.title}
              leading={
                <span className="border-border text-muted-foreground flex size-8 items-center justify-center rounded-md border font-mono text-[10px]">
                  ⌘
                </span>
              }
              title={c.title}
              subtitle={c.sub}
            />
          ))}
        </Panel>
      </div>
    </WebPanelWrapper>
  );
}
