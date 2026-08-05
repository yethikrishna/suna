'use client';

/**
 * Install Kortix into Slack.
 *
 * Two panes, not one screen with a disclosure. Choosing "Use a custom Slack
 * app" is a move *into* a sub-view, so it animates like one: the chooser
 * translates out to the left and the form arrives from the right, the same
 * grammar the wizard uses between steps. Expanding a form inline underneath a
 * row said "this is more of the same list", which it is not — it is a different
 * task with its own title and its own way back.
 *
 * The install itself is unchanged: open the OAuth popup, poll, detect.
 */

import {
  ArrowLeftIcon as ArrowLeft,
  CheckIcon as Check,
  SlidersHorizontalIcon as Sliders,
  LightningIcon as Lightning,
} from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { InfoBanner } from '@/components/ui/info-banner';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { useSlackInstall, useSlackMode } from '@/hooks/channels/use-channels-installations';

import { slideVariants } from '../motion';
import { ChoiceRow, StepShell } from '../step-shell';

/** Lazy — keeps the giant connectors-view module out of the project bundle. */
const SlackConnectForm = lazy(() =>
  import('@/features/workspace/customize/sections/connectors-view').then((m) => ({
    default: m.SlackConnectForm,
  })),
);

type Pane = 'choose' | 'custom';

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
  const [requestedPane, setPane] = useState<Pane>('choose');
  const [pollRequested, setPollRequested] = useState(false);

  const reduced = useReducedMotion() ?? false;
  const paneVariants = useMemo(() => slideVariants(reduced), [reduced]);

  const installUrl = mode.data?.oauth_available ? mode.data.install_url : null;
  const connected = !!install.data;

  // A landed install makes the sub-view moot, so the chooser wins. Derived
  // rather than reset from an effect: an effect would cascade a render to say
  // something React can just compute.
  const pane: Pane = connected ? 'choose' : requestedPane;

  // Derived, not stored — the poll stops the instant the install lands rather
  // than a render later.
  const waiting = pollRequested && !connected;

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
    <AnimatePresence mode="popLayout" custom={pane === 'custom' ? 1 : -1} initial={false}>
      <motion.div
        key={pane}
        custom={pane === 'custom' ? 1 : -1}
        variants={paneVariants}
        initial="enter"
        animate="center"
        exit="exit"
      >
        {pane === 'custom' ? (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2 mb-4 h-8 gap-1.5 px-2"
              onClick={() => setPane('choose')}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            <StepShell
              title="Bring your own Slack app"
              description="Point Kortix at a Slack app you control. You'll need its signing secret and bot token."
              primaryLabel="Continue"
              primaryDisabled={!connected}
              onPrimary={onContinue}
            >
              <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
                <SlackConnectForm projectId={projectId} onConnected={() => install.refetch()} />
              </Suspense>
            </StepShell>
          </div>
        ) : (
          <StepShell
            title="Add Kortix to Slack"
            description="This is where most teams actually use Kortix — @mention your agent, kick off tasks, get results in the channel."
            primaryLabel="Continue"
            primaryDisabled={!connected}
            onPrimary={onContinue}
            skipLabel={connected ? undefined : 'Skip'}
            onSkip={connected ? undefined : onSkip}
          >
            {connected ? (
              <InfoBanner tone="success" icon={Check} title="Connected to Slack">
                Installed to{' '}
                <span className="font-medium">
                  {install.data?.workspaceName || install.data?.workspaceId}
                </span>
                . You can @mention your agent in any channel it&apos;s invited to.
              </InfoBanner>
            ) : (
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="Slack install method"
              >
                <ChoiceRow
                  selected={false}
                  label={waiting ? 'Waiting for approval in Slack…' : 'Add to Slack'}
                  description={
                    waiting
                      ? 'We’ll detect it automatically — no need to come back here'
                      : 'One click, nothing to configure'
                  }
                  disabled={mode.isLoading || !installUrl}
                  onSelect={openInstall}
                  leading={
                    waiting ? (
                      <Loading className="size-4 shrink-0" />
                    ) : (
                      <Lightning className="text-muted-foreground size-4 shrink-0" />
                    )
                  }
                />
                <ChoiceRow
                  selected={false}
                  label="Use a custom Slack app"
                  description="For self-hosted workspaces, or when managed install is unavailable"
                  onSelect={() => setPane('custom')}
                  leading={<Sliders className="text-muted-foreground size-4 shrink-0" />}
                />
              </div>
            )}
          </StepShell>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
