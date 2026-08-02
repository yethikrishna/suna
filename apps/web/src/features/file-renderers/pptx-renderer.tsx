'use client';

import { ReactPptxViewer, setWasmSource } from '@extend-ai/react-pptx';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { KortixLoader } from '@/components/ui/kortix-loader';
import { cn } from '@/lib/utils';

// react-pptx loads its wasm inside a `blob:`-URL Web Worker, where a
// root-relative path (`/_next/static/media/pptx_wasm_bg.*.wasm`) fails to parse
// on `fetch`. Point it at an absolute, origin-qualified copy served from
// `public/` (populated by `scripts/copy-viewer-wasm.mjs`) before the first
// document import initializes the engine.
if (typeof window !== 'undefined') {
  try {
    setWasmSource(new URL('/react-pptx/pptx_wasm_bg.wasm', window.location.origin).href);
  } catch {
    // WASM was already initialized in this realm (e.g. after HMR); the source
    // is fixed and cannot be reconfigured. Safe to ignore.
  }
}

interface PptxRendererProps {
  blob?: Blob | null;
  binaryUrl?: string | null;
  fileName: string;
  className?: string;
  /** Extra controls for the viewer's own toolbar, rendered after zoom and
   *  before the file menu. */
  compact?: boolean;
  toolbarActions?: React.ReactNode;
}

/**
 * PptxRenderer — renders `.pptx`/`.ppt` decks inline with @extend-ai/react-pptx,
 * the same library family as the DOCX and XLSX viewers. Read-only; the library
 * provides a native toolbar with zoom, thumbnails, slide navigation, and search.
 */
export function PptxRenderer({
  blob,
  binaryUrl,
  fileName,
  className,
  compact = false,
  toolbarActions,
}: PptxRendererProps) {
  const { resolvedTheme } = useTheme();
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setSrc(null);
    setError(null);

    (async () => {
      let source: Blob | null = blob ?? null;
      if (!source && binaryUrl) {
        const resp = await fetch(binaryUrl);
        if (!resp.ok) throw new Error(`Failed to fetch presentation (${resp.status})`);
        source = await resp.blob();
      }
      if (!source) throw new Error('No presentation content available');
      objectUrl = URL.createObjectURL(source);
      if (cancelled) return;
      setSrc(objectUrl);
    })().catch((err: unknown) => {
      if (cancelled) return;
      console.error('[PptxRenderer] Error loading presentation:', err);
      setError(err instanceof Error ? err.message : 'Failed to load presentation');
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blob, binaryUrl]);

  if (error) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center',
          className,
        )}
      >
        <p className="text-muted-foreground text-sm">Couldn&apos;t display this presentation.</p>
        <Button size="sm" variant="outline" onClick={() => setError(null)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!src) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center', className)}>
        <KortixLoader size="medium" />
      </div>
    );
  }

  return (
    <div
      data-pptx-compact={compact ? '' : undefined}
      className={cn('h-full w-full', className)}
    >
      <ReactPptxViewer
        source={src}
        mode="continuous"
        showToolbar={!compact}
        showThumbnails={!compact}
        showSlideLabels
        className="h-full w-full"
      />
    </div>
  );
}