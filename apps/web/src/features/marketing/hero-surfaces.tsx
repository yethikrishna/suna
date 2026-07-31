'use client';

import { KortixLogo } from '@/components/sidebar/kortix-logo';
import { CopyButton } from '@/components/markdown/copy-button';
import Hint from '@/components/ui/hint';
import { SdkSurface, SurfaceLink } from '@/features/marketing/landing/code-panels';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/features/icon/icon';
import { KORTIX_CLI_INSTALL_COMMAND } from '@/lib/kortix-cli';
import { cn } from '@/lib/utils';
import {
  CodeSimpleIcon as Code2,
  EnvelopeSimpleIcon as EnvelopeIcon,
  MonitorIcon as Monitor,
  DeviceMobileIcon as Smartphone,
  TerminalIcon as Terminal,
} from '@phosphor-icons/react';
import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useState } from 'react';

type SurfaceId = 'web' | 'slack' | 'teams' | 'email' | 'mobile' | 'cli' | 'sdk';

type Surface = {
  id: SurfaceId;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

/** Web leads; the two developer surfaces sit together at the end. */
const SURFACES: Surface[] = [
  { id: 'web', label: 'Web', icon: Monitor },
  { id: 'slack', label: 'Slack', icon: Icon.Slack },
  { id: 'teams', label: 'MS Teams', icon: Icon.MicrosoftTeams },
  { id: 'email', label: 'Email', icon: EnvelopeIcon },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'cli', label: 'CLI', icon: Terminal },
  { id: 'sdk', label: 'API / SDK', icon: Code2 },
];

/** A phone frame cannot hold a whole thread, so the last line in view is often
 *  cut through its x-height — which reads as a rendering fault rather than as
 *  more content. This fades the final 1.5rem of the scroll area at phone width
 *  only, where the clip actually happens, so the cut reads as "this continues"
 *  and doubles as the cue to scroll. Desktop has the room and keeps hard edges. */
const SCROLL_FADE =
  '[mask-image:linear-gradient(to_bottom,#000_calc(100%-1.5rem),transparent)] sm:[mask-image:none]';

/* ── chat surfaces (Slack / Teams) ───────────────────────────────────────── */

function ChatBubble({
  name,
  app,
  avatar,
  children,
}: {
  name: string;
  app?: boolean;
  avatar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {avatar}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-sm font-semibold">{name}</span>
          {app && (
            <span className="bg-muted text-muted-foreground rounded-[0.2rem] px-1 py-px text-[8px] font-medium">
              APP
            </span>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function KortixAvatar() {
  return (
    <span className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-md">
      <KortixLogo size={15} className="text-background" />
    </span>
  );
}

function PersonAvatar({ initial }: { initial: string }) {
  return (
    <span className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
      {initial}
    </span>
  );
}


/** Pick an ask and the thread answers — the surface is meant to be poked at,
 *  not read. Each reply is the kind of artifact the agent actually returns. */
const CHAT_ASKS = [
  {
    id: 'brief',
    ask: 'what changed in our repo since Monday?',
    reply: (
      <div className="space-y-1.5">
        <p className="text-foreground font-medium">Here&rsquo;s what changed since Monday:</p>
        <ul className="space-y-1">
          <li>· 14 PRs merged · 3 need your review</li>
          <li>· Stripe revenue +$3,482</li>
          <li>· Renewal drafted for Northwind — waiting on sign-off</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'pipeline',
    ask: 'what moved in the pipeline this week?',
    reply: (
      <div className="space-y-1.5">
        <p className="text-foreground font-medium">7 deals advanced, 2 slipped.</p>
        <ul className="space-y-1">
          <li>· Northwind → Proposal ($120k)</li>
          <li>· Globex → Negotiation ($90k)</li>
          <li>· At risk: Initech, Umbrella — no activity in 14 days</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'deck',
    ask: 'turn this week\u2019s changelog into a launch deck',
    reply: (
      <div className="space-y-2">
        <p className="text-foreground font-medium">Done — 10 slides, grounded in your docs.</p>
        <div className="flex flex-wrap gap-1.5">
          {['launch-deck.pptx', 'launch-post.md'].map((f) => (
            <span
              key={f}
              className="border-border text-muted-foreground rounded-sm border px-2 py-0.5 font-mono text-[11px]"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    ),
  },
] as const;

function ChatSurface({ brand }: { brand: 'slack' | 'teams' }) {
  const BrandIcon = brand === 'slack' ? Icon.Slack : Icon.MicrosoftTeams;
  const [askId, setAskId] = useState<(typeof CHAT_ASKS)[number]['id']>('brief');
  const active = CHAT_ASKS.find((a) => a.id === askId) ?? CHAT_ASKS[0];

  return (
    <div className="bg-background flex h-full flex-col">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <BrandIcon className="size-5" />
          <span className="text-foreground text-sm font-semibold">Kortix</span>
          {brand === 'teams' && (
            <Badge variant="kortix" size="sm" className="rounded">
              Coming soon
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground font-mono text-xs">#company-ops</span>
      </div>

      {/* justify-start, not justify-end. The thread is short enough to fit on a
          laptop either way, but at phone width it can still run past the frame,
          and the two choices fail in opposite directions: end-justified, the
          overflow eats the ask and the "Kortix APP" attribution off the top, so
          the panel reads as a stray bullet list by nobody. Start-justified, it
          eats the last bullet instead — you always keep "someone asked, Kortix
          answered", which is the entire claim the panel exists to make. */}
      <div
        className={cn(
          'flex flex-1 flex-col justify-start gap-4 overflow-y-auto p-4 sm:gap-5 sm:p-5',
          SCROLL_FADE,
        )}
      >
        <ChatBubble name="Marko" avatar={<PersonAvatar initial="M" />}>
          <span className="text-foreground/70">@Kortix</span> {active.ask}
        </ChatBubble>
        <ChatBubble name="Kortix" app avatar={<KortixAvatar />}>
          {active.reply}
        </ChatBubble>
      </div>

      <div className="border-border shrink-0 border-t p-2.5 sm:p-3">
        {/* The label is a signpost for a control that is already self-evident —
            three taps in a row under a thread. On a phone those ~22px are worth
            more to the thread above, so it only appears once there is room. */}
        <p className="text-muted-foreground/60 mb-2 hidden px-0.5 font-mono text-[10px] tracking-widest uppercase sm:block">
          Try another
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CHAT_ASKS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAskId(a.id)}
              aria-pressed={a.id === askId}
              className={cn(
                'duration-fast border-border rounded-full border px-2.5 py-1 text-left text-xs transition-colors',
                a.id === askId
                  ? 'bg-foreground text-background border-transparent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]',
              )}
            >
              {a.ask}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Email is a first-class channel: forward a thread, get the work back in it. */
function EmailSurface() {
  return (
    <div className="bg-background flex h-full flex-col">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <EnvelopeIcon className="text-muted-foreground size-5" />
          <span className="text-foreground text-sm font-semibold">Inbox</span>
        </div>
        <span className="text-muted-foreground font-mono text-xs">ops@acme.com</span>
      </div>

      <div
        className={cn('flex flex-1 flex-col gap-3 overflow-y-auto p-4 sm:gap-4 sm:p-5', SCROLL_FADE)}
      >
        <div className="border-border shrink-0 rounded-lg border p-3.5 sm:p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-foreground text-sm font-semibold">Priya Raman</span>
            <span className="text-muted-foreground font-mono text-[11px]">08:12</span>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            to kortix@acme.com · Re: Q3 renewals
          </p>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Forwarding the Northwind thread — can you pull their usage and draft the renewal?
          </p>
        </div>

        <div className="border-border bg-card rounded-lg border p-3.5 sm:p-4">
          <div className="flex items-center gap-2">
            <KortixAvatar />
            <div>
              <span className="text-foreground text-sm font-semibold">Kortix</span>
              <p className="text-muted-foreground text-xs">replied · 6 min</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Pulled 12 months of usage from HubSpot and Stripe. Renewal drafted at $108,960 for
            year one. Attached the proposal and the workbook — say the word and I&rsquo;ll send it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['proposal-northwind.pdf', 'usage-2026.xlsx'].map((f) => (
              <span
                key={f}
                className="border-border text-muted-foreground rounded-sm border px-2.5 py-1 font-mono text-[11px]"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* The channel enum is closed: slack, teams, email, voice. Slack is live,
          Teams is behind an operator switch, email and voice are experimental.

          Hidden on phones. It wraps to three lines there and takes ~56px off a
          frame that could not already fit the Kortix reply — and a rollout
          caveat is worth nothing if the thing it qualifies is off screen. The
          same status is stated on /channels, which is where a reader who cares
          about it goes. */}
      <div className="border-border text-muted-foreground hidden shrink-0 border-t px-4 py-3 text-center text-xs sm:block">
        Slack is live · Teams, email and voice are rolling out · or start sessions from the API
      </div>
    </div>
  );
}

const MOBILE_SHOTS = [
  '/images/mobile-app/app-1.png',
  '/images/mobile-app/app-2.png',
  '/images/mobile-app/app-3.png',
];

function MobileSurface() {
  return (
    <div className="bg-card relative flex h-full flex-col overflow-hidden">
      {/* The badge sat over the artwork and landed on the first screenshot's
          headline at phone width. It gets its own band instead, so it can never
          cover the thing it is labelling. */}
      <div className="flex shrink-0 justify-center pt-4 sm:absolute sm:top-5 sm:left-5 sm:z-10 sm:pt-0">
        <Badge variant="kortix" className="rounded">
          Coming soon
        </Badge>
      </div>

      {/* Which axis binds flips at sm. On a phone the row is 344px wide, so the
          binding constraint is width: each card takes a third of it and derives
          its height from the shots' real 1080x2337 aspect, which is why the
          ratio is written out rather than rounded. Height-bound (the desktop
          rule) measured 386px of phones inside 344px and sliced the outer two in
          half. From sm up there is width to spare and height is the binding
          constraint again, so the original height-bound sizing returns. Because
          the card matches the asset's aspect exactly, the image fills it with no
          letterbox either way. */}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 p-4 sm:gap-7 sm:p-10">
        {MOBILE_SHOTS.map((src, i) => (
          <div
            key={src}
            className={cn(
              'border-border bg-background flex justify-center overflow-hidden rounded-2xl border shadow-md',
              'aspect-[1080/2337] max-h-full min-w-0 flex-1',
              'sm:aspect-auto sm:h-full sm:max-h-[460px] sm:w-auto sm:flex-none',
              i === 1 ? 'sm:-translate-y-3' : 'sm:translate-y-3',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Kortix mobile app"
              className="block h-full w-full object-cover sm:w-auto sm:object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const SHOWCASE_POSTER = '/media/showcase/kortix-showcase-poster.jpg';
const CLI_POSTER = '/media/cli/kortix-cli-poster.jpg';

/** Recorded in the real product: a project, its connectors, agents, skills and
 *  schedules, then a session researching on a cloud computer and returning a
 *  finished deck. */
function WebSurface() {
  return (
    <div className="bg-card relative h-full w-full">
      {/* left-top, not top. On desktop the frame is wider than the 16:10
          recording, so `cover` crops vertically and the horizontal anchor is
          inert — left-top and top render identically. At phone width the frame
          is narrower than 16:10, so `cover` crops ~134px horizontally, and a
          centred crop slices the left nav off and cuts the content pane in half.
          Anchoring left keeps the whole sidebar — which is what the product
          *is* — and lets the crop fall on the right edge, where a cut reads as
          a window continuing rather than a screenshot broken. Contain was the
          alternative and is worse: it fits the full 1920px UI into 346px, where
          no label is legible at all. */}
      <video
        className="h-full w-full object-cover object-left-top motion-reduce:hidden"
        poster={SHOWCASE_POSTER}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Kortix in the browser: connect apps, manage agents and skills, and an agent returning a finished pitch deck"
      >
        <source src="/media/showcase/kortix-showcase-1920.webm" type="video/webm" />
        <source src="/media/showcase/kortix-showcase-1920.mp4" type="video/mp4" />
      </video>
      <Image
        src={SHOWCASE_POSTER}
        alt="Kortix in the browser, showing a project and its files"
        fill
        sizes="(max-width: 1024px) 100vw, 1100px"
        className="hidden object-contain motion-reduce:block"
      />
    </div>
  );
}

/** The install command is IN the recording — it is the first thing typed. You
 *  can't select text out of a video, so this is the copy affordance for it:
 *  one icon-only button, sized to sit inside the terminal's title bar, which is
 *  the one band of the frame that never carries output. */
function CopyInstallCommand() {
  return (
    <Hint label="Copy the install command" side="left">
      <span className="border-border bg-background/80 absolute top-2 right-2 z-10 inline-flex rounded-md border shadow-sm backdrop-blur-sm sm:top-3 sm:right-3">
        <CopyButton code={KORTIX_CLI_INSTALL_COMMAND} />
      </span>
    </Hint>
  );
}

/** A real terminal recording, replayed from the captured output of the shipped
 *  CLI: `curl … | bash` installs it, `kortix projects use` picks the project,
 *  `kortix sessions new` boots a cloud computer, then real work runs from the
 *  terminal. Every character on screen is output the CLI produced. */
function CliSurface() {
  return (
    <div className="bg-card relative h-full w-full">
      <CopyInstallCommand />
      {/* left-top, not top: at phone width the frame is narrower than the 16:10
          recording, so a centred crop would slice the first characters off every
          line. Anchoring left keeps the prompt where a terminal starts. */}
      <video
        className="h-full w-full object-cover object-left-top motion-reduce:hidden"
        poster={CLI_POSTER}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="A terminal running the Kortix CLI: curl installs it, kortix projects use picks a project, kortix connectors apps lists the apps an agent can call, and kortix sessions new starts a session on a cloud computer"
      >
        <source src="/media/cli/kortix-cli-1920.webm" type="video/webm" />
        <source src="/media/cli/kortix-cli-1920.mp4" type="video/mp4" />
      </video>
      <Image
        src={CLI_POSTER}
        alt="A terminal showing the Kortix CLI installed and ready"
        fill
        sizes="(max-width: 1024px) 100vw, 1100px"
        className="hidden object-contain motion-reduce:block"
      />
    </div>
  );
}

function SurfacePanel({ surface }: { surface: SurfaceId }) {
  switch (surface) {
    case 'web':
      return <WebSurface />;
    case 'slack':
      return <ChatSurface brand="slack" />;
    case 'teams':
      return <ChatSurface brand="teams" />;
    case 'email':
      return <EmailSurface />;
    case 'mobile':
      return <MobileSurface />;
    case 'cli':
      return <CliSurface />;
    case 'sdk':
      return <SdkSurface cta={<SurfaceLink href="/docs/sdk">Read the SDK docs</SurfaceLink>} />;
  }
}

export function HeroSurfaces() {
  const [active, setActive] = useState<SurfaceId>('web');

  useEffect(() => {
    const syncSurfaceFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (SURFACES.some((surface) => surface.id === hash)) {
        setActive(hash as SurfaceId);
      }
    };

    syncSurfaceFromHash();
    window.addEventListener('hashchange', syncSurfaceFromHash);
    return () => window.removeEventListener('hashchange', syncSurfaceFromHash);
  }, []);

  return (
    <div className="w-full">
      {/* The frame is shorter than the 16:10 recording and anchored to the top,
          so the product bleeds off the fold instead of eating a whole screen.

          One height for all seven surfaces, at every breakpoint. A per-surface
          height would let the video panels sit at their native aspect, but the
          row of pills below is what you tap, and it would jump under your thumb
          on every tab change. So the height is fixed and each panel is made to
          fit it. Phone gets 360px rather than 300px: the videos are `cover`, so
          a taller box costs them nothing (it just shows more of the recording),
          while the five DOM panels need every pixel — at 300px the Slack ask and
          the Kortix reply could not both be on screen. */}
      <div className="border-border bg-card h-[360px] overflow-hidden rounded-xl border sm:h-[380px] lg:h-[440px]">
        <SurfacePanel surface={active} />
      </div>

      {/* Surfaces sit under the frame: a quiet list of where it runs. Nothing
          may sit between the frame and this row — a per-surface caption made
          the whole hero jump on every tab change.

          It wraps rather than scrolls. Seven surfaces are the claim being made,
          so all seven stay on screen at phone width; a scroller would hide
          three of them behind a swipe nobody is prompted to make. Mobile gets
          tighter pills so the two rows sit close instead of straggling. */}
      <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-x-0.5 gap-y-1 sm:gap-x-1">
        {SURFACES.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                // min-h-9 (the theme's --spacing is 0.23rem, so ~33px) keeps the touch
                // target usable while the pill stays tight enough for seven at 390px.
                'duration-fast flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs transition-colors',
                'sm:min-h-0 sm:gap-1.5 sm:px-3 sm:text-[13px]',
                isActive
                  ? 'bg-foreground/[0.06] text-foreground font-medium'
                  : 'text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.03]',
              )}
            >
              <s.icon className="size-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
