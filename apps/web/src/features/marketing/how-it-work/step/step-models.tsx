'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Icon } from '@/features/icon/icon';

type IconKey = keyof typeof Icon;

const PROVIDERS: { key: IconKey; name: string; note: string }[] = [
  { key: 'Claude', name: 'Claude', note: 'Opus · Sonnet' },
  { key: 'OpenAI', name: 'OpenAI', note: 'GPT · Codex' },
  { key: 'Gemini', name: 'Gemini', note: 'Pro · Flash' },
];

const SOURCES = [
  'Your own API key',
  'The subscription you already pay for',
  'Your own models, on your hardware',
];

/** Layer 02 — the point is that the model slot is yours to fill. */
export function StepModels() {
  return (
    <Card className="flex h-full w-full flex-col gap-5 p-6">
      <div>
        <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
          Model
        </p>
        <div className="mt-3 space-y-2">
          {PROVIDERS.map((p) => {
            const Glyph = Icon[p.key] as ((p: { className?: string }) => ReactNode) | undefined;
            return (
              <div
                key={p.name}
                className="border-border bg-background flex items-center gap-3 rounded-sm border px-3 py-2.5"
              >
                {Glyph ? <Glyph className="size-5 shrink-0" /> : null}
                <span className="text-foreground text-sm font-medium">{p.name}</span>
                <span className="text-muted-foreground/70 ml-auto font-mono text-[11px]">
                  {p.note}
                </span>
              </div>
            );
          })}
          <div className="border-border text-muted-foreground rounded-sm border border-dashed px-3 py-2.5 text-center font-mono text-[11px]">
            + any other provider
          </div>
        </div>
      </div>

      <div className="border-border mt-auto border-t pt-4">
        <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
          Billed through
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {SOURCES.map((s) => (
            <li key={s} className="text-muted-foreground flex gap-2 text-[13px] leading-relaxed">
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
