'use client';

import { Card } from '@/components/ui/card';
import { ShaderSafe } from '@/components/ui/shader-safe';
import { Icon } from '@/features/icon/icon';
import { cn } from '@/lib/utils';
import { Heatmap } from '@paper-design/shaders-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { LAYERS, SECTION, type LogoName, type StackLayer } from './content';

/**
 * Scroll length, in vh, that one layer occupies inside the pinned track. The
 * track is `100vh + LAYERS.length * STEP_VH` tall, so the whole section is
 * 100 + 7 * 38 = 366vh — a few viewports, matching the reference. The pinned
 * viewport consumes the first 100vh, leaving exactly STEP_VH of travel per
 * layer.
 */
const STEP_VH = 38;

/**
 * Paper Shaders rejects CSS custom properties: passing `var(--kortix-orange)`
 * renders coloured specks instead of the mark. The literal hex is required.
 */
const MARK_ORANGE = '#d18b19';

/** `Icon` is a plain object map, so a narrowed key type is enough to index it. */
function Logo({ name }: { name: LogoName }): ReactNode {
  const Glyph = Icon[name];
  return (
    // The tile is a fixed light surface in both themes: several brand marks are
    // baked to a dark or fixed fill and would disappear on a dark panel. The
    // explicit `text-neutral-900` also overrides `Icon.Linear`'s own
    // `text-primary` default, which otherwise renders it near-white in dark.
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-black/10 bg-white text-neutral-900">
      <Glyph className="size-4 text-neutral-900" />
    </span>
  );
}

/**
 * The animated metallic Kortix mark, mounted exactly as in
 * `features/marketing/landing/trust-section.tsx`. The canvas stays at 620x620:
 * a 1080x900 canvas reproducibly killed the headless renderer, so keep it well
 * under 900x760.
 */
function MetallicMark({ still }: { still: boolean }): ReactNode {
  return (
    <ShaderSafe>
      <Heatmap
        speed={still ? 0 : 1}
        contour={0.5}
        angle={0}
        noise={0}
        innerGlow={0.5}
        outerGlow={0.05}
        scale={0.62}
        image="/shaders/heatmap-mark.svg"
        frame={407072.499999992}
        colors={[MARK_ORANGE, '#fafafa', '#242424']}
        colorBack="#ffffff00"
        className="shrink-0"
        style={{ height: '620px', width: '620px' }}
      />
    </ShaderSafe>
  );
}

/** The logo / chip row that appears inside an expanded layer. */
function LayerMarks({ layer }: { layer: StackLayer }): ReactNode {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {layer.logos?.map((logo) => (
        <Logo key={logo} name={logo} />
      ))}
      {layer.chips?.map((chip) => (
        <span
          key={chip}
          className="border-border/70 text-muted-foreground rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide uppercase"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

/**
 * One row of the list. Every row renders its body at all times so the DOM is
 * the source of truth for which layer is open: `data-expanded` flips and the
 * `0fr → 1fr` grid row gives the body a real, measurable height.
 */
function LayerRow({
  layer,
  expanded,
  onSelect,
}: {
  layer: StackLayer;
  expanded: boolean;
  onSelect?: () => void;
}): ReactNode {
  return (
    <li
      data-stack-layer={layer.id}
      data-expanded={expanded ? 'true' : 'false'}
      className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3"
    >
      <span
        className={cn(
          'pt-2 font-mono text-[10px] tracking-widest tabular-nums transition-colors duration-300',
          expanded ? 'text-foreground' : 'text-muted-foreground/50',
        )}
      >
        {layer.ordinal}
      </span>

      <div
        className={cn(
          // No `w-full` in the base: Tailwind emits `w-fit` and `w-full` at the
          // same specificity, so a base+override pair would resolve by
          // stylesheet order rather than by intent, and every pill would take
          // the full column width.
          'border text-left transition-all duration-500 ease-out',
          expanded
            ? 'border-border bg-popover w-full rounded-xl px-4 py-3'
            : 'border-transparent bg-muted/60 hover:bg-muted w-fit max-w-full rounded-full px-4 py-1.5',
        )}
      >
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              'block cursor-pointer text-left text-sm font-medium tracking-tight transition-colors duration-300',
              expanded ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {layer.name}
          </button>
        ) : (
          <span className="text-foreground block text-sm font-medium tracking-tight">
            {layer.name}
          </span>
        )}

        <div
          className="grid transition-[grid-template-rows] duration-500 ease-out"
          style={{
            gridTemplateRows: expanded ? '1fr' : '0fr',
            // The body stays mounted while collapsed so the DOM reports which
            // layer is open. Without inline-size containment its paragraph
            // would still contribute its max-content width to the pill, and
            // every collapsed pill would stretch to the full column.
            contain: expanded ? undefined : 'inline-size',
          }}
        >
          <div data-stack-body className="overflow-hidden">
            <p className="text-muted-foreground max-w-md pt-2 text-[13px] leading-relaxed">
              {layer.description}
            </p>
            <LayerMarks layer={layer} />
          </div>
        </div>
      </div>
    </li>
  );
}

function SectionHeader(): ReactNode {
  return (
    <div className="max-w-md">
      <p className="text-muted-foreground/70 font-mono text-[10px] tracking-widest uppercase">
        {SECTION.eyebrow}
      </p>
      <h2 className="text-foreground mt-3 text-2xl leading-[1.15] font-medium tracking-tight sm:text-[1.75rem]">
        {SECTION.title}
      </h2>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{SECTION.description}</p>
    </div>
  );
}

/**
 * `prefers-reduced-motion` fallback: no pinning, no scroll driving, every layer
 * open. Resolved in an effect so the server and the first client render agree.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/**
 * Scroll position inside the pinned track, as 0..1, plus the layer index it
 * selects. Driven by the track's own `getBoundingClientRect`, so it needs no
 * knowledge of what sits above it on the page.
 */
function useTrackProgress(trackRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      setProgress(Math.min(1, Math.max(0, -rect.top / travel)));
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, trackRef]);

  const active = Math.min(LAYERS.length - 1, Math.floor(progress * LAYERS.length));
  return { progress, active };
}

/**
 * The scroll-pinned platform stack.
 *
 * The section pins for `100vh + 7 * 38vh`. Every category label stays on screen
 * the whole time as a vertical list of pills; scroll position expands exactly
 * one of them into a panel with its description and a row of logos or chips. A
 * scrubber reports how much of the track is spent, and "Skip section" jumps
 * past it.
 */
export function PlatformStack(): ReactNode {
  const trackRef = useRef<HTMLDivElement>(null);
  const [manual, setManual] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const { progress, active } = useTrackProgress(trackRef, !reduced);

  // A click pins a layer open until the next scroll tick moves the track on.
  const expandedIndex = manual ?? active;
  useEffect(() => {
    setManual(null);
  }, [active]);

  if (reduced) {
    return (
      <section id="platform-stack" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <SectionHeader />
        <ul className="mt-10 space-y-3">
          {LAYERS.map((layer) => (
            <LayerRow key={layer.id} layer={layer} expanded />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section id="platform-stack">
      {/* The heading sits in normal flow above the track, so the pinned
          viewport has to fit only the seven labels, the mark and the scrubber —
          it stays readable down to a 660px-tall viewport. The right-hand card
          repeats the eyebrow so the section keeps its name while pinned. */}
      <div className="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
        <SectionHeader />
      </div>

      <div
        ref={trackRef}
        data-stack-track
        style={{ height: `${100 + LAYERS.length * STEP_VH}vh` }}
      >
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <div className="mx-auto flex h-full max-w-6xl flex-col px-6 pt-20 pb-6 sm:pb-10">
            <div className="grid min-h-0 flex-1 gap-10 lg:grid-cols-2 lg:gap-12">
              <ul className="space-y-1.5 self-start">
                {LAYERS.map((layer, i) => (
                  <LayerRow
                    key={layer.id}
                    layer={layer}
                    expanded={i === expandedIndex}
                    onSelect={() => setManual(i)}
                  />
                ))}
              </ul>

              {/* Right half: the animated Kortix mark. Monochrome by design —
                  there is no isometric asset and none is invented here. */}
              <Card className="bg-muted/30 relative hidden h-full min-h-0 items-center justify-center overflow-hidden lg:flex">
                <span className="text-muted-foreground/60 absolute top-4 left-4 z-10 font-mono text-[10px] tracking-widest tabular-nums">
                  {LAYERS[expandedIndex]?.ordinal} / {String(LAYERS.length).padStart(2, '0')}
                </span>
                <span className="text-muted-foreground/40 absolute top-4 right-4 z-10 font-mono text-[10px] tracking-widest uppercase">
                  {SECTION.eyebrow}
                </span>
                <div aria-hidden className="pointer-events-none scale-[0.72] opacity-80 select-none">
                  <MetallicMark still={false} />
                </div>
                <span className="text-muted-foreground/60 absolute bottom-4 left-4 z-10 font-mono text-[10px] tracking-widest uppercase">
                  {LAYERS[expandedIndex]?.name}
                </span>
              </Card>
            </div>

            <div className="mt-6 flex shrink-0 items-center gap-6">
              <a
                href="#platform-stack-end"
                className="text-muted-foreground hover:text-foreground shrink-0 font-mono text-[10px] tracking-widest uppercase transition-colors"
              >
                {SECTION.skipLabel}
              </a>
              <div
                className="bg-border/60 relative h-[3px] w-full max-w-xs overflow-hidden rounded-full"
                role="presentation"
              >
                <span
                  data-stack-scrubber
                  className="bg-foreground/70 absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="platform-stack-end" aria-hidden className="h-px scroll-mt-24" />
    </section>
  );
}
