'use client';

import { Reveal } from '@/components/home/reveal';
import { Button } from '@/components/ui/marketing/button';
import { useRequestDemo } from '@/features/contact/request-demo-provider';
import { useAuth } from '@/features/providers/auth-provider';
import { trackCtaSignup } from '@/lib/analytics/gtm';
import { latestProjectPath } from '@/lib/onboarding/last-project-cookie';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { useCallback } from 'react';
import { cta } from './content';

export function CtaSection() {
  const { user } = useAuth();
  const openDemo = useRequestDemo();

  const handleLaunch = useCallback(() => {
    trackCtaSignup();
    window.location.href = user ? latestProjectPath(user.id) : '/auth';
  }, [user]);

  return (
    <section id="cta" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-foreground text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {cta.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">{cta.sub}</p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="xl" onClick={handleLaunch}>
              {cta.ctaPrimary}
              <ArrowRightIcon className="size-4" />
            </Button>
            <Button size="xl" variant="secondary" onClick={() => openDemo()}>
              {cta.ctaSecondary}
            </Button>
          </div>

          <p className="text-muted-foreground/70 mt-6 font-mono text-[11px] tracking-wide">
            {cta.trust}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
