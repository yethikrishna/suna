'use client';

/**
 * Connect the apps the team already lives in.
 *
 * A search box over a uniform card grid — the shape Attio and Postman both use
 * for an integration catalogue, and the one that survives 3,000 entries. The
 * whole step is skipped by the shell when `isConnectorsEnabled()` is false
 * (self-host without PIPEDREAM_*), so it never has to render a dead 501; it
 * still handles the catalogue call itself returning one.
 */

import { PlusIcon as Plus, MagnifyingGlassIcon as Search } from '@phosphor-icons/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FadedScrollArea } from '@/components/ui/faded-scroll-area';
import { InfoBanner } from '@/components/ui/info-banner';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import {
  proposeConnectorProfileSlug,
  type EasyConnectApp,
} from '@/features/workspace/customize/sections/connector-profile-form';
import { ConnectorProfileModal } from '@/features/workspace/customize/sections/connector-profile-modal';
import { useToolConnect } from '@/hooks/connectors/use-tool-connect';
import { listPipedreamApps } from '@kortix/sdk';

import { OptionCard, OptionGrid, StepShell } from '../step-shell';

/** Slack has its own dedicated step, so keep it out of this catalogue. */
const SLACK_SLUGS = new Set(['slack', 'slack_v2']);

export function ToolsStep({
  stepLabel,
  projectId,
  existingSlugs,
  onConnected,
  onContinue,
  onSkip,
}: {
  stepLabel: string;
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
      stepLabel={stepLabel}
      title="Connect your tools"
      description="Your agent can read, write, and act across everything you connect."
      primaryLabel="Continue"
      onPrimary={onContinue}
      secondaryLabel="Skip"
      onSecondary={onSkip}
    >
      <div className="space-y-4">
        <InputGroup className="h-11 max-w-[340px]">
          <InputGroupAddon>
            <Search className="text-muted-foreground size-4" />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 3,000+ apps…"
            aria-label="Search apps"
          />
        </InputGroup>

        {notConfigured ? (
          <InfoBanner tone="neutral" title="App connect isn’t configured on this deployment">
            You can still continue and connect tools later from Connectors.
          </InfoBanner>
        ) : (
          // Bounded by the rail, not the viewport. The fade says there is more
          // without putting a scrollbar on screen.
          <FadedScrollArea fadeColor="from-background" className="max-h-[296px] overflow-y-auto pr-1">
            {appsQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[52px] w-full rounded-md" />
                ))}
              </div>
            ) : apps.length === 0 ? (
              <p className="text-muted-foreground py-8 text-xs">
                {q ? `Nothing matches “${q}”.` : 'Search for the apps your team uses.'}
              </p>
            ) : (
              <>
                <OptionGrid label="Apps">
                  {apps.map((app) => (
                    <OptionCard
                      key={app.slug}
                      selected={existingSlugs.includes(app.slug)}
                      label={app.name}
                      aria-label={`Add ${app.name} profile`}
                      disabled={connect.isPending}
                      onSelect={() => setSelectedApp(app)}
                      icon={
                        app.imgSrc ? (
                          <Image
                            src={app.imgSrc}
                            alt=""
                            width={20}
                            height={20}
                            unoptimized
                            referrerPolicy="no-referrer"
                            className="size-5 shrink-0 rounded-sm object-contain"
                          />
                        ) : (
                          <Plus className="text-muted-foreground size-4" />
                        )
                      }
                      trailing={
                        connect.isPending && connect.variables?.appSlug === app.slug ? (
                          <Loading className="size-4 shrink-0" />
                        ) : undefined
                      }
                    />
                  ))}
                </OptionGrid>
                {appsQuery.hasNextPage && (
                  <div className="pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => appsQuery.fetchNextPage()}
                      disabled={appsQuery.isFetchingNextPage}
                    >
                      {appsQuery.isFetchingNextPage ? <Loading className="size-3.5 shrink-0" /> : null}
                      Load more
                    </Button>
                  </div>
                )}
              </>
            )}
          </FadedScrollArea>
        )}

        {profileCount > 0 && (
          <p className="text-muted-foreground text-xs">
            {profileCount} {profileCount === 1 ? 'profile' : 'profiles'} added.
          </p>
        )}
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
