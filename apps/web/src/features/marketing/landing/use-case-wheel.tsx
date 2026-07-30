'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCases, type UseCase } from './content';

const CARDS = useCases.cards;
const COUNT = CARDS.length;

/**
 * Arc geometry.
 *
 * Each card owns a slot on a wheel. `head` is the slot currently at the centre
 * and is driven straight off scroll progress, so scrolling rotates the wheel.
 * A card's signed distance from the centre is `offset = wrap(index - head)`,
 * wrapped into `[-COUNT/2, COUNT/2)` so the deck never runs out of cards on
 * either side — it is a wheel, not a queue.
 *
 * From that offset:
 *   theta = offset * ANGLE_STEP          (rotation, and the angle on the arc)
 *   x     = sin(theta) * RADIUS_X        (fan out sideways)
 *   y     = (1 - cos(theta)) * RADIUS_Y  (drop away from the centre)
 *
 * RADIUS_Y is much smaller than RADIUS_X, so the arc is a wide shallow ellipse
 * that fits inside one viewport instead of a circle that would push the outer
 * cards off the bottom of the screen.
 */
const ANGLE_STEP = 9;
const RADIUS_X = 1080;
const RADIUS_Y = 620;
/**
 * Cards stay fully opaque out to `FADE_EDGE - FADE_SPAN` slots so they occlude
 * each other like a real deck; only the outermost pair fades, which hides the
 * wrap-around jump at ±COUNT/2 and lets the deck read as endless.
 */
const FADE_EDGE = 4.2;
const FADE_SPAN = 1.2;
/** Total scroll length of the pinned track. Pinned travel is this minus 100vh. */
const TRACK_VH = 360;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Signed slot distance, wrapped into [-COUNT/2, COUNT/2). */
function wrapOffset(raw: number): number {
  const half = COUNT / 2;
  return ((((raw + half) % COUNT) + COUNT) % COUNT) - half;
}

function ThreadMock({ card }: { card: UseCase }) {
  return (
    <div className="border-border bg-background/70 mt-auto rounded-sm border">
      <div className="flex gap-2.5 px-3 py-2.5">
        <span className="text-muted-foreground/60 mt-px shrink-0 font-mono text-[9px] tracking-widest uppercase">
          {useCases.askLabel}
        </span>
        <p className="text-foreground/70 text-[12px] leading-snug">{card.ask}</p>
      </div>
      <div className="border-border/70 flex gap-2.5 border-t px-3 py-2.5">
        <span className="text-muted-foreground/60 mt-px shrink-0 font-mono text-[9px] tracking-widest uppercase">
          {useCases.artifactLabel}
        </span>
        <p className="text-foreground font-mono text-[11px] leading-snug break-words">
          {card.artifact}
        </p>
      </div>
    </div>
  );
}

/**
 * One card. Identical chrome for every department — Kortix is monochrome, so a
 * card is told apart by its mono tag, not by a colour.
 */
function UseCaseCard({ card, index, active }: { card: UseCase; index: number; active: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-foreground/80 font-mono text-[10px] tracking-widest uppercase">
          {card.tag}
        </span>
        <span className="text-muted-foreground/40 font-mono text-[10px] tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <h3
        className={cn(
          'mt-4 text-[17px] leading-snug font-medium tracking-tight text-balance',
          active ? 'text-foreground' : 'text-foreground/85',
        )}
      >
        {card.headline}
      </h3>
      <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">{card.body}</p>
      <ThreadMock card={card} />
    </>
  );
}

const CARD_SHELL =
  'border-border bg-card flex flex-col rounded-xl border p-4 sm:p-5 transition-shadow duration-300';

const EDGE_MASK =
  'linear-gradient(to right, transparent 0%, #000 7%, #000 93%, transparent 100%)';

/** Header, shared by the wheel and the reduced-motion grid. */
function SectionHeader({ counter }: { counter?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <Badge variant="kortix" className="rounded">
        {useCases.eyebrow}
      </Badge>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h2
          id="use-case-wheel-title"
          className="text-foreground max-w-3xl text-3xl font-medium tracking-tight text-balance sm:text-4xl"
        >
          {useCases.title}
        </h2>
        {counter}
      </div>
      <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed">
        {useCases.sub}
      </p>
    </div>
  );
}

/** `prefers-reduced-motion` fallback: the same ten cards, no transforms. */
function UseCaseGrid() {
  return (
    <section
      id="use-cases"
      aria-labelledby="use-case-wheel-title"
      className="py-16 sm:py-24"
    >
      <SectionHeader />
      <div className="mx-auto mt-12 grid w-full max-w-6xl grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card, index) => (
          <article key={card.id} className={CARD_SHELL}>
            <UseCaseCard card={card} index={index} active={false} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function UseCaseWheel(): ReactNode {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const activeRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Server and first client render always take the wheel branch, so the tree
  // cannot mismatch during hydration; the grid swaps in after mount.
  const reduce = mounted && (prefersReduced ?? false);

  useEffect(() => {
    if (reduce) return;

    let frame = 0;

    const paint = () => {
      frame = 0;
      const track = trackRef.current;
      if (!track) return;

      const span = track.offsetHeight - window.innerHeight;
      const progress = span <= 0 ? 0 : clamp01(-track.getBoundingClientRect().top / span);
      const head = progress * (COUNT - 1);

      // Narrow screens get a tighter fan so the outer cards stay on screen.
      const spread = Math.min(1, window.innerWidth / 1280);

      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < COUNT; i += 1) {
        const offset = wrapOffset(i - head);
        const distance = Math.abs(offset);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }

        const el = cardRefs.current[i];
        if (!el) continue;

        const theta = offset * ANGLE_STEP;
        const rad = (theta * Math.PI) / 180;
        const x = Math.sin(rad) * RADIUS_X * spread;
        const y = (1 - Math.cos(rad)) * RADIUS_Y;
        const scale = 1 - Math.min(distance, 5) * 0.05;
        const fade = clamp01((FADE_EDGE - distance) / FADE_SPAN);

        el.style.transform = `translate(-50%, 0) translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${theta.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        el.style.opacity = fade.toFixed(3);
        el.style.zIndex = String(50 - Math.round(distance * 8));
        el.style.visibility = fade > 0 ? 'visible' : 'hidden';
      }

      if (activeRef.current !== nearest) {
        activeRef.current = nearest;
        setActiveIndex(nearest);
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [reduce]);

  if (reduce) return <UseCaseGrid />;

  return (
    <section id="use-cases" aria-labelledby="use-case-wheel-title">
      <div ref={trackRef} className="relative" style={{ height: `${TRACK_VH}vh` }}>
        {/* Pinned viewport: header on top, wheel below. `overflow-hidden` sits on
            the sticky element itself so the fanned cards can never widen the
            document and produce a horizontal scrollbar. */}
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden pt-20">
          <SectionHeader
            counter={
              <div className="flex shrink-0 items-center gap-3">
                <div aria-hidden className="flex items-end gap-[3px]">
                  {CARDS.map((card, index) => (
                    <span
                      key={card.id}
                      className={cn(
                        'w-[3px] rounded-full transition-all duration-300',
                        index === activeIndex ? 'bg-foreground h-4' : 'bg-foreground/20 h-2',
                      )}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground/60 font-mono text-[11px] tabular-nums">
                  {String(activeIndex + 1).padStart(2, '0')} / {String(COUNT).padStart(2, '0')}
                </span>
              </div>
            }
          />

          <div
            className="relative mx-auto my-auto h-[540px] w-full"
            data-active-index={activeIndex}
            // Softens the point where the deck runs off the left and right edges,
            // so the wheel reads as endless instead of clipped.
            style={{
              maskImage: EDGE_MASK,
              WebkitMaskImage: EDGE_MASK,
            }}
          >
            {CARDS.map((card, index) => (
              <article
                key={card.id}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                data-use-case={card.id}
                data-active={index === activeIndex ? 'true' : 'false'}
                className={cn(
                  CARD_SHELL,
                  'absolute top-6 left-1/2 h-[330px] w-[290px] will-change-transform sm:h-[344px] sm:w-[352px]',
                  'shadow-xs data-[active=true]:shadow-lg',
                )}
                style={{ transform: 'translate(-50%, 0)' }}
              >
                <UseCaseCard card={card} index={index} active={index === activeIndex} />
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
