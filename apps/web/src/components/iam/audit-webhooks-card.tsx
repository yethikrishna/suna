'use client';

import { useTranslations } from 'next-intl';
// Audit-webhook management on the Settings tab. Lets admins ship every
// audit event to a customer-controlled HTTP endpoint (Splunk, Datadog,
// internal SIEM). The secret is shown EXACTLY ONCE at creation so it can
// be pasted into the receiver's signature-verification code.

import { errorToast, successToast, warningToast } from '@/components/ui/toast';
import {
  WarningIcon as AlertTriangle,
  CheckIcon as Check,
  PlusIcon as Plus,
  PowerIcon,
  TrashIcon as Trash2,
  WebhooksLogoIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { InfoBanner } from '@/components/ui/info-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Loading from '@/components/ui/loading';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/features/layout/section/empty-state';
import { ErrorState } from '@/features/layout/section/error-state';
import {
  AccessList,
  AccessRow,
  CopyRow,
  formatRelative,
  type KebabItem,
} from '@/features/workspace/shared/access';
import {
  createAuditWebhook,
  type CreatedAuditWebhook,
  deleteAuditWebhook,
  type IamAuditWebhook,
  listAuditWebhooks,
  updateAuditWebhook,
} from '@/lib/iam-client';

interface AuditWebhooksCardProps {
  accountId: string;
  canManage: boolean;
}

export function AuditWebhooksCard({ accountId, canManage }: AuditWebhooksCardProps) {
  const tI18nComplete = useTranslations('hardcodedUi.i18nComplete');
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IamAuditWebhook | null>(null);
  // Which row's enable/disable is in flight — the row swaps its kebab for a
  // spinner, so a slow toggle can't be mistaken for a no-op.
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const hooksQuery = useQuery({
    queryKey: ['audit-webhooks', accountId],
    queryFn: () => listAuditWebhooks(accountId),
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateAuditWebhook(accountId, id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-webhooks', accountId] });
    },
    onError: (err: Error) => errorToast(err.message || 'Failed to update webhook'),
    onSettled: () => setTogglingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAuditWebhook(accountId, id),
    onSuccess: () => {
      successToast('Webhook removed');
      queryClient.invalidateQueries({ queryKey: ['audit-webhooks', accountId] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => errorToast(err.message || 'Failed to delete webhook'),
  });

  const hooks = hooksQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-foreground text-sm font-medium">
            {tI18nComplete.raw('textaca091e6408d')}
          </p>
          <p className="text-muted-foreground text-xs">{tI18nComplete.raw('textdb77d22c4be7')}</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            variant="secondary"
            className="shrink-0 gap-1.5"
          >
            <Plus className="size-4 shrink-0" />
            {tI18nComplete.raw('textd58b5d64893b')}
          </Button>
        )}
      </div>

      {hooksQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
        </div>
      )}

      {/* A failed list read used to render exactly like "no webhooks
          configured" — the worst possible lie on the screen where an admin
          checks whether their SIEM delivery still exists. */}
      {!hooksQuery.isLoading && hooksQuery.isError && (
        <ErrorState
          size="sm"
          title={tI18nComplete.raw('text0418b096409c')}
          description={hooksQuery.error instanceof Error ? hooksQuery.error.message : undefined}
          action={
            <Button variant="outline" size="sm" onClick={() => hooksQuery.refetch()}>
              {tI18nComplete.raw('text942087cc2d41')}
            </Button>
          }
        />
      )}

      {!hooksQuery.isLoading && !hooksQuery.isError && hooks.length === 0 && (
        <EmptyState
          icon={WebhooksLogoIcon}
          size="sm"
          title={tI18nComplete.raw('texta1da233dd539')}
          description={tI18nComplete.raw('textc6a5488d6ffc')}
          action={
            canManage ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-3.5 shrink-0" />
                {tI18nComplete.raw('textd58b5d64893b')}
              </Button>
            ) : undefined
          }
        />
      )}

      {!hooksQuery.isLoading && !hooksQuery.isError && hooks.length > 0 && (
        <AccessList>
          {hooks.map((h) => {
            const kebab: KebabItem[] = canManage
              ? [
                  {
                    label: h.enabled ? 'Disable' : 'Enable',
                    icon: <PowerIcon className="size-3.5 shrink-0" />,
                    onSelect: () => {
                      setTogglingId(h.webhook_id);
                      toggleMutation.mutate({ id: h.webhook_id, enabled: !h.enabled });
                    },
                  },
                  {
                    label: 'Delete webhook',
                    icon: <Trash2 className="size-3.5 shrink-0" />,
                    variant: 'destructive',
                    separated: true,
                    onSelect: () => setDeleteTarget(h),
                  },
                ]
              : [];
            return (
              <AccessRow
                key={h.webhook_id}
                leading={<EntityAvatar icon={WebhooksLogoIcon} label={h.name} size="sm" />}
                title={h.name}
                badges={
                  <>
                    <Badge variant={h.enabled ? 'success' : 'muted'} size="sm">
                      {h.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                    {h.action_prefix ? (
                      <Badge
                        variant="outline"
                        size="sm"
                        className="font-mono"
                        title={`Only events with action starting "${h.action_prefix}"`}
                      >
                        {h.action_prefix}
                      </Badge>
                    ) : null}
                  </>
                }
                metaParts={[
                  <code key="url" className="font-mono">
                    {h.url}
                  </code>,
                  `Last delivered ${formatRelative(h.last_delivered_at)}`,
                  ...(h.last_error
                    ? [
                        <span key="error" className="text-kortix-red">
                          {formatRelative(h.last_error_at)}: {h.last_error}
                        </span>,
                      ]
                    : []),
                ]}
                kebab={kebab}
                kebabLabel={`Actions for ${h.name}`}
                pending={togglingId === h.webhook_id}
              />
            );
          })}
        </AccessList>
      )}

      <CreateAuditWebhookDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accountId={accountId}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={tI18nComplete.raw('text60f85e57e4a7')}
        description={
          deleteTarget
            ? `Stop sending audit events to "${deleteTarget.name}"? Existing receivers must be reconfigured if you re-create it.`
            : ''
        }
        confirmLabel={tI18nComplete.raw('text60f85e57e4a7')}
        confirmVariant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.webhook_id);
        }}
      />
    </div>
  );
}

function CreateAuditWebhookDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
}) {
  const tI18nComplete = useTranslations('hardcodedUi.i18nComplete');
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [actionPrefix, setActionPrefix] = useState('');
  const [created, setCreated] = useState<CreatedAuditWebhook | null>(null);

  function close(next: boolean) {
    if (mutation.isPending) return;
    if (!next) {
      // Wipe everything — especially the plaintext secret which we never
      // want to show twice.
      setName('');
      setUrl('');
      setActionPrefix('');
      setCreated(null);
    }
    onOpenChange(next);
  }

  const mutation = useMutation({
    mutationFn: () =>
      createAuditWebhook(accountId, {
        name: name.trim(),
        url: url.trim(),
        action_prefix: actionPrefix.trim() || undefined,
      }),
    onSuccess: (hook) => {
      setCreated(hook);
      queryClient.invalidateQueries({ queryKey: ['audit-webhooks', accountId] });
      // Surface the create-time test delivery so a bad URL is caught now, not
      // after silently dropping real audit events.
      if (hook.test && !hook.test.ok) {
        warningToast(
          `Webhook saved, but the test delivery failed${hook.test.error ? `: ${hook.test.error}` : ''}. Check the URL — events won't arrive until it succeeds.`,
        );
      } else if (hook.test?.ok) {
        successToast('Webhook created — test event delivered successfully.');
      }
    },
    onError: (err: Error) => errorToast(err.message || 'Failed to create webhook'),
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (created || mutation.isPending) return;
    if (!name.trim() || !url.trim()) return;
    mutation.mutate();
  }

  return (
    <Modal open={open} onOpenChange={close}>
      <ModalContent className="lg:max-w-lg">
        <ModalHeader>
          <ModalTitle>{created ? 'Webhook created' : 'New audit webhook'}</ModalTitle>
          <ModalDescription>
            {created
              ? 'Save the signing secret now. You will not see it again — to rotate, delete this webhook and create a new one.'
              : 'Each event is POSTed to the URL with an X-Kortix-Signature header (HMAC-SHA256 of the body using the secret).'}
          </ModalDescription>
        </ModalHeader>

        {created ? (
          <>
            <ModalBody className="space-y-4">
              {/* Test-delivery result — reassures on success, and makes a broken
                  URL impossible to miss (the failure mode that silently drops
                  every real audit event). */}
              {created.test &&
                (created.test.ok ? (
                  <InfoBanner tone="success" icon={Check}>
                    {tI18nComplete.raw('text648e418a5d31')}
                  </InfoBanner>
                ) : (
                  <InfoBanner tone="warning" icon={AlertTriangle}>
                    {tI18nComplete.raw('text0bb4b2553043')}
                    {created.test.error ? `: ${created.test.error}` : ''}
                    {tI18nComplete.raw('text4b85caae9864')}
                  </InfoBanner>
                ))}
              <CopyRow
                label={tI18nComplete.raw('texte7ee22e117a1')}
                value={created.secret}
                successMessage={tI18nComplete.raw('text704aed35a6fe')}
              />
              <CopyRow
                label={tI18nComplete.raw('text007f7ef38606')}
                value={created.url}
                successMessage={tI18nComplete.raw('text0017bda47853')}
              />
            </ModalBody>
            <ModalFooter>
              <Button size="sm" onClick={() => close(false)} className="gap-1.5">
                <Check className="size-3.5 shrink-0" />
                {tI18nComplete.raw('text11a6767d5674')}
              </Button>
            </ModalFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <ModalBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hook-name">{tI18nComplete.raw('textdcd1d5223f73')}</Label>
                <Input
                  id="hook-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tI18nComplete.raw('text13c1e155f999')}
                  maxLength={128}
                  autoFocus
                  required
                  disabled={mutation.isPending}
                  variant="popover"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hook-url">{tI18nComplete.raw('text007f7ef38606')}</Label>
                <Input
                  id="hook-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://siem.corp.example/kortix/audit"
                  type="url"
                  required
                  disabled={mutation.isPending}
                  variant="popover"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hook-prefix">
                  {tI18nComplete.raw('text50d256f3de2b')}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
                    {tI18nComplete.raw('text0059798b7f70')}
                  </span>
                </Label>
                <Input
                  id="hook-prefix"
                  value={actionPrefix}
                  onChange={(e) => setActionPrefix(e.target.value)}
                  placeholder="iam."
                  maxLength={128}
                  disabled={mutation.isPending}
                  variant="popover"
                />
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { label: 'All events', prefix: '' },
                      { label: 'IAM only', prefix: 'iam.' },
                      { label: 'Auth lifecycle', prefix: 'auth.' },
                      { label: 'Failed logins', prefix: 'auth.login.fail' },
                      { label: 'Policies only', prefix: 'iam.policy' },
                      { label: 'Super-admin grants', prefix: 'iam.member.super_admin' },
                      { label: 'Approvals', prefix: 'iam.approval' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setActionPrefix(preset.prefix)}
                      // `Badge` is pointer-events-none by design (a status
                      // chip, not a control) and has no interactive variant,
                      // so the chips stay buttons — but the selected fill is
                      // the system's selected-row token, not a one-off.
                      className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                        actionPrefix === preset.prefix
                          ? 'border-primary bg-primary/[0.08] text-foreground'
                          : 'border-border/60 text-muted-foreground hover:bg-muted/40'
                      }`}
                      disabled={mutation.isPending}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  {tI18nComplete.raw('text87be07b553e8')}
                </p>
              </div>
            </ModalBody>
            <ModalFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline-ghost"
                size="sm"
                onClick={() => close(false)}
                disabled={mutation.isPending}
              >
                {tI18nComplete.raw('text19766ed6ccb2')}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!name.trim() || !url.trim() || mutation.isPending}
                className="gap-1.5"
              >
                {mutation.isPending && <Loading className="size-3.5 shrink-0" />}
                {tI18nComplete.raw('text4a2b33ad2c1f')}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
