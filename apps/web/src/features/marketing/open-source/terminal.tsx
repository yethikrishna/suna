import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/* Same idiom as `features/marketing/agent-computer/code-panel.tsx`, reduced to
   the three token types these lines contain — comment, command, output — and
   kept strictly monochrome, because this section introduces no colour. */

function ShellLine({ line }: { line: string }): ReactNode {
  if (line === '') return <>&nbsp;</>;
  if (line.startsWith('#')) return <span className="text-muted-foreground/45">{line}</span>;
  if (line.startsWith('→'))
    return <span className="text-muted-foreground/80">{line}</span>;
  if (!line.startsWith('$')) return <span className="text-muted-foreground">{line}</span>;
  return (
    <>
      <span className="text-muted-foreground/35 select-none">$</span>
      <span className="text-foreground">{line.slice(1)}</span>
    </>
  );
}

export function Terminal({
  title,
  lines,
  className,
}: {
  title: string;
  lines: readonly string[];
  className?: string;
}): ReactNode {
  return (
    <div className={cn('border-border bg-card flex flex-col rounded-sm border', className)}>
      <div className="border-border flex items-center gap-3 border-b px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
        </span>
        <span className="text-muted-foreground font-mono text-xs">{title}</span>
      </div>

      <div className="bg-background overflow-x-auto rounded-b-sm px-5 py-4">
        <pre className="font-mono text-[13px] leading-[1.9]">
          <code>
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed, static snippet
              <div key={i}>
                <ShellLine line={line} />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
