'use client';

import { Button } from '@/components/ui/marketing/button';
import { WallpaperBackground } from '@/components/ui/wallpaper-background';
import { useRequestDemo } from '@/features/contact/request-demo-provider';
import { HeroSurfaces } from '@/features/marketing/hero-surfaces';
import { Icon } from '@/features/icon/icon';
import { hero, heroEyebrow } from '@/features/marketing/landing/content';
import { useAuth } from '@/features/providers/auth-provider';
import { trackCtaSignup } from '@/lib/analytics/gtm';
import { latestProjectPath } from '@/lib/onboarding/last-project-cookie';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { type ReactNode, useCallback } from 'react';

/** Anchors the product against the two things a reader already knows, with
 *  their marks, so "AI Management System" lands without a paragraph first. */
function RivalEyebrow() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
      <span>{heroEyebrow.lead}</span>
      {heroEyebrow.rivals.map((r, i) => {
        const Glyph = Icon[r.icon as keyof typeof Icon] as
          | ((p: { className?: string }) => ReactNode)
          | undefined;
        return (
          <span key={r.id} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/50 mr-1">and</span>}
            {Glyph ? <Glyph className="size-4" /> : null}
            <span className="text-foreground font-medium">{r.label}</span>
          </span>
        );
      })}    </div>
  );
}

const Hero = () => {
  const { user } = useAuth();
  const openDemo = useRequestDemo();

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
        <div className="mx-auto w-full max-w-7xl">
          <RivalEyebrow />

          <h1 className="text-foreground mt-5 max-w-3xl text-4xl font-medium tracking-tight text-balance sm:text-5xl">
            {hero.title}
          </h1>

          {/* sub on the left, actions on the right — keeps the fold short */}
          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed sm:text-lg">
              {hero.sub}
            </p>

            {/* The two CTAs split the full width on a phone and shrink to their
                labels from sm up. Left at their intrinsic width they came to 139
                and 123 of the 346 available, which is both a small target and an
                odd ragged pair under a full-bleed headline.

                h-12 on phones only. This theme sets --spacing to 0.23rem, so the
                shared size="lg" resolves to 36.8px, under the 44px touch target
                every mobile platform asks for; h-12 is 44.2px. The override is
                local because sm and up keeps the 36.8px the rest of the site is
                drawn to. */}
            <div className="flex w-full shrink-0 flex-wrap gap-3 sm:w-auto">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => openDemo()}
                className="h-12 flex-1 sm:h-10 sm:flex-none"
              >
                {hero.ctaSecondary}
              </Button>
              <Button
                size="lg"
                onClick={handleLaunch}
                className="h-12 flex-1 sm:h-10 sm:flex-none"
              >
                {hero.ctaPrimary}
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div id="demo" className="relative z-10 mx-auto mt-10 max-w-7xl scroll-mt-24 sm:mt-12">
          <HeroSurfaces />
        </div>

        <p className="text-muted-foreground/60 mx-auto mt-6 max-w-7xl text-center font-mono text-[11px] tracking-wide">
          {hero.trust}
        </p>
      </div>
    </section>
  );
};

export default Hero;
