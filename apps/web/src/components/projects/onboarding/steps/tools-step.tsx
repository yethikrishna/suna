'use client';

/**
 * Step 4 — connect the apps the team already lives in.
 *
 * Real Pipedream OAuth, inline. The whole step is skipped by the shell when
 * `isConnectorsEnabled()` is false (self-host without PIPEDREAM_*), so this
 * component never has to render a dead 501 — but it still handles the case
 * where the catalogue call itself returns one.
 */

import { PlusIcon as Plus, MagnifyingGlassIcon as Search } from '@phosphor-icons/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { FadedScrollArea } from '@/components/ui/faded-scroll-area';
import { InfoBanner } from '@/components/ui/info-banner';
import { Input } from '@/components/ui/input';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import {
  proposeConnectorProfileSlug,
  type EasyConnectApp,
} from '@/features/workspace/customize/sections/connector-profile-form';
import { ConnectorProfileModal } from '@/features/workspace/customize/sections/connector-profile-modal';
import { useToolConnect } from '@/hooks/connectors/use-tool-connect';
import { listPipedreamApps } from '@kortix/sdk';

import { ChoiceRow, StepShell } from '../step-shell';

/** Slack has its own dedicated step, so keep it out of this list. */
const SLACK_SLUGS = new Set(['slack', 'slack_v2']);

export function ToolsStep({
  projectId,
  existingSlugs,
  onConnected,
  onContinue,
  onSkip,
}: {
  projectId: string;
  existingSlugs: readonly string[];
  onConnected: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [q, setQ] = useState('');
  const [selectedApp, setSelectedApp] = useState<EasyConnectApp | null>(null);
  const connect = useToolConnect(projectId, onConnected);

  const appsQuery = useInfiniteQuery({
    queryKey: ['onboarding-tools', projectId, q],
    queryFn: ({ pageParam }) =>
      listPipedreamApps(projectId, q || undefined, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    staleTime: 60_000,
  });

  const apps = (appsQuery.data?.pages ?? [])
    .flatMap((p) => p.apps)
    .filter((a) => !SLACK_SLUGS.has(a.slug));
  const notConfigured =
    appsQuery.isError && /501|not configured/i.test((appsQuery.error as Error)?.message ?? '');
  const profileCount = existingSlugs.length;

  return (
    <StepShell
      title="Connect your tools"
      description="Pick the apps you live in and authorize them right here. Your agent can read, write, and act across everything you connect."
      primaryLabel="Continue"
      onPrimary={onContinue}
      skipLabel="Skip"
      onSkip={onSkip}
    >
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 3,000+ apps…"
            className="h-10 pl-9"
          />
        </div>

        {notConfigured ? (
          <InfoBanner tone="neutral" title="App connect isn’t configured on this deployment">
            You can still continue and connect tools later from Connectors.
          </InfoBanner>
        ) : (
          // Bounded by the column, not the viewport: a vh-relative height made
          // this step the tallest thing in the flow on large screens. The fade
          // tells you there is more without adding a scrollbar to look at.
          <FadedScrollArea
            fadeColor="from-background"
            className="max-h-[320px] overflow-y-auto pr-1"
          >
            {appsQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[58px] w-full rounded-md" />
                ))}
              </div>
            ) : apps.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-xs">
                {q ? `Nothing matches “${q}”.` : 'Try a search.'}
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {apps.map((app) => (
                    <ChoiceRow
                      key={app.slug}
                      selected={existingSlugs.includes(app.slug)}
                      label={app.name}
                      description={app.categories?.[0]}
                      aria-label={`Add ${app.name} profile`}
                      disabled={connect.isPending}
                      onSelect={() => setSelectedApp(app)}
                      leading={
                        app.imgSrc ? (
                          <Image
                            src={app.imgSrc}
                            alt=""
                            width={28}
                            height={28}
                            unoptimized
                            referrerPolicy="no-referrer"
                            className="size-7 shrink-0 rounded-sm object-contain"
                          />
                        ) : (
                          <EntityAvatar icon={Plus} size="sm" label={app.name} />
                        )
                      }
                      trailing={
                        connect.isPending && connect.variables?.appSlug === app.slug ? (
                          <Loading className="size-4 shrink-0" />
                        ) : (
                          <Plus className="text-muted-foreground/50 size-4" />
                        )
                      }
                    />
                  ))}
                </div>
                {appsQuery.hasNextPage && (
                  <div className="flex justify-center pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => appsQuery.fetchNextPage()}
                      disabled={appsQuery.isFetchingNextPage}
                    >
                      {appsQuery.isFetchingNextPage ? (
                        <Loading className="size-3.5 shrink-0" />
                      ) : null}
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </FadedScrollArea>
        )}

        <p className="text-muted-foreground text-xs">
          {profileCount > 0
            ? `${profileCount} ${profileCount === 1 ? 'profile' : 'profiles'} added — add as many as you like, then continue.`
            : 'Connect a few now, or skip and add them anytime.'}
        </p>
      </div>

      <ConnectorProfileModal
        open={selectedApp !== null}
        idPrefix="onboarding-tool-profile"
        title={`Add ${selectedApp?.name ?? 'app'}`}
        description="Create a connector profile before authorization. You can add more than one profile for the same app."
        initialName={selectedApp?.name ?? ''}
        initialSlug={selectedApp ? proposeConnectorProfileSlug(selectedApp.slug, existingSlugs) : ''}
        existingSlugs={existingSlugs}
        pending={connect.isPending}
        onOpenChange={(open) => !open && setSelectedApp(null)}
        onSubmit={(profile) => {
          if (!selectedApp) return;
          connect.mutate(
            {
              appSlug: selectedApp.slug,
              appName: selectedApp.name,
              profileName: profile.name,
              profileSlug: profile.slug,
              authorizationStrategy: profile.authorizationStrategy,
            },
            { onSuccess: () => setSelectedApp(null) },
          );
        }}
      />
    </StepShell>
  );
}
