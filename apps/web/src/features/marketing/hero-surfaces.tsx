'use client';

import { KortixLogo } from '@/components/sidebar/kortix-logo';
import { CliSurface, SdkSurface, SurfaceLink } from '@/features/marketing/landing/code-panels';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/features/icon/icon';
import { KORTIX_CLI_INSTALL_COMMAND } from '@/lib/kortix-cli';
import { cn } from '@/lib/utils';
import {
  ArrowUpRightIcon as ArrowUpRight,
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

const SURFACES: Surface[] = [
  { id: 'web', label: 'Web', icon: Monitor },
  { id: 'slack', label: 'Slack', icon: Icon.Slack },
  { id: 'teams', label: 'MS Teams', icon: Icon.MicrosoftTeams },
  { id: 'email', label: 'Email', icon: EnvelopeIcon },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
  { id: 'cli', label: 'CLI', icon: Terminal },
  { id: 'sdk', label: 'API / SDK', icon: Code2 },
];

/* ── shared bits ─────────────────────────────────────────────────────────── */

function MonoLine({ line }: { line: string }) {
  const slash = line.search(/\s\/\//);
  const hash = line.search(/\s#/);
  const idxs = [slash, hash].filter((i) => i >= 0);
  const ci = idxs.length ? Math.min(...idxs) : -1;
  if (ci >= 0) {
    return (
      <div className="whitespace-pre">
        <span className="text-foreground/85">{line.slice(0, ci)}</span>
        <span className="text-muted-foreground/55">{line.slice(ci)}</span>
      </div>
    );
  }
  return <div className="text-foreground/85 whitespace-pre">{line || ' '}</div>;
}

function CodeWindow({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="bg-card flex h-full flex-col">
      <div className="border-border text-muted-foreground flex items-center gap-2 border-b px-4 py-3 font-mono text-xs">
        <span className="flex gap-1.5">
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
        </span>
        <span className="ml-2">{title}</span>
      </div>
      <div className="flex-1 overflow-auto p-5 font-mono text-xs leading-relaxed sm:p-6 sm:text-sm">
        {lines.map((line, i) => (
          <MonoLine key={`${i}:${line}`} line={line} />
        ))}
      </div>
    </div>
  );
}

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

      <div className="flex flex-1 flex-col justify-end gap-5 overflow-y-auto p-5">
        <ChatBubble name="Marko" avatar={<PersonAvatar initial="M" />}>
          <span className="text-foreground/70">@Kortix</span> {active.ask}
        </ChatBubble>
        <ChatBubble name="Kortix" app avatar={<KortixAvatar />}>
          {active.reply}
        </ChatBubble>
      </div>

      <div className="border-border border-t p-3">
        <p className="text-muted-foreground/60 mb-2 px-0.5 font-mono text-[10px] tracking-widest uppercase">
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

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="border-border rounded-lg border p-4">
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

        <div className="border-border bg-card rounded-lg border p-4">
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

      <div className="border-border text-muted-foreground border-t px-4 py-3 text-center text-xs">
        Slack · Teams · Email · Telegram · WhatsApp · SMS — or build your own channel on the API
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
    <div className="bg-card relative flex h-full items-center justify-center gap-4 overflow-hidden p-6 sm:gap-7 sm:p-10">
      <Badge variant="kortix" className="absolute top-5 left-5 z-10 rounded">
        Coming soon
      </Badge>
      {MOBILE_SHOTS.map((src, i) => (
        <div
          key={src}
          className={cn(
            'border-border bg-background h-full max-h-[460px] shrink-0 overflow-hidden rounded-2xl border shadow-md',
            i === 1 ? 'sm:-translate-y-3' : 'sm:translate-y-3',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Kortix mobile app" className="block h-full w-auto object-contain" />
        </div>
      ))}
    </div>
  );
}

const CLI_LINES = [
  `$ ${KORTIX_CLI_INSTALL_COMMAND}`,
  '✓ Kortix CLI installed  # one-time setup',
  '',
  '$ kortix init acme-ops',
  '✓ Initialized Kortix project "acme-ops"  # everything is files',
  '',
  '$ kortix sessions new --prompt "draft the renewal for Acme"',
  '✓ session/renewal-acme · sandbox booted   # isolated branch',
  '→ change request opened: sales/renewals/acme.md',
  '',
  '$ kortix triggers add morning-brief --cron "0 8 * * 1-5"',
  '✓ scheduled · delivers to #company-ops',
];

const SDK_LINES = [
  'import { createKortix, generateSessionId } from "@kortix/sdk";',
  '',
  '// one typed client for the Kortix API + the agent runtime',
  'const kortix = createKortix({',
  '  backendUrl: "https://api.kortix.com/v1",',
  '  getToken: () => process.env.KORTIX_API_KEY!,',
  '});',
  '',
  '// the same agents your whole company shares',
  'const sessionId = generateSessionId();',
  'await kortix.project(projectId).sessions.create({ session_id: sessionId });',
  '',
  'const session = kortix.session(projectId, sessionId);',
  'await session.start();',
  'await session.send("Draft the renewal for Acme", { agent: "go-to-market" });',
];

const SHOWCASE_POSTER = '/media/showcase/kortix-showcase-poster.jpg';

/** Recorded in the real product: a project, its connectors, agents, skills and
 *  schedules, then a session researching on a cloud computer and returning a
 *  finished deck. */
function WebSurface() {
  return (
    <div className="bg-card relative h-full w-full">
      <video
        className="h-full w-full object-cover object-top motion-reduce:hidden"
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
      return (
        <CliSurface
          cta={<SurfaceLink href="/docs/reference/cli">Full CLI reference</SurfaceLink>}
        />
      );
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
          so the product bleeds off the fold instead of eating a whole screen. */}
      <div className="border-border bg-card h-[300px] overflow-hidden rounded-xl border sm:h-[380px] lg:h-[440px]">
        <SurfacePanel surface={active} />
      </div>

      {/* surfaces sit under the frame: a quiet list of where it runs */}
      <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SURFACES.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'duration-fast flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors',
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
