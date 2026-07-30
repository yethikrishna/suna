import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { gitCompany } from './content';

type Entry = (typeof gitCompany.tree.entries)[number];

/**
 * `blank` — an ancestor with no siblings left below it: no rail.
 * `pass`  — an ancestor whose rail continues past this row.
 * `tee`   — this row's own connector, with more siblings below it.
 * `elbow` — this row's own connector, and the last of its siblings.
 */
type RailKind = 'blank' | 'pass' | 'tee' | 'elbow';

/** One 16px indent column, drawn rather than typed: mono box-drawing glyphs
 *  break into disconnected ticks at this line-height. */
function Rail({ kind }: { kind: RailKind }): ReactNode {
  if (kind === 'blank') return <span aria-hidden className="w-4 shrink-0" />;
  return (
    <span aria-hidden className="relative w-4 shrink-0">
      <span
        className={cn(
          'bg-border absolute top-0 left-0 w-px',
          kind === 'elbow' ? 'h-1/2' : 'bottom-0',
        )}
      />
      {kind === 'tee' || kind === 'elbow' ? (
        <span className="bg-border absolute top-1/2 left-0 h-px w-2" />
      ) : null}
    </span>
  );
}

/** Resolves the indent columns for a flat, depth-tagged list, so `content.ts`
 *  stays a plain list and never hand-carries alignment characters. */
function railsFor(entries: readonly Entry[], i: number): RailKind[] {
  const entry = entries[i];
  const hasLaterSibling = (from: number, depth: number): boolean => {
    for (let j = from + 1; j < entries.length; j++) {
      const d = entries[j].depth;
      if (d < depth) return false;
      if (d === depth) return true;
    }
    return false;
  };

  const rails: RailKind[] = [];
  for (let a = 1; a < entry.depth; a++) {
    let idx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (entries[j].depth === a) {
        idx = j;
        break;
      }
    }
    rails.push(idx >= 0 && hasLaterSibling(idx, a) ? 'pass' : 'blank');
  }
  if (entry.depth > 0) rails.push(hasLaterSibling(i, entry.depth) ? 'tee' : 'elbow');
  return rails;
}

/**
 * The repo, drawn as the thing it is: a listing you could have produced with
 * `tree`. The claim of the section is that nothing here is hidden, so every
 * path is a real one from the shipped starter template.
 */
export function RepoTree(): ReactNode {
  const { title, entries } = gitCompany.tree;

  return (
    <div className="border-border bg-card flex flex-col rounded-sm border">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <span aria-hidden className="bg-muted-foreground/40 size-1.5 rounded-full" />
        <span className="text-muted-foreground truncate font-mono text-xs">{title}</span>
      </div>

      {/* One grid for every row, so the note column lines up across depths. */}
      {/* The note column is right-aligned, so it is capped in the stacked
          layout — otherwise the notes drift a full column away from the path
          they annotate. Below `sm` the notes drop entirely rather than
          overflow. */}
      <ul className="grid max-w-xl flex-1 grid-cols-1 content-start gap-x-4 px-4 py-3 font-mono text-[12px] sm:grid-cols-[auto_1fr] lg:max-w-none">
        {entries.map((entry, i) => (
          <li key={entry.path} className="contents">
            <span className="flex h-7 items-stretch">
              {railsFor(entries, i).map((kind, r) => (
                // Rails are positional: the column index is the identity.
                <Rail key={`${entry.path}-rail-${r}`} kind={kind} />
              ))}
              <span
                className={cn(
                  'self-center whitespace-pre',
                  entry.path.endsWith('/') ? 'text-foreground' : 'text-foreground/75',
                )}
              >
                {entry.path}
              </span>
            </span>
            <span className="text-muted-foreground/60 hidden h-7 items-center justify-end text-right text-[10.5px] whitespace-pre sm:flex">
              {entry.note}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
