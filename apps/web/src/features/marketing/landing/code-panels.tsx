'use client';

import { cn } from '@/lib/utils';
import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';

/* ── tiny highlighter ──────────────────────────────────────────────────────
   A real grammar is overkill for two fixed snippets, and shipping a syntax
   library to the marketing page is not worth the bytes. These tokenizers cover
   exactly what the two examples contain. */

type Tok = { t: string; c?: string };

const TS_KEYWORDS = /^(import|from|const|await|new|return|type|export|async|function)$/;

function tokenizeTs(line: string): Tok[] {
  if (/^\s*\/\//.test(line)) return [{ t: line, c: 'comment' }];
  const out: Tok[] = [];
  // strings first so their contents are never re-tokenized
  const re = /('[^']*'|"[^"]*"|`[^`]*`)|(\b[A-Za-z_$][\w$]*\b)|(\s+)|([^\sA-Za-z_$]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [raw, str, word, space, punct] = m;
    if (str) out.push({ t: raw, c: 'string' });
    else if (space) out.push({ t: raw });
    else if (punct) out.push({ t: raw, c: 'punct' });
    else if (word) {
      const after = line.slice(m.index + raw.length);
      if (TS_KEYWORDS.test(word)) out.push({ t: raw, c: 'keyword' });
      else if (/^\s*\(/.test(after)) out.push({ t: raw, c: 'fn' });
      else if (/^[A-Z]/.test(word)) out.push({ t: raw, c: 'type' });
      else out.push({ t: raw });
    }
  }
  return out;
}

function tokenizeShell(line: string): Tok[] {
  if (/^\s*#/.test(line)) return [{ t: line, c: 'comment' }];
  if (/^\s*[✓→]/.test(line)) return [{ t: line, c: 'ok' }];
  if (!line.startsWith('$')) return [{ t: line, c: 'comment' }];

  const out: Tok[] = [{ t: '$', c: 'prompt' }];
  const rest = line.slice(1);
  const re = /("[^"]*"|'[^']*')|(\s+)|(--?[\w-]+)|([^\s]+)/g;
  let m: RegExpExecArray | null;
  let first = true;
  while ((m = re.exec(rest))) {
    const [raw, str, space, flag, word] = m;
    if (str) out.push({ t: raw, c: 'string' });
    else if (space) out.push({ t: raw });
    else if (flag) out.push({ t: raw, c: 'flag' });
    else if (word) {
      out.push({ t: raw, c: first ? 'cmd' : undefined });
      first = false;
    }
  }
  return out;
}

const TOKEN_CLASS: Record<string, string> = {
  comment: 'text-background/35',
  string: 'text-background/90',
  keyword: 'text-background/55',
  fn: 'text-background',
  type: 'text-background/85',
  punct: 'text-background/40',
  prompt: 'text-background/30',
  cmd: 'text-background',
  flag: 'text-background/55',
  ok: 'text-background/55',
};

function CodeSurface({
  title,
  lines,
  lang,
  copyText,
  footer,
}: {
  title: string;
  lines: string[];
  lang: 'ts' | 'sh';
  copyText: string;
  footer?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [copyText]);

  const tokenize = lang === 'ts' ? tokenizeTs : tokenizeShell;

  return (
    <div className="bg-foreground flex h-full flex-col">
      <div className="border-background/10 flex items-center gap-3 border-b px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          <span className="bg-background/20 size-2.5 rounded-full" />
          <span className="bg-background/20 size-2.5 rounded-full" />
          <span className="bg-background/20 size-2.5 rounded-full" />
        </span>
        <span className="text-background/50 font-mono text-xs">{title}</span>

        <button
          type="button"
          onClick={copy}
          className="text-background/45 hover:text-background hover:bg-background/10 duration-fast ml-auto flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[11px] transition-colors"
        >
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <pre className="font-mono text-[12.5px] leading-[1.7]">
          <code>
            {lines.map((line, i) => (
              <div key={`${i}-${line}`} className="whitespace-pre">
                {line === ''
                  ? ' '
                  : tokenize(line).map((tok, j) => (
                      <span key={j} className={tok.c ? TOKEN_CLASS[tok.c] : 'text-background/75'}>
                        {tok.t}
                      </span>
                    ))}
              </div>
            ))}
          </code>
        </pre>
      </div>

      {footer ? (
        <div className="border-background/10 border-t px-4 py-3">{footer}</div>
      ) : null}
    </div>
  );
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const CLI_LINES = [
  '$ curl -fsSL https://kortix.com/install | bash',
  '  ✓ Kortix CLI installed',
  '',
  '$ kortix init',
  '  ✓ wrote kortix.yaml, agents, skills',
  '',
  '$ kortix ship',
  '  ✓ pushed · live in the cloud',
  '',
  '$ kortix sessions new --prompt "Close the month"',
  '  → session/close-month · agent computer ready',
  '',
  '$ kortix cr ls',
  '  → 1 change request awaiting your review',
];

const CLI_COPY = `curl -fsSL https://kortix.com/install | bash
kortix init
kortix ship`;

export function CliSurface({ cta }: { cta?: React.ReactNode }) {
  return <CodeSurface title="kortix — terminal" lines={CLI_LINES} lang="sh" copyText={CLI_COPY} footer={cta} />;
}

/* ── SDK ─────────────────────────────────────────────────────────────────── */

const SDK_LINES = [
  "import { createKortix } from '@kortix/sdk';",
  '',
  'const kortix = createKortix({',
  "  backendUrl: 'https://api.kortix.com/v1',",
  '  getToken,',
  '});',
  '',
  '// one hook owns the whole session lifecycle',
  'const session = kortix.session(projectId, sessionId);',
  '',
  "await session.send('Draft the renewal for Northwind');",
  '',
  '// what it produced, and what it cost',
  'const previews = await session.previews();',
  'const cost = await session.cost();',
];

const SDK_COPY = SDK_LINES.filter((l) => !l.startsWith('//')).join('\n');

export function SdkSurface({ cta }: { cta?: React.ReactNode }) {
  return <CodeSurface title="renewal.ts" lines={SDK_LINES} lang="ts" copyText={SDK_COPY} footer={cta} />;
}

export function SurfaceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={cn(
        'text-background/70 hover:text-background duration-fast inline-flex items-center gap-1.5',
        'font-mono text-[11px] transition-colors',
      )}
    >
      {children}
      <span aria-hidden>↗</span>
    </a>
  );
}
