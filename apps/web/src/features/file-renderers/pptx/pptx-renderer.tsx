'use client';

import { KortixLoader } from '@/components/ui/kortix-loader';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { PptxViewerPreview } from './pptx-viewer';

export function resolvePptxSource({
  binaryUrl,
  blob,
  createObjectUrl,
}: {
  binaryUrl?: string | null;
  blob?: Blob | null;
  createObjectUrl: (blob: Blob) => string;
}): { src: string | null; revocable: boolean } {
  if (blob) {
    return { src: createObjectUrl(blob), revocable: true };
  }
  return { src: binaryUrl ?? null, revocable: false };
}

interface PptxRendererProps {
  blob?: Blob | null;
  binaryUrl?: string | null;
  /** Original file name, shown in the toolbar and used for downloads. The
   *  object URL backing the viewer has no usable name of its own. */
  fileName?: string;
  className?: string;
  /** Extra controls for the viewer's own toolbar, rendered after zoom and
   *  before the file menu — so a caller adds actions to the ONE header this
   *  viewer already has, instead of stacking a second one above it. */
  toolbarActions?: React.ReactNode;
  compact?: boolean;
}

export function PptxRenderer({
  blob,
  binaryUrl,
  fileName,
  className,
  compact = false,
  toolbarActions,
}: PptxRendererProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const { src: nextSrc, revocable } = resolvePptxSource({
      binaryUrl,
      blob,
      createObjectUrl: (b) => URL.createObjectURL(b),
    });
    setSrc(nextSrc);
    return () => {
      if (revocable && nextSrc) URL.revokeObjectURL(nextSrc);
    };
  }, [blob, binaryUrl]);

  if (!src) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center', className)}>
        <KortixLoader size="medium" />
      </div>
    );
  }

  return (
    <PptxViewerPreview
      src={src}
      fileName={fileName}
      showToolbar={!compact}
      showUpload={false}
      defaultThumbnailSidebarOpen={!compact}
      className={cn('h-full w-full', className)}
      toolbarActions={toolbarActions}
    />
  );
}
