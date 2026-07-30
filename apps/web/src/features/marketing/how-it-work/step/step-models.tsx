'use client';

import { PageHead, Panel, Row, StatusDot } from '@/components/home/interactive-demo/primitives';
import { Icon } from '@/features/icon/icon';
import type { ReactNode } from 'react';
import { WebPanelWrapper } from '../web-panel-wrapper';

type IconKey = keyof typeof Icon;

const PROVIDERS: { key: IconKey; name: string; models: string; on: boolean }[] = [
  { key: 'Claude', name: 'Anthropic', models: 'Opus · Sonnet · Haiku', on: true },
  { key: 'OpenAI', name: 'OpenAI', models: 'GPT · Codex', on: true },
  { key: 'Gemini', name: 'Google', models: 'Gemini Pro · Flash', on: true },
];

const KEYS = [
  { label: 'Your own API key', detail: 'any provider' },
  { label: 'The subscription you already pay for', detail: 'ChatGPT · Claude · Cursor' },
  { label: 'Your own models', detail: 'on your hardware' },
];

/** Layer 02 — the model slot is yours to fill, and billing follows your keys. */
export function StepModels() {
  return (
    <WebPanelWrapper activeTab="models">
      <PageHead title="Models" sub="Any provider. Switch as they improve." />

      <div className="space-y-3">
        <Panel title="Connected" count="3">
          {PROVIDERS.map((p) => {
            const Glyph = Icon[p.key] as ((x: { className?: string }) => ReactNode) | undefined;
            return (
              <Row
                key={p.name}
                leading={
                  <span className="border-border bg-background flex size-8 items-center justify-center rounded-md border">
                    {Glyph ? <Glyph className="size-4" /> : null}
                  </span>
                }
                title={p.name}
                subtitle={p.models}
                trailing={<StatusDot on={p.on} />}
              />
            );
          })}
        </Panel>

        <Panel title="Billed through">
          {KEYS.map((k) => (
            <Row
              key={k.label}
              leading={
                <span className="border-border text-muted-foreground flex size-8 items-center justify-center rounded-md border font-mono text-[10px]">
                  key
                </span>
              }
              title={k.label}
              subtitle={k.detail}
            />
          ))}
        </Panel>
      </div>
    </WebPanelWrapper>
  );
}
