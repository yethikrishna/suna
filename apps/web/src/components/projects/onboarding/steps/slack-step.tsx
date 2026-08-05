'use client';

/**
 * Install Kortix into Slack.
 *
 * This step used to be three unrelated things — a bordered card, a button
 * inside it, and a disclosure beneath — so it looked nothing like the rest of
 * the flow. It is now two `ChoiceRow`s, the same primitive every other step
 * uses. Once connected, both collapse into a single confirmed row.
 *
 * The install itself is unchanged: open the OAuth popup, poll, detect.
 */

import {
  CheckIcon as Check,
  SlidersHorizontalIcon as Sliders,
  LightningIcon as Lightning,
} from '@phosphor-icons/react';
import { Suspense, lazy, useEffect, useState } from 'react';

import { InfoBanner } from '@/components/ui/info-banner';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { useSlackInstall, useSlackMode } from '@/hooks/channels/use-channels-installations';

import { ChoiceRow, StepShell } from '../step-shell';

/** Lazy — keeps the giant connectors-view module out of the project bundle. */
const SlackConnectForm = lazy(() =>
  import('@/features/workspace/customize/sections/connectors-view').then((m) => ({
    default: m.SlackConnectForm,
  })),
);

type SlackChoice = 'managed' | 'custom';

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
  const [choice, setChoice] = useState<SlackChoice | null>(null);
  const [pollRequested, setPollRequested] = useState(false);

  const installUrl = mode.data?.oauth_available ? mode.data.install_url : null;
  const connected = !!install.data;

  // Derived, not stored — so the poll stops the instant the install lands
  // rather than a render later.
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
            selected={choice === 'managed'}
            label={waiting ? 'Waiting for approval in Slack…' : 'Add to Slack'}
            description={
              waiting
                ? 'We’ll detect it automatically — no need to come back here'
                : 'One click, nothing to configure'
            }
            disabled={mode.isLoading || !installUrl}
            onSelect={() => {
              setChoice('managed');
              openInstall();
            }}
            leading={
              waiting ? (
                <Loading className="size-4 shrink-0" />
              ) : (
                <Lightning className="text-muted-foreground size-4 shrink-0" />
              )
            }
          />
          <ChoiceRow
            selected={choice === 'custom'}
            label="Use a custom Slack app"
            description="For self-hosted workspaces, or when managed install is unavailable"
            onSelect={() => setChoice(choice === 'custom' ? null : 'custom')}
            leading={<Sliders className="text-muted-foreground size-4 shrink-0" />}
          />

          {choice === 'custom' && (
            <div className="pt-2">
              <Suspense fallback={<Skeleton className="h-24 w-full rounded-md" />}>
                <SlackConnectForm projectId={projectId} onConnected={() => install.refetch()} />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}
