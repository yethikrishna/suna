'use client';

import {
  RobotIcon as Bot,
  ShippingContainerIcon as Container,
  FileCodeIcon as FileCode,
  PackageIcon as Package,
} from '@phosphor-icons/react';
import { useTranslations } from '@/i18n/use-translations';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { SandboxTemplate } from '@kortix/sdk';

/**
 * The sandbox-template override for the next session, as a dropdown on the
 * composer's toolbar. The default entry ("Agent environment") is deliberately
 * first and deliberately not a template: picking it clears the override rather
 * than pinning today's default, so a later change to the agent or project
 * default still applies.
 */
export function SandboxPicker({
  items,
  activeSlug,
  selectedSlug,
  onSelect,
}: {
  items: SandboxTemplate[];
  activeSlug: string;
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const t = useTranslations('projectHome');
  const active = items.find((t) => t.slug === activeSlug) ?? items[0] ?? null;
  if (!active) return null;
  const ActiveIcon = active.is_default ? Container : active.has_image ? Package : FileCode;
  const activeStateTone =
    active.daytona_state === 'active'
      ? 'bg-kortix-green'
      : ['pulling', 'building'].includes(active.daytona_state)
        ? 'bg-kortix-blue'
        : active.daytona_state === 'missing'
          ? 'bg-muted-foreground/40'
          : 'bg-destructive';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('sandbox.label')}
          className="text-muted-foreground hover:text-foreground hover:bg-muted duration-fast inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors"
        >
          <ActiveIcon className="size-3.5 shrink-0" />
          <span className="max-w-[7rem] truncate">
            {selectedSlug ? active.name : t('sandbox.agentEnvironment')}
          </span>
          <span className={cn('size-1.5 shrink-0 rounded-full', activeStateTone)} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>{t('sandbox.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex items-start gap-2" onSelect={() => onSelect(null)}>
          <Bot className="text-muted-foreground mt-0.5 size-4" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t('sandbox.agentEnvironment')}</span>
              {selectedSlug === null && (
                <Badge variant="outline" size="xs">
                  {t('sandbox.selected')}
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground text-xs">
              {t('sandbox.agentEnvironmentDescription')}
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {items.map((tpl) => {
          const Icon = tpl.is_default ? Container : tpl.has_image ? Package : FileCode;
          const subtitle = tpl.is_default
            ? t('sandbox.platformDefault')
            : tpl.has_image
              ? t('sandbox.image', { image: tpl.image ?? '' })
              : t('sandbox.dockerfile', { path: tpl.dockerfile_path ?? '' });
          const stateTone =
            tpl.daytona_state === 'active'
              ? 'text-kortix-green'
              : ['pulling', 'building'].includes(tpl.daytona_state)
                ? 'text-kortix-blue'
                : tpl.daytona_state === 'missing'
                  ? 'text-muted-foreground'
                  : 'text-destructive';
          const stateLabel =
            tpl.daytona_state === 'active'
              ? t('sandbox.ready')
              : ['pulling', 'building'].includes(tpl.daytona_state)
                ? t('sandbox.building')
                : tpl.daytona_state === 'missing'
                  ? t('sandbox.notBuilt')
                  : tpl.daytona_state.replace('_', ' ');
          return (
            <DropdownMenuItem
              key={tpl.template_id ?? `tpl-${tpl.slug}`}
              className="flex items-start gap-2"
              onSelect={() => onSelect(tpl.slug)}
            >
              <Icon className="text-muted-foreground mt-0.5 size-4" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{tpl.name}</span>
                  {tpl.slug === selectedSlug && (
                    <Badge variant="outline" size="xs">
                      {t('sandbox.selected')}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground truncate text-xs">{subtitle}</div>
                <div className={cn('mt-0.5 text-xs capitalize', stateTone)}>{stateLabel}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
