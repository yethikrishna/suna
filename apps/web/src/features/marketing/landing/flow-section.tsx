'use client';

import { STEPS } from '@/features/marketing/how-it-work/how-it-works-content';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * From a request to finished work.
 *
 * The section pins for one viewport and the steps advance with scroll. The right
 * panel is a real screenshot of the product at that step, not a diagram — the
 * whole point of the section is that this actually exists.
 */
export function FlowSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onScroll = () => {
      const { top, height } = track.getBoundingClientRect();
      // progress through the scrollable part of the track, 0 → 1
      const scrolled = -top;
      const usable = height - window.innerHeight;
      if (usable <= 0) return;
      const p = Math.min(Math.max(scrolled / usable, 0), 0.9999);
      setActive(Math.floor(p * STEPS.length));
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const step = STEPS[active] ?? STEPS[0];

  return (
    <section id="flow" aria-label="From a request to finished work">
      {/* one viewport of pinned content per step */}
      <div ref={trackRef} style={{ height: `${STEPS.length * 100}vh` }} className="relative">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 lg:grid-cols-12 lg:gap-14">
            {/* left — the steps */}
            <div className="lg:col-span-5">
              <h2 className="text-foreground text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                From a request to finished work.
              </h2>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                Connect your tools, ask for the outcome, and review what comes back. The best
                workflows become reusable skills, and the company&rsquo;s memory compounds — for
                everyone.
              </p>

              <ol className="mt-10 space-y-1">
                {STEPS.map((s, i) => {
                  const isActive = i === active;
                  return (
                    <li key={s.id}>
                      <div
                        className={cn(
                          'duration-fast border-l-2 py-2 pl-4 transition-colors',
                          isActive ? 'border-foreground' : 'border-border',
                        )}
                      >
                        <div className="flex items-baseline gap-3">
                          <span
                            className={cn(
                              'font-mono text-[11px] tabular-nums',
                              isActive ? 'text-foreground/50' : 'text-muted-foreground/40',
                            )}
                          >
                            {s.step}
                          </span>
                          <span
                            className={cn(
                              'text-sm font-medium tracking-tight',
                              isActive ? 'text-foreground' : 'text-muted-foreground/60',
                            )}
                          >
                            {s.title}
                          </span>
                        </div>

                        {isActive && (
                          <div className="mt-2 pl-[calc(1.25rem+2px)]">
                            <p className="text-muted-foreground text-sm leading-relaxed">
                              {s.description}
                            </p>
                            <ul className="mt-3 space-y-1.5">
                              {s.bullets.slice(0, 3).map((b) => (
                                <li
                                  key={b}
                                  className="text-muted-foreground/80 flex gap-2 text-sm leading-relaxed"
                                >
                                  <span aria-hidden className="text-muted-foreground/40">
                                    ·
                                  </span>
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* right — the product at that step */}
            <div className="lg:col-span-7">
              <div className="border-border bg-card relative aspect-[16/10] overflow-hidden rounded-sm border">
                {STEPS.map((s, i) => (
                  <Image
                    key={s.id}
                    src={`/media/steps/${s.id}.webp`}
                    alt={`Kortix — ${s.title}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 720px"
                    priority={i === 0}
                    className={cn(
                      'object-cover object-top transition-opacity duration-500',
                      i === active ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                ))}
              </div>

              <p className="text-muted-foreground/60 mt-3 text-center font-mono text-[11px] tracking-wide">
                {step.label} · {step.step} of {String(STEPS.length).padStart(2, '0')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
