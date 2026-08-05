'use client';

/**
 * Step 5 — install Kortix into Slack.
 *
 * Behaviour is unchanged from the pre-redesign wizard: open the install in a
 * popup, POLL for the install to land, and flip to a confirmed state the moment
 * it does. Still gated — `Continue` stays disabled until connected — with a
 * quiet skip as the escape hatch.
 */

import {
  CheckIcon as Check,
  CaretDownIcon as ChevronDown,
  SlidersHorizontalIcon as SlidersHorizontal,
} from '@phosphor-icons/react';
import { Suspense, lazy, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { InfoBanner } from '@/components/ui/info-banner';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { useSlackInstall, useSlackMode } from '@/hooks/channels/use-channels-installations';
import { cn } from '@/lib/utils';

import { StepShell } from '../step-shell';

/** Lazy — keeps the giant connectors-view module out of the project bundle. */
const SlackConnectForm = lazy(() =>
  import('@/features/workspace/customize/sections/connectors-view').then((m) => ({
    default: m.SlackConnectForm,
  })),
);

export function SlackStep({
  projectId,
  onContinue,
  onSkip,
}: {
  projectId: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const mode = useSlackMode(projectId);
  const install = useSlackInstall(projectId);
  const [pollRequested, setPollRequested] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const installUrl = mode.data?.oauth_available ? mode.data.install_url : null;
  const connected = !!install.data;

  // Derived, not stored. The pre-redesign version kept `waiting` in state and
  // used a second effect to flip it off once the install landed — a setState
  // inside an effect body, which cascades a render for something React can just
  // compute. Deriving it also stops the poll below the instant we're connected.
  const waiting = pollRequested && !connected;

  // Poll for the install while we're waiting on the user to approve in Slack.
  const refetch = install.refetch;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => refetch(), 2500);
    return () => clearInterval(id);
  }, [waiting, refetch]);

  const openInstall = () => {
    if (!installUrl) return;
    window.open(installUrl, 'kortix-slack-install', 'width=640,height=780,noopener');
    setPollRequested(true);
  };

  return (
    <StepShell
      title="Install Kortix into Slack"
      description="This is where most teams actually use Kortix. Install the app and you can @mention your agent, kick off tasks, and get results right inside Slack."
      primaryLabel="Continue"
      primaryDisabled={!connected}
      onPrimary={onContinue}
      skipLabel={connected ? undefined : 'Skip for now'}
      onSkip={connected ? undefined : onSkip}
    >
      <div className="flex flex-col gap-4">
        {connected ? (
          <InfoBanner tone="success" icon={Check} title="Slack connected">
            Installed to{' '}
            <span className="font-medium">
              {install.data?.workspaceName || install.data?.workspaceId}
            </span>
            . You can @mention your agent in any channel it&apos;s invited to.
          </InfoBanner>
        ) : (
          <div className="bg-popover flex flex-col items-center gap-4 rounded-md border px-4 py-8 text-center">
            <SlackGlyph />
            {waiting ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Loading className="size-4 shrink-0" />
                  Waiting for you to approve in Slack…
                </div>
                <p className="text-muted-foreground text-xs leading-5 text-pretty">
                  Approve the install in the window that opened. We&apos;ll detect it automatically
                  — no need to come back and click anything.
                </p>
                <Button variant="ghost" size="sm" className="mt-1" onClick={openInstall}>
                  Reopen Slack install
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-muted-foreground text-sm leading-6 text-pretty">
                  One click — authorize Kortix in your workspace, no setup required.
                </p>
                <Button
                  className="active:scale-[0.96]"
                  onClick={openInstall}
                  disabled={mode.isLoading || !installUrl}
                >
                  Add to Slack
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Custom Slack app — fallback for self-hosted / managed install not configured. */}
        {!connected && (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8 gap-1.5 px-0"
              onClick={() => setCustomOpen((o) => !o)}
            >
              <ChevronDown
                className={cn('size-3.5 transition-transform', customOpen && 'rotate-180')}
              />
              <SlidersHorizontal className="size-3.5" />
              Use a custom Slack app instead
            </Button>
            {customOpen && (
              <div className="mt-3">
                <Suspense fallback={<Skeleton className="h-24 w-full rounded-md" />}>
                  <SlackConnectForm projectId={projectId} onConnected={() => install.refetch()} />
                </Suspense>
              </div>
            )}
          </div>
        )}
      </div>
    </StepShell>
  );
}

function SlackGlyph() {
  return (
    <span className="border-border/60 bg-background flex size-12 items-center justify-center rounded-md border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://www.google.com/s2/favicons?domain=slack.com&sz=128"
        alt=""
        width={28}
        height={28}
        className="size-7"
      />
    </span>
  );
}
