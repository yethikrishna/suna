'use client';

/**
 * The generic manifest-migration action — a session-backed button usable from
 * any Customize surface (Settings' project-level card here; the Agents
 * section's own hint owns its own placement). Self-contained: reads the SERVER's
 * manifest verdict (reusing the shared `project-detail` query key) and hides
 * itself unless the server both offers a migration and names its target
 * version. The label carries that target version, so it can never advertise a
 * destination the platform is not taking you to.
 */

import type { ButtonProps } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { ArrowUpCircle } from 'lucide-react';

import { useProjectManifestUpgrade } from './manifest-version';
import { useMigrateToV2 } from './use-migrate-to-v2';

/** Presentational only — no hooks, no data fetching. Kept separate from
 *  `MigrateToV2Button` so the click behavior is testable without mocking
 *  react-query or the SDK. */
export function MigrateToV2ButtonView({
  migrationOffered,
  targetVersion,
  pending,
  onClick,
  size = 'sm',
  variant = 'secondary',
  className,
}: {
  /** The server's verdict — this component never derives it. */
  migrationOffered: boolean;
  /** Version the migration produces. Nothing renders without it. */
  targetVersion: number | null;
  pending: boolean;
  onClick: () => void;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
}) {
  if (!migrationOffered || targetVersion === null) return null;
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={pending}
      onClick={onClick}
    >
      {pending ? (
        <Loading className="size-3.5 shrink-0" />
      ) : (
        <ArrowUpCircle className="size-3.5 shrink-0" />
      )}
      Migrate to v{targetVersion}
    </Button>
  );
}

export function MigrateToV2Button({
  projectId,
  size,
  variant,
  className,
}: {
  projectId: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
}) {
  const upgrade = useProjectManifestUpgrade(projectId);
  const migrate = useMigrateToV2(projectId);

  return (
    <MigrateToV2ButtonView
      migrationOffered={!upgrade.isLoading && upgrade.migrationOffered}
      targetVersion={upgrade.targetVersion}
      pending={migrate.pending}
      onClick={migrate.start}
      size={size}
      variant={variant}
      className={className}
    />
  );
}
