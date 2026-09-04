'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Loading from '@/components/ui/loading';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/i18n/use-translations';
import type { MaintenanceLevel } from '@/lib/maintenance-store';
import { cn } from '@/lib/utils';
import { localizedAvailableServices, localizedMaintenanceLevels } from './constants';
import { DateTimePicker } from './date-time-picker';

interface MaintenanceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: MaintenanceLevel;
  title: string;
  setTitle: (title: string) => void;
  message: string;
  setMessage: (message: string) => void;
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  statusUrl: string;
  setStatusUrl: (url: string) => void;
  services: string[];
  toggleService: (service: string) => void;
  onSave: () => Promise<void>;
  isPending: boolean;
}

export function MaintenanceConfigDialog({
  open,
  onOpenChange,
  level,
  title,
  setTitle,
  message,
  setMessage,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  statusUrl,
  setStatusUrl,
  services,
  toggleService,
  onSave,
  isPending,
}: MaintenanceConfigDialogProps) {
  const tI18nComplete = useTranslations('hardcodedUi.i18nComplete');
  const maintenanceLevels = localizedMaintenanceLevels(tI18nComplete);
  const availableServices = localizedAvailableServices(tI18nComplete);
  const levelConfig = maintenanceLevels.find((l) => l.value === level);
  const Icon = levelConfig?.icon;
  const isNone = level === 'none';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-border/60 border-b px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {Icon && <Icon className={cn('h-5 w-5', levelConfig?.color)} />}
            {tI18nComplete.raw('text6defafa2caa6')} {levelConfig?.label || 'Maintenance'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {isNone
              ? tI18nComplete.raw('textd6fe9b2f67a7')
              : tI18nComplete('text2fe4cbeeab06', {
                  value0: levelConfig?.label?.toLowerCase() ?? '',
                })}
          </DialogDescription>
        </DialogHeader>

        {!isNone && (
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="m-title">{tI18nComplete.raw('text7e8cd2056da7')}</Label>
              <Input
                id="m-title"
                placeholder={levelConfig?.label || 'Maintenance'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-message">{tI18nComplete.raw('text2f77668a9dfb')}</Label>
              <Textarea
                id="m-message"
                placeholder={tI18nComplete.raw('texta269bd2fa5e5')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            {(level === 'warning' || level === 'blocking') && (
              <div className="grid grid-cols-2 gap-3">
                <DateTimePicker
                  label={tI18nComplete.raw('text271189ae389a')}
                  date={startDate}
                  setDate={setStartDate}
                />
                <DateTimePicker
                  label={tI18nComplete.raw('text48bccddd89a9')}
                  date={endDate}
                  setDate={setEndDate}
                />
              </div>
            )}

            {(level === 'critical' || level === 'blocking') && (
              <div className="space-y-2">
                <Label>{tI18nComplete.raw('text0fca4949c2b7')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availableServices.map((service) => {
                    const SvcIcon = service.icon;
                    const isSelected = services.includes(service.label);
                    return (
                      <div
                        key={service.id}
                        onClick={() => toggleService(service.label)}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-2xl border p-2 text-sm transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50',
                        )}
                      >
                        <Checkbox checked={isSelected} />
                        <SvcIcon
                          className={cn(
                            'h-3.5 w-3.5',
                            isSelected ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                        <span>{service.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="m-status-url">{tI18nComplete.raw('text0d52d18febbd')}</Label>
              <Input
                id="m-status-url"
                placeholder="https://status.yourapp.com"
                value={statusUrl}
                onChange={(e) => setStatusUrl(e.target.value)}
              />
            </div>
          </div>
        )}

        {isNone && (
          <div className="px-6 py-5">
            <p className="text-muted-foreground text-sm">{tI18nComplete.raw('textaa1c8a0b1716')}</p>
          </div>
        )}

        <div className="border-border/60 bg-muted/30 flex items-center justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tI18nComplete.raw('text19766ed6ccb2')}
          </Button>
          <Button
            onClick={onSave}
            disabled={isPending || (!isNone && !message)}
            variant={level === 'blocking' || level === 'critical' ? 'destructive' : 'default'}
          >
            {isPending && <Loading className="h-4 w-4" />}
            {isNone ? tI18nComplete.raw('textc325d1658f70') : 'Activate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
