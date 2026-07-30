'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/marketing/button';
import { WallpaperBackground } from '@/components/ui/wallpaper-background';
import { useRequestDemo } from '@/features/contact/request-demo-provider';
import { HeroSurfaces } from '@/features/marketing/hero-surfaces';
import { hero } from '@/features/marketing/landing/content';
import { useAuth } from '@/features/providers/auth-provider';
import { trackCtaSignup } from '@/lib/analytics/gtm';
import { latestProjectPath } from '@/lib/onboarding/last-project-cookie';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { useCallback } from 'react';

const Hero = () => {
  const { user } = useAuth();
  const openDemo = useRequestDemo();

  const handleLaunch = useCallback(() => {
    trackCtaSignup();
    window.location.href = user ? latestProjectPath(user?.id) : '/auth';
  }, [user]);

  return (
    <section id="hero" className="relative overflow-hidden px-6 pt-32 pb-12 sm:py-36">
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
            {hero.eyebrow}
          </Badge>

          <h1 className="text-foreground mt-6 max-w-4xl text-4xl font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {hero.title}
          </h1>

          <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed text-balance sm:text-xl">
            {hero.sub}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="xl" onClick={handleLaunch}>
              {hero.ctaPrimary}
              <ArrowRightIcon className="size-4" />
            </Button>
            <Button size="xl" variant="secondary" onClick={() => openDemo()}>
              {hero.ctaSecondary}
            </Button>
          </div>

          <p className="text-muted-foreground/70 mt-6 font-mono text-[11px] tracking-wide">
            {hero.trust}
          </p>
        </div>

        <div id="demo" className="relative z-10 mx-auto mt-14 max-w-6xl scroll-mt-24 sm:mt-20">
          <HeroSurfaces />
        </div>
      </div>
    </section>
  );
};

export default Hero;
