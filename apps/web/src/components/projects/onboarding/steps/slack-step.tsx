'use client';

/**
 * Install Kortix into Slack.
 *
 * Opening "Use a custom Slack app" does not replace the step — it widens it.
 * The chooser slides left and the manifest panel arrives beside it, so the
 * user can still see what they came from while they work through the setup.
 * That is the right shape because the two are one task: you are still adding
 * Kortix to Slack, just by a longer route.
 *
 * The shift is a Motion `layout` animation, so the movement is FLIP-derived
 * transforms rather than an animated width — no layout thrash per frame. Below
 * `xl` there is no room for two panes, so the panel stacks underneath instead
 * and the same fade carries it in.
 *
 * The install itself is unchanged: open the OAuth popup, poll, detect.
 */

import {
  CheckIcon as Check,
  SlidersHorizontalIcon as Sliders,
  LightningIcon as Lightning,
  XIcon as X,
} from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Suspense, lazy, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { InfoBanner } from '@/components/ui/info-banner';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { useSlackInstall, useSlackMode } from '@/hooks/channels/use-channels-installations';

import { ENTER_TRANSITION, EXIT_TRANSITION } from '../motion';
import { ChoiceRow, StepShell } from '../step-shell';

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
  const [customRequested, setCustomRequested] = useState(false);
  const [pollRequested, setPollRequested] = useState(false);

  const reduced = useReducedMotion() ?? false;

  const installUrl = mode.data?.oauth_available ? mode.data.install_url : null;
  const connected = !!install.data;

  // Both derived rather than reset from effects: a landed install closes the
  // panel and stops the poll without cascading a render to say so.
  const customOpen = customRequested && !connected;
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
    <div className="flex flex-col items-center gap-6 xl:flex-row xl:items-start xl:justify-center">
      <motion.div layout={!reduced} transition={ENTER_TRANSITION} className="w-full max-w-[560px] shrink-0">
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
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Slack install method">
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
                selected={customOpen}
                label="Use a custom Slack app"
                description="For self-hosted workspaces, or when managed install is unavailable"
                onSelect={() => setCustomRequested((o) => !o)}
                leading={<Sliders className="text-muted-foreground size-4 shrink-0" />}
              />
            </div>
          )}
        </StepShell>
      </motion.div>

      <AnimatePresence initial={false}>
        {customOpen && (
          <motion.aside
            key="custom-slack"
            // Arrives from the right, the direction it is opening toward.
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0, transition: ENTER_TRANSITION }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -16, transition: EXIT_TRANSITION }}
            className="border-border/60 bg-popover w-full max-w-[560px] shrink-0 rounded-md border p-4 xl:w-[420px] xl:max-w-none"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-foreground text-sm font-medium">Bring your own Slack app</h2>
                <p className="text-muted-foreground text-xs leading-5">
                  For self-hosted setups or workspace-scoped installs.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close custom Slack app setup"
                className="text-muted-foreground shrink-0"
                onClick={() => setCustomRequested(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
              <SlackConnectForm projectId={projectId} onConnected={() => install.refetch()} />
            </Suspense>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
