'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { MaintenanceLevel } from '@/lib/maintenance-store';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n/use-translations';
import { localizedMaintenanceLevels } from './constants';

interface MaintenanceLevelCardProps {
  level: MaintenanceLevel;
  isSelected: boolean;
  onClick: () => void;
}

export function MaintenanceLevelCard({ level, isSelected, onClick }: MaintenanceLevelCardProps) {
  const tI18nComplete = useTranslations('hardcodedUi.i18nComplete');
  const config = localizedMaintenanceLevels(tI18nComplete).find((l) => l.value === level)!;
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        'cursor-pointer p-4 transition-all',
        isSelected
          ? `border-2 ${config.borderColor} ${config.bgColor}`
          : 'hover:border-primary/50 border',
      )}
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-2xl border',
              isSelected ? `${config.bgColor} ${config.borderColor}` : 'bg-muted border-border',
            )}
          >
            <Icon className={cn('h-5 w-5', isSelected ? config.color : 'text-muted-foreground')} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{config.label}</span>
              {isSelected && (
                <Badge
                  className={cn(
                    'px-1.5 py-0 text-xs',
                    config.bgColor,
                    config.color,
                    config.borderColor,
                  )}
                >
                  {tI18nComplete.raw('text92340695899b')}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">{config.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
