'use client';

import { useTranslations } from '@/i18n/use-translations';
import dynamic from 'next/dynamic';

function MermaidLoading() {
  const tI18nComplete = useTranslations('hardcodedUi.i18nComplete');

  return (
    <div className="border-border/40 bg-muted/30 text-muted-foreground my-5 rounded-md border p-6 text-center font-mono text-xs tracking-tight">
      {tI18nComplete.raw('texte2ef6206988d')}
    </div>
  );
}

// Mermaid (~1MB with its deps) loads only when a docs page actually contains a
// ```mermaid fence — never in the shared docs bundle.
const MermaidRenderer = dynamic(
  () => import('@/components/ui/mermaid-renderer').then((mod) => mod.MermaidRenderer),
  {
    ssr: false,
    loading: () => <MermaidLoading />,
  },
);

export function DocsMermaid({ chart }: { chart: string }) {
  return (
    <div className="my-5">
      <MermaidRenderer chart={chart} enableFullscreen />
    </div>
  );
}
