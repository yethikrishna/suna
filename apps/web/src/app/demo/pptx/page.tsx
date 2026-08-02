'use client';

import { PptxRenderer } from '@/features/file-renderers/pptx-renderer';

export default function PptxDemoPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">PPTX Viewer Demo</h1>
          <p className="text-muted-foreground text-sm">
            @extend-ai/react-pptx &mdash; continuous scroll, thumbnail rail, zoom, search
          </p>
        </div>
        <a
          href="/demo.pptx"
          download
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Download demo.pptx
        </a>
      </div>

      <div className="bg-muted/30 rounded-xl border p-1">
        <PptxRenderer
          binaryUrl="/demo.pptx"
          fileName="kortix-pptx-demo.pptx"
          className="h-[75vh]"
        />
      </div>

      <div className="text-muted-foreground mx-auto mt-2 grid grid-cols-2 gap-8 text-xs sm:grid-cols-4">
        <div className="text-center">
          <div className="text-foreground font-semibold">Continuous</div>
          <div>Scroll all slides</div>
        </div>
        <div className="text-center">
          <div className="text-foreground font-semibold">Thumbnails</div>
          <div>Filmstrip sidebar</div>
        </div>
        <div className="text-center">
          <div className="text-foreground font-semibold">Zoom</div>
          <div>+ / - controls</div>
        </div>
        <div className="text-center">
          <div className="text-foreground font-semibold">Themed</div>
          <div>Follows light/dark</div>
        </div>
      </div>
    </div>
  );
}