'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/features/icon/icon';

type IconKey = keyof typeof Icon;

/** Models Kortix can run, and a sample of the tools it connects to. These are
 *  capabilities we actually ship — not customer logos, which we neither name
 *  nor have permission to show. */
const MODELS: IconKey[] = ['Claude', 'OpenAI', 'Gemini', 'OpenCode'];
const TOOLS: IconKey[] = ['Slack', 'MicrosoftTeams', 'Notion', 'Linear', 'Github', 'Gmail'];

function Row({ label, keys }: { label: string; keys: IconKey[] }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <span className="text-muted-foreground/60 shrink-0 font-mono text-[10px] tracking-widest uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
        {keys.map((key) => {
          const Glyph = Icon[key] as ((p: { className?: string }) => ReactNode) | undefined;
          if (!Glyph) return null;
          return (
            <span key={key} className="opacity-100">
              <Glyph className="size-6" />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The transition between the hero and the first real section. */
export function LogoStrip() {
  return (
    <section aria-label="Models and tools Kortix works with" className="px-6 py-14 sm:py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 lg:flex-row lg:justify-between">
        <Row label="Runs any model" keys={MODELS} />
        <Row label="Connects 3,000+ apps" keys={TOOLS} />
      </div>
    </section>
  );
}
