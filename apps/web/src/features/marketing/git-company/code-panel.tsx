import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/* One fixed YAML snippet does not justify shipping a syntax library to the home
   page. This colours exactly what the snippet contains: `#` comments, `key:`,
   list items, and values. Same idiom as `agent-computer/code-panel.tsx`. */

const COMMENT = 'text-muted-foreground/50';
const KEY = 'text-foreground/85';
const VALUE = 'text-muted-foreground';

function YamlLine({ line }: { line: string }): ReactNode {
  if (/^\s*#/.test(line)) return <span className={COMMENT}>{line}</span>;

  const match = /^(\s*(?:- )?)([\w.$-]+)(:)(.*)$/.exec(line);
  if (!match) return <span className={VALUE}>{line}</span>;

  const [, indent, key, colon, rest] = match;
  return (
    <>
      <span className={COMMENT}>{indent}</span>
      <span className={KEY}>{key}</span>
      <span className={COMMENT}>{colon}</span>
      <span className={VALUE}>{rest}</span>
    </>
  );
}

/**
 * The annotated manifest, drawn as the file it is. The comments in the snippet
 * are the annotation — a callout layer would only repeat them further away from
 * the line it describes.
 */
export function CodePanel({
  title,
  caption,
  lines,
  className,
}: {
  title: string;
  caption?: string;
  lines: readonly string[];
  className?: string;
}): ReactNode {
  return (
    <div className={cn('border-border bg-card flex h-full flex-col rounded-sm border', className)}>
      <div className="border-border flex items-center gap-3 border-b px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
        </span>
        <span className="text-muted-foreground truncate font-mono text-xs">{title}</span>
      </div>

      <div className="bg-background min-h-0 flex-1 overflow-x-auto px-5 py-4">
        <pre className="font-mono text-[12px] leading-[1.65]">
          <code>
            {lines.map((line, i) => (
              // Fixed, ordered snippet: the index is the identity of the line.
              <span key={`yaml-${i}`} className="block whitespace-pre">
                {line === '' ? ' ' : <YamlLine line={line} />}
              </span>
            ))}
          </code>
        </pre>
      </div>

      {caption ? (
        <p className="border-border text-muted-foreground/70 border-t px-5 py-3 text-xs leading-relaxed">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
