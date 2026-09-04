'use client';

import {
  ArrowsLeftRightIcon as ArrowRightLeft,
  CubeIcon as Boxes,
  DotsThreeIcon as MoreHorizontal,
  ArrowClockwiseIcon as RefreshCw,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@/i18n/use-translations';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { IconInbox } from '@/components/ui/kortix-icons';
import Loading from '@/components/ui/loading';
import { PageSearchBar } from '@/components/ui/page-search-bar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/features/layout/section/empty-state';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  getAdminProviderAnalytics,
  getAdminProviderDistribution,
  getAdminProviderFallback,
  listAdminSandboxes,
  migrateAdminSandboxProvider,
  setAdminProviderDistribution,
  setAdminProviderFallback,
} from '@kortix/sdk';

import { SectionContainer, SectionHeader } from '../_components/section-header';

// ── types ──────────────────────────────────────────────────────────────────
interface Dist {
  allowed: string[];
  default: string;
  weights: Record<string, number>;
}
interface Sbx {
  sandboxId: string;
  sessionId: string;
  accountId: string;
  projectId: string;
  provider: string;
  externalId: string | null;
  status: string;
  lastUsedAt: string | null;
}
interface SbxResp {
  sandboxes: Sbx[];
  byProvider: { provider: string; count: number }[];
}
interface ProviderStat {
  provider: string;
  provisions: number;
  ok: number;
  error: number;
  stopped: number;
  successRate: number | null;
  p50Ms: number;
  p95Ms: number;
  avgMs: number;
  phases: { label: string; avgMs: number }[];
}
interface Analytics {
  days: number;
  totals: {
    provisions: number;
    ok: number;
    error: number;
    stopped: number;
    migrations: number;
    successRate: number | null;
  };
  providers: ProviderStat[];
  latencyByDay: Record<string, any>[];
  volumeByDay: Record<string, any>[];
  migrations: { flow: string; count: number }[];
  recentErrors: {
    provider: string;
    errorClass: string | null;
    error: string | null;
    createdAt: string;
  }[];
}

// ── helpers ─────────────────────────────────────────────────────────────────
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
const colorFor = (i: number) => PALETTE[i % PALETTE.length];
const PHASES = ['row+tokens', 'image', 'provider-create', 'before-active-hook', 'row-active'];
const PHASE_COLORS: Record<string, string> = {
  'row+tokens': 'var(--chart-1)',
  image: 'var(--chart-2)',
  'provider-create': 'var(--chart-3)',
  'before-active-hook': 'var(--chart-4)',
  'row-active': 'var(--muted-foreground)',
};
const statusBadge = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' =>
  s === 'active'
    ? 'default'
    : s === 'error'
      ? 'destructive'
      : s === 'provisioning'
        ? 'secondary'
        : 'outline';
const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
const fmtMs = (ms?: number | null) =>
  ms == null
    ? '—'
    : ms >= 1000
      ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`
      : `${Math.round(ms)}ms`;
const fmtDay = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// flat bordered stat strip that matches the table surface (no raised gray cards)
function StatStrip({
  items,
}: {
  items: {
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    tone?: 'default' | 'success' | 'danger' | 'warning';
  }[];
}) {
  const tone = {
    default: '',
    success: 'text-kortix-green',
    danger: 'text-destructive',
    warning: 'text-kortix-orange',
  };
  return (
    <div className="border-border/60 divide-border grid grid-cols-2 divide-x divide-y overflow-hidden rounded-md border lg:grid-cols-4 lg:divide-y-0">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 p-4">
          <div className="text-muted-foreground/70 truncate text-xs font-medium">{it.label}</div>
          <div
            className={cn(
              'mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums',
              tone[it.tone ?? 'default'],
            )}
          >
            {it.value}
          </div>
          {it.hint != null && (
            <div className="text-muted-foreground mt-0.5 truncate text-xs">{it.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ProvidersPage() {
  const tI18nComplete = useTranslations('hardcodedUi.i18nComplete');
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [days, setDays] = useState(7);

  const distQ = useQuery({
    queryKey: ['admin', 'provider-distribution'],
    queryFn: async () => {
      return getAdminProviderDistribution<Dist>();
    },
  });
  const listQ = useQuery({
    queryKey: ['admin', 'sandboxes'],
    queryFn: async () => {
      return listAdminSandboxes<SbxResp>(300);
    },
    refetchInterval: 10_000,
  });
  const anQ = useQuery({
    queryKey: ['admin', 'provider-analytics', days],
    queryFn: async () => {
      return getAdminProviderAnalytics<Analytics>(days);
    },
    enabled: tab === 'analytics',
    refetchInterval: tab === 'analytics' ? 30_000 : false,
  });

  const [weights, setWeights] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!distQ.data) return;
    const w: Record<string, string> = {};
    for (const p of distQ.data.allowed) w[p] = String(distQ.data.weights[p] ?? 0);
    setWeights(w);
  }, [distQ.data]);

  const saveWeights = useMutation({
    mutationFn: async () => {
      const body: Record<string, number> = {};
      for (const k in weights) body[k] = Number(weights[k]) || 0;
      return setAdminProviderDistribution(body);
    },
    onSuccess: () => {
      toast.success('Distribution saved');
      qc.invalidateQueries({ queryKey: ['admin', 'provider-distribution'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  const [migrating, setMigrating] = useState<Sbx | null>(null);
  const [target, setTarget] = useState('');
  const migrate = useMutation({
    mutationFn: async () => {
      return migrateAdminSandboxProvider(migrating!.sessionId, target);
    },
    onSuccess: () => {
      toast.success(`Migrating to ${target}…`);
      setMigrating(null);
      qc.invalidateQueries({ queryKey: ['admin', 'sandboxes'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Migrate failed'),
  });

  // ── Provider failover (one-shot, on session init) ─────────────────────────
  const fbQ = useQuery({
    queryKey: ['admin', 'provider-fallback'],
    queryFn: async () => {
      return getAdminProviderFallback();
    },
  });
  const [fbEnabled, setFbEnabled] = useState(false);
  useEffect(() => {
    if (fbQ.data) setFbEnabled(!!fbQ.data.enabled);
  }, [fbQ.data]);
  const saveFb = useMutation({
    mutationFn: async () => {
      return setAdminProviderFallback(fbEnabled);
    },
    onSuccess: () => {
      toast.success('Failover saved');
      qc.invalidateQueries({ queryKey: ['admin', 'provider-fallback'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  const dist = distQ.data;
  const allowed = dist?.allowed ?? [];
  const totalW = allowed.reduce((s, p) => s + (Number(weights[p]) || 0), 0);
  const list = listQ.data;
  const targets = migrating ? allowed.filter((p) => p !== migrating.provider) : [];

  const countByProvider = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of list?.byProvider ?? []) m[b.provider] = b.count;
    return m;
  }, [list]);
  const totalSandboxes = useMemo(
    () => (list?.byProvider ?? []).reduce((s, b) => s + b.count, 0),
    [list],
  );

  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = list?.sandboxes ?? [];
    if (!q) return all;
    return all.filter((s) =>
      [s.provider, s.status, s.sessionId, s.accountId, s.externalId ?? ''].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [list, search]);

  // analytics derived chart shapes
  const an = anQ.data;
  const anProviders = an?.providers.map((p) => p.provider) ?? [];
  const chartConfig: ChartConfig = useMemo(() => {
    const c: ChartConfig = {};
    anProviders.forEach((p, i) => {
      c[p] = { label: p[0].toUpperCase() + p.slice(1), color: colorFor(i) };
    });
    return c;
  }, [an]);
  const phaseData = useMemo(
    () =>
      (an?.providers ?? []).map((p) => {
        const row: Record<string, any> = {
          provider: p.provider[0].toUpperCase() + p.provider.slice(1),
        };
        for (const ph of PHASES) row[ph] = p.phases.find((x) => x.label === ph)?.avgMs ?? 0;
        return row;
      }),
    [an],
  );
  const phaseConfig: ChartConfig = useMemo(() => {
    const c: ChartConfig = {};
    for (const ph of PHASES) c[ph] = { label: ph, color: PHASE_COLORS[ph] };
    return c;
  }, []);

  return (
    <SectionContainer>
      <SectionHeader
        icon={Boxes}
        title={tI18nComplete.raw('textb12c7d46c0e8')}
        description={tI18nComplete.raw('textbd3b56d2b2da')}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={listQ.isFetching || anQ.isFetching}
            onClick={() => {
              listQ.refetch();
              if (tab === 'analytics') anQ.refetch();
            }}
            className="gap-1.5"
          >
            {listQ.isFetching || anQ.isFetching ? (
              <Loading className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {tI18nComplete.raw('text0e9161011702')}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="overview">{tI18nComplete.raw('textd4b1ea5708dd')}</TabsTrigger>
          <TabsTrigger value="analytics">{tI18nComplete.raw('text94c116ee118a')}</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          <StatStrip
            items={[
              {
                label: tI18nComplete.raw('text1eaee08882eb'),
                value: totalSandboxes.toLocaleString(),
                hint: tI18nComplete.raw('text4beeedd0d757'),
              },
              ...allowed.map((p) => {
                const pct = totalW > 0 ? Math.round(((Number(weights[p]) || 0) / totalW) * 100) : 0;
                return {
                  label: p,
                  value: (countByProvider[p] ?? 0).toLocaleString(),
                  hint: `${pct}% of new sandboxes`,
                };
              }),
            ]}
          />

          <div className="border-border/60 bg-card space-y-4 rounded-md border p-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight">
                {tI18nComplete.raw('text43a857886565')}
              </h2>
              <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                {tI18nComplete.raw('text9de115cbebbf')}
                {dist ? ` (${dist.default})` : ''}
                {tI18nComplete.raw('text4764560a0013')}
              </p>
            </div>
            {distQ.isLoading ? (
              <Skeleton className="h-24 w-full rounded-md" />
            ) : (
              <>
                <div className="flex flex-wrap gap-4">
                  {allowed.map((p) => {
                    const pct =
                      totalW > 0 ? Math.round(((Number(weights[p]) || 0) / totalW) * 100) : 0;
                    return (
                      <div key={p} className="w-40 space-y-1.5">
                        <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium capitalize">
                          {p}
                          {p === dist?.default && (
                            <Badge variant="outline" size="sm" className="text-xs">
                              {tI18nComplete.raw('text37a8eec1ce19')}
                            </Badge>
                          )}
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={weights[p] ?? ''}
                          onChange={(e) => setWeights({ ...weights, [p]: e.target.value })}
                          className="rounded-md"
                        />
                        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                          <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-muted-foreground text-xs tabular-nums">
                          {pct}
                          {tI18nComplete.raw('text499977bddecf')}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  onClick={() => saveWeights.mutate()}
                  disabled={saveWeights.isPending || !allowed.length}
                  className="gap-1.5"
                >
                  {saveWeights.isPending && <Loading className="h-3.5 w-3.5" />}
                  {tI18nComplete.raw('text85457bd27cfc')}
                </Button>
              </>
            )}
          </div>

          {/* ── Provider failover ──────────────────────────────────────────── */}
          <div className="border-border/60 bg-card space-y-4 rounded-md border p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-tight">
                  {tI18nComplete.raw('text2953b4f72d16')}
                </h2>
                <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                  {tI18nComplete.raw('text5301d96a21d8')}
                </p>
              </div>
              {fbQ.isLoading ? (
                <Skeleton className="h-6 w-10 rounded-full" />
              ) : (
                <Switch
                  checked={fbEnabled}
                  onCheckedChange={setFbEnabled}
                  aria-label={tI18nComplete.raw('text158c8bdea1b0')}
                />
              )}
            </div>
            <Button
              size="sm"
              onClick={() => saveFb.mutate()}
              disabled={saveFb.isPending}
              className="gap-1.5"
            >
              {saveFb.isPending && <Loading className="h-3.5 w-3.5" />}
              {tI18nComplete.raw('text08cfb2899839')}
            </Button>
          </div>

          <PageSearchBar
            value={search}
            onChange={setSearch}
            placeholder={tI18nComplete.raw('text403764ddcb39')}
          />

          {listQ.isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="border-border/60 bg-card rounded-md border">
              <EmptyState
                icon={IconInbox}
                title={
                  search
                    ? tI18nComplete.raw('text72b420082a37')
                    : tI18nComplete.raw('texta670596d72fd')
                }
                description={
                  search
                    ? tI18nComplete.raw('text36b89662c2f6')
                    : tI18nComplete.raw('textd4c2dd15aae0')
                }
                action={
                  search ? (
                    <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                      {tI18nComplete.raw('text3b7ea51793e9')}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div
              className={cn(
                'border-border/60 overflow-hidden rounded-md border transition-opacity',
                listQ.isFetching && 'opacity-70',
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{tI18nComplete.raw('text472590ae974d')}</TableHead>
                    <TableHead>{tI18nComplete.raw('text920e413c7d41')}</TableHead>
                    <TableHead>{tI18nComplete.raw('text6959b4159575')}</TableHead>
                    <TableHead>{tI18nComplete.raw('text7e1b0d5641f2')}</TableHead>
                    <TableHead>{tI18nComplete.raw('text830ec7f812f9')}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => {
                    const canMigrate = allowed.filter((p) => p !== s.provider).length > 0;
                    return (
                      <TableRow key={s.sandboxId}>
                        <TableCell>
                          <Badge variant="outline" size="sm" className="capitalize">
                            {s.provider}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadge(s.status)} size="sm" className="capitalize">
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[280px] min-w-0">
                            <div className="truncate font-mono text-xs">
                              {s.sessionId?.slice(0, 8)}
                            </div>
                            {s.externalId && (
                              <div className="text-muted-foreground truncate font-mono text-xs">
                                {s.externalId.slice(0, 22)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {s.accountId?.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {fmtDate(s.lastUsedAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>
                                {tI18nComplete.raw('textff8059dc6752')}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={!canMigrate}
                                onClick={() => {
                                  setMigrating(s);
                                  setTarget(allowed.find((p) => p !== s.provider) ?? '');
                                }}
                              >
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                {tI18nComplete.raw('text969a25894852')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── ANALYTICS ────────────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">{tI18nComplete.raw('text27342581678a')}</p>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="h-9 w-[130px] rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{tI18nComplete.raw('text3033b37ea234')}</SelectItem>
                <SelectItem value="7">{tI18nComplete.raw('text0603deca4fcb')}</SelectItem>
                <SelectItem value="30">{tI18nComplete.raw('textf8f03fb441b8')}</SelectItem>
                <SelectItem value="90">{tI18nComplete.raw('text9902d7ae89e2')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {anQ.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-72 w-full rounded-md" />
            </div>
          ) : !an || an.totals.provisions === 0 ? (
            <div className="border-border/60 bg-card rounded-md border">
              <EmptyState
                icon={IconInbox}
                title={tI18nComplete.raw('text9c41daf68e2e')}
                description={tI18nComplete.raw('textb9819d569c9a')}
              />
            </div>
          ) : (
            <>
              <StatStrip
                items={[
                  {
                    label: tI18nComplete.raw('text7982ad72bd36'),
                    value: an.totals.provisions.toLocaleString(),
                    hint: `${an.totals.migrations} migrations`,
                  },
                  {
                    label: tI18nComplete.raw('text49da60f8a292'),
                    value: an.totals.successRate == null ? '—' : `${an.totals.successRate}%`,
                    tone:
                      an.totals.successRate != null && an.totals.successRate < 90
                        ? 'warning'
                        : 'success',
                    hint: `${an.totals.ok} ok · ${an.totals.error} err`,
                  },
                  {
                    label: tI18nComplete.raw('textcb702378f315'),
                    value: an.totals.error.toLocaleString(),
                    tone: an.totals.error > 0 ? 'danger' : 'default',
                    hint: an.totals.stopped
                      ? `${an.totals.stopped} stopped`
                      : tI18nComplete.raw('text83d5007187d2'),
                  },
                  {
                    label: tI18nComplete.raw('text996c32b35f21'),
                    value: an.providers.length,
                    hint: anProviders.join(' · ') || '—',
                  },
                ]}
              />

              {/* per-provider summary table */}
              <div className="border-border/60 overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{tI18nComplete.raw('text472590ae974d')}</TableHead>
                      <TableHead className="text-right">
                        {tI18nComplete.raw('text7982ad72bd36')}
                      </TableHead>
                      <TableHead className="text-right">
                        {tI18nComplete.raw('textc88a0b907419')}
                      </TableHead>
                      <TableHead className="text-right">
                        {tI18nComplete.raw('text875636a511da')}
                      </TableHead>
                      <TableHead className="text-right">
                        {tI18nComplete.raw('textf771f4d32eee')}
                      </TableHead>
                      <TableHead className="text-right">
                        {tI18nComplete.raw('textcb702378f315')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {an.providers.map((p, i) => (
                      <TableRow key={p.provider}>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: colorFor(i) }}
                            />
                            <span className="font-medium capitalize">{p.provider}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.provisions}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            p.successRate != null && p.successRate < 90 && 'text-kortix-orange',
                          )}
                        >
                          {p.successRate == null ? '—' : `${p.successRate}%`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMs(p.p50Ms)}</TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {fmtMs(p.p95Ms)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            p.error > 0 && 'text-destructive',
                          )}
                        >
                          {p.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* latency over time */}
                <div className="border-border/60 bg-card space-y-3 rounded-md border p-5">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">
                      {tI18nComplete.raw('textbdc837a7b2e4')}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {tI18nComplete.raw('textf1ef9e0be888')}
                    </p>
                  </div>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <AreaChart
                      accessibilityLayer
                      data={an.latencyByDay}
                      margin={{ left: 4, right: 8 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={fmtDay}
                        minTickGap={24}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={42}
                        tickFormatter={(v) => fmtMs(v)}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent labelFormatter={(l) => fmtDay(String(l))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      {anProviders.map((p) => (
                        <Area
                          key={p}
                          type="monotone"
                          dataKey={p}
                          stroke={`var(--color-${p})`}
                          fill={`var(--color-${p})`}
                          fillOpacity={0.12}
                          strokeWidth={2}
                          connectNulls
                          dot={false}
                        />
                      ))}
                    </AreaChart>
                  </ChartContainer>
                </div>

                {/* volume per day */}
                <div className="border-border/60 bg-card space-y-3 rounded-md border p-5">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">
                      {tI18nComplete.raw('text34842398fd2d')}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {tI18nComplete.raw('textfd7e911ee733')}
                    </p>
                  </div>
                  <ChartContainer config={chartConfig} className="h-[260px] w-full">
                    <BarChart
                      accessibilityLayer
                      data={an.volumeByDay}
                      margin={{ left: 4, right: 8 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={fmtDay}
                        minTickGap={24}
                      />
                      <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                      <ChartTooltip
                        content={<ChartTooltipContent labelFormatter={(l) => fmtDay(String(l))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      {anProviders.map((p) => (
                        <Bar
                          key={p}
                          dataKey={p}
                          stackId="v"
                          fill={`var(--color-${p})`}
                          radius={2}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>

              {/* phase breakdown — where the time goes */}
              <div className="border-border/60 bg-card space-y-3 rounded-md border p-5">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    {tI18nComplete.raw('text1499fcd195a5')}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {tI18nComplete.raw('textfa320c3be26f')}
                  </p>
                </div>
                <ChartContainer config={phaseConfig} className="h-[220px] w-full">
                  <BarChart
                    accessibilityLayer
                    data={phaseData}
                    layout="vertical"
                    margin={{ left: 12, right: 12 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => fmtMs(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="provider"
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {PHASES.map((ph, i) => (
                      <Bar
                        key={ph}
                        dataKey={ph}
                        stackId="p"
                        fill={`var(--color-${ph})`}
                        radius={i === 0 ? [4, 0, 0, 4] : i === PHASES.length - 1 ? [0, 4, 4, 0] : 0}
                      />
                    ))}
                  </BarChart>
                </ChartContainer>
              </div>

              {an.recentErrors.length > 0 && (
                <div className="border-border/60 overflow-hidden rounded-md border">
                  <div className="border-border/60 border-b px-4 py-3">
                    <h3 className="text-sm font-semibold tracking-tight">
                      {tI18nComplete.raw('text799b25b8c943')}
                    </h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>{tI18nComplete.raw('text472590ae974d')}</TableHead>
                        <TableHead>{tI18nComplete.raw('text4f3a9bd00397')}</TableHead>
                        <TableHead>{tI18nComplete.raw('text54a0e8c17ebb')}</TableHead>
                        <TableHead>{tI18nComplete.raw('textcf9c7aa24a26')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {an.recentErrors.map((e) => (
                        <TableRow key={`${e.provider}:${e.createdAt}:${e.error ?? ''}`}>
                          <TableCell>
                            <Badge variant="outline" size="sm" className="capitalize">
                              {e.provider}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {e.errorClass === 'capacity' ? (
                              <Badge variant="secondary" size="sm">
                                {tI18nComplete.raw('textec21b3b973a3')}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                {e.errorClass ?? '—'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className="text-muted-foreground max-w-[420px] truncate text-xs"
                            title={e.error ?? ''}
                          >
                            {e.error ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(e.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── migrate dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!migrating}
        onOpenChange={(o) => {
          if (!o) setMigrating(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tI18nComplete.raw('text5150c9d9bb20')}</DialogTitle>
            <DialogDescription>
              {tI18nComplete.raw('text998c22f68978')}
              <span className="font-mono">{migrating?.sessionId?.slice(0, 8)}</span> off
              <Badge variant="outline" size="sm" className="mx-1 capitalize">
                {migrating?.provider}
              </Badge>
              {tI18nComplete.raw('text2dd5b5ed10be')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <label className="text-sm font-medium">{tI18nComplete.raw('text86ecd94bbb17')}</label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder={tI18nComplete.raw('texte1d36c3adeeb')} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMigrating(null)}>
              {tI18nComplete.raw('text19766ed6ccb2')}
            </Button>
            <Button
              onClick={() => migrate.mutate()}
              disabled={!target || migrate.isPending}
              className="gap-1.5"
            >
              {migrate.isPending && <Loading className="h-4 w-4" />}
              {tI18nComplete.raw('textf988ed29d81b')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionContainer>
  );
}
