'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/marketing/button';
import { WallpaperBackground } from '@/components/ui/wallpaper-background';
import { useRequestDemo } from '@/features/contact/request-demo-provider';
import { HeroSurfaces } from '@/features/marketing/hero-surfaces';
import { hero, heroVariants } from '@/features/marketing/landing/content';
import { useAuth } from '@/features/providers/auth-provider';
import { trackCtaSignup } from '@/lib/analytics/gtm';
import { latestProjectPath } from '@/lib/onboarding/last-project-cookie';
import { cn } from '@/lib/utils';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';

const Hero = () => {
  const { user } = useAuth();
  const openDemo = useRequestDemo();

  // Dev-only variant preview: ?hero=0..3 swaps the headline so alternatives can
  // be compared in place. Renders nothing in production.
  type HeroCopy = { id: string; eyebrow: string; title: string; sub: string };
  const [variant, setVariant] = useState<HeroCopy>(hero);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const apply = () => {
      const i = Number(new URLSearchParams(window.location.search).get('hero'));
      setVariant(Number.isInteger(i) && heroVariants[i] ? { ...hero, ...heroVariants[i] } : hero);
    };
    apply();
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, []);

  const handleLaunch = useCallback(() => {
    trackCtaSignup();
    window.location.href = user ? latestProjectPath(user?.id) : '/auth';
  }, [user]);

  return (
    <section id="hero" className="relative overflow-hidden px-6 pt-28 pb-10 sm:pt-32 sm:pb-14">
      <div
        className="inset-0 z-0 hidden mask-t-from-70% lg:absolute"
        aria-hidden
        data-a11y-decorative
      >
        <WallpaperBackground wallpaperId="brandmark" />
      </div>

      <div className="relative z-20">
        <div className="mx-auto w-full max-w-6xl">
          <Badge variant="kortix" className="rounded">
            {variant.eyebrow}
          </Badge>

          <h1 className="text-foreground mt-5 max-w-3xl text-4xl font-medium tracking-tight text-balance sm:text-5xl">
            {variant.title}
          </h1>

          {/* sub on the left, actions on the right — keeps the fold short */}
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed sm:text-lg">
              {variant.sub}
            </p>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Button size="lg" onClick={handleLaunch}>
                {hero.ctaPrimary}
                <ArrowRightIcon className="size-4" />
              </Button>
              <Button size="lg" variant="secondary" onClick={() => openDemo()}>
                {hero.ctaSecondary}
              </Button>
            </div>
          </div>
        </div>

        <div id="demo" className="relative z-10 mx-auto mt-10 max-w-6xl scroll-mt-24 sm:mt-12">
          <HeroSurfaces />
        </div>

        <p className="text-muted-foreground/60 mx-auto mt-6 max-w-6xl text-center font-mono text-[11px] tracking-wide">
          {hero.trust}
        </p>

        {process.env.NODE_ENV !== 'production' && (
          <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-center gap-1.5">
            <span className="text-muted-foreground/40 font-mono text-[10px] tracking-widest uppercase">
              Hero variant
            </span>
            {heroVariants.map((v, i) => (
              <a
                key={v.id}
                href={`/?hero=${i}`}
                className={cn(
                  'border-border rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors',
                  v.id === variant.id
                    ? 'bg-foreground text-background border-transparent'
                    : 'text-muted-foreground/70 hover:text-foreground',
                )}
              >
                {v.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Hero;
