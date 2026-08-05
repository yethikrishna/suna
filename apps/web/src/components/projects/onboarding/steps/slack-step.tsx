'use client';

/**
 * Install Kortix into Slack.
 *
 * Two cards, and the custom-app route opens a view of its own on the same rail
 * rather than a side panel or an inline expansion. Earlier attempts squeezed
 * the manifest form beside the chooser or underneath it; both fought the rail's
 * single width. A dedicated view gets the full width, keeps one alignment
 * rule, and does not inflate the step count — the counter still reads Slack.
 *
 * The install itself is unchanged: open the OAuth popup, poll, detect.
 */

import {
  ArrowLeftIcon as ArrowLeft,
  CheckIcon as Check,
  LightningIcon as Lightning,
  SlidersHorizontalIcon as Sliders,
} from '@phosphor-icons/react';
import { Suspense, lazy, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { InfoBanner } from '@/components/ui/info-banner';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { useSlackInstall, useSlackMode } from '@/hooks/channels/use-channels-installations';

import { OptionCard, OptionGrid, StepShell } from '../step-shell';

const importConnectorsView = () => import('@/features/workspace/customize/sections/connectors-view');

const SlackConnectForm = lazy(() =>
  importConnectorsView().then((m) => ({ default: m.SlackConnectForm })),
);

/**
 * Fetch the chunk on hover, before the click. Left alone, `lazy()` downloads
 * and parses a large form at the moment the view swaps, which drops frames for
 * reasons that have nothing to do with the transition. Idempotent — the module
 * registry dedupes.
 */
const preloadConnectorsView = () => {
  void importConnectorsView();
};

export function SlackStep({
  stepLabel,
  projectId,
  onContinue,
  onSkip,
}: {
  stepLabel: string;
  projectId: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const mode = useSlackMode(projectId);
  const install = useSlackInstall(projectId);
  const [customRequested, setCustomRequested] = useState(false);
  const [pollRequested, setPollRequested] = useState(false);

  const installUrl = mode.data?.oauth_available ? mode.data.install_url : null;
  const connected = !!install.data;

  // Both derived, not reset from effects: a landed install closes the custom
  // view and stops the poll without cascading a render to say so.
  const showCustom = customRequested && !connected;
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

  if (showCustom) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ml-2 mb-5 h-8 gap-1.5 px-2"
          onClick={() => setCustomRequested(false)}
        >
          <ArrowLeft className="size-3.5" />
          Back to install options
        </Button>
        <StepShell
          stepLabel={stepLabel}
          title="Bring your own Slack app"
          description="Point Kortix at a Slack app you control. You'll need its signing secret and bot token."
          primaryLabel="Continue"
          primaryDisabled={!connected}
          onPrimary={onContinue}
        >
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-md" />}>
            <SlackConnectForm projectId={projectId} onConnected={() => install.refetch()} />
          </Suspense>
        </StepShell>
      </div>
    );
  }

  return (
    <StepShell
      stepLabel={stepLabel}
      title="Add Kortix to Slack"
      description="This is where most teams actually use Kortix — @mention your agent, kick off tasks, get results in the channel."
      primaryLabel="Continue"
      primaryDisabled={!connected}
      onPrimary={onContinue}
      secondaryLabel={connected ? undefined : 'Skip'}
      onSecondary={connected ? undefined : onSkip}
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
        <OptionGrid label="Slack install method">
          <OptionCard
            selected={false}
            label={waiting ? 'Waiting for approval…' : 'Add to Slack'}
            description={
              waiting ? 'We’ll detect it automatically' : 'One click, nothing to configure'
            }
            disabled={mode.isLoading || !installUrl}
            onSelect={openInstall}
            icon={
              waiting ? (
                <Loading className="size-4 shrink-0" />
              ) : (
                <Lightning className="text-muted-foreground size-4" />
              )
            }
          />
          <OptionCard
            selected={false}
            label="Use a custom Slack app"
            description="For self-hosted workspaces"
            onSelect={() => setCustomRequested(true)}
            onPreload={preloadConnectorsView}
            icon={<Sliders className="text-muted-foreground size-4" />}
          />
        </OptionGrid>
      )}
    </StepShell>
  );
}
