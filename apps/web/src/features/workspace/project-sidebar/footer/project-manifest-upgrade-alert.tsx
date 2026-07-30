'use client';

/**
 * ProjectManifestUpgradeAlert — the left-sidebar nudge for a project whose
 * manifest has an upgrade available. Sits just above Files/Customize and
 * mirrors `ProjectSandboxAlert` exactly (same `Disclosure` shell, same expand
 * -to-explain-then-act shape) — the only differences are the tone (kortix
 * accent, since this is a recommended upgrade rather than a failure) and the
 * action, which is the one-click, end-to-end `useMigrateToV2`: it mints a
 * session seeded with the migration prompt, boots the project's default agent
 * (git/CR powers), and drops the user into the thread where it auto-runs —
 * converting the manifest and opening a change request for review.
 *
 * Visibility is the SERVER's call, never this component's: it renders only when
 * `config.manifest_version.migration_offered` is true AND the server named the
 * target version AND the viewer can act on it (`project.write`). An unknown or
 * unreadable manifest renders nothing — it is not "v1 needing migration". Every
 * version string in the copy comes from the verdict, so the label can never
 * advertise a destination the platform is not actually taking you to.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Disclosure, DisclosureContent, DisclosureTrigger } from '@/components/ui/disclosure';
import Loading from '@/components/ui/loading';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import {
  useMigrateToV2,
  useProjectManifestUpgrade,
} from '@/features/workspace/customize/migrate-to-v2';
import { PROJECT_ACTIONS } from '@/lib/project-actions';
import { useProjectCan } from '@/lib/use-project-can';
import { cn } from '@/lib/utils';
import { ArrowUpCircle } from 'lucide-react';

/** Presentational shell — no data fetching, so every state renders under
 *  renderToStaticMarkup. The network/permission reads live in the wrapper. */
export function ProjectManifestUpgradeAlertView({
  migrationOffered,
  targetVersion,
  currentVersion,
  manifestFilename,
  pending,
  onMigrate,
  defaultOpen = false,
}: {
  /** The server's verdict — this component never derives it. */
  migrationOffered: boolean;
  /** Version the migration produces. Nothing renders without it. */
  targetVersion: number | null;
  /** Version the project is on, when the server could name it. */
  currentVersion: number | null;
  /** Manifest file the server read, when it read one. */
  manifestFilename: string | null;
  pending: boolean;
  onMigrate: () => void;
  /** Seed the disclosure open — only used so the expanded body is renderable
   *  in tests; the real sidebar always starts collapsed. */
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  if (!migrationOffered || targetVersion === null) return null;

  return (
    <SidebarMenuItem>
      <Disclosure
        variant="outline"
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn(
          'w-full overflow-hidden rounded-md border-none text-sm shadow-none',
          isOpen && 'bg-kortix-base/[0.06]',
        )}
      >
        <DisclosureTrigger>
          <SidebarMenuButton className="text-kortix-base px-2.5 text-sm! font-medium [&_svg]:size-3.5!">
            <ArrowUpCircle className="size-4" />
            <span>Upgrade to v{targetVersion}</span>
          </SidebarMenuButton>
        </DisclosureTrigger>
        <DisclosureContent variant="outline">
          <div className="w-full overflow-hidden">
            <div className="px-2 pt-1 pb-3">
              <p className="text-muted-foreground text-xs text-balance">
                This project runs the
                {currentVersion === null ? ' older ' : ` v${currentVersion} `}
                manifest
                {manifestFilename ? (
                  <>
                    {' ('}
                    <span className="font-mono">{manifestFilename}</span>
                    {')'}
                  </>
                ) : null}
                . Migrate to the governance-first v{targetVersion} manifest — an agent converts it,
                refreshes platform-managed skills, and opens a change request for you to review.
              </p>
            </div>
            <div className="border-border flex flex-col gap-2 border-t p-3">
              <Button size="sm" className="w-full" disabled={pending} onClick={onMigrate}>
                {pending ? (
                  <Loading className="text-foreground! size-3.5" />
                ) : (
                  <ArrowUpCircle className="size-3.5" />
                )}
                Migrate to v{targetVersion}
              </Button>
            </div>
          </div>
        </DisclosureContent>
      </Disclosure>
    </SidebarMenuItem>
  );
}

export function ProjectManifestUpgradeAlert({ projectId }: { projectId: string }) {
  const upgrade = useProjectManifestUpgrade(projectId);
  const canWrite = useProjectCan(projectId, PROJECT_ACTIONS.PROJECT_WRITE).allowed === true;
  const migrate = useMigrateToV2(projectId);

  return (
    <ProjectManifestUpgradeAlertView
      migrationOffered={upgrade.migrationOffered && canWrite}
      targetVersion={upgrade.targetVersion}
      currentVersion={upgrade.version}
      manifestFilename={upgrade.manifestFilename}
      pending={migrate.pending}
      onMigrate={migrate.start}
    />
  );
}
