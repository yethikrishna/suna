'use client';

import {
  ArrowDownIcon as ArrowDown,
  ArrowUpIcon as ArrowUp,
  CaretLeftIcon as ChevronLeft,
  CaretRightIcon as ChevronRight,
  ArrowSquareOutIcon as ExternalLink,
  KanbanIcon as FolderKanban,
  ArrowClockwiseIcon as RefreshCw,
} from '@phosphor-icons/react';
import { useTranslations } from '@/i18n/use-translations';
import { useLocalizedUiCatalog } from '@/i18n/use-localized-ui-catalog';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/features/layout/section/empty-state';
import {
  useAdminProjects,
  type AdminProjectsSortBy,
  type AdminProjectsSortDir,
} from '@/hooks/admin/use-admin-projects';
import { useDebounce } from '@/hooks/use-debounced-value';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

import { SectionContainer, SectionHeader, StatPill, StatRow } from '../_components/section-header';

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

const shortDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Absolute date for the Created column — same format the accounts table uses. */
function shortDate(value: string | null): string {
  if (!value) return '—';
  const t = new Date(value);
  if (!Number.isFinite(+t)) return '—';
  return shortDateFormat.format(t);
}

export default function AdminProjectsPage() {
  const tI18nComplete = useTranslations('hardcodedUi.i18nComplete');
  const statusOptions = useLocalizedUiCatalog(STATUS_OPTIONS);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput);
  const [status, setStatus] = useState<StatusFilter>('all');
  // One state object, not two: the sort column and its direction always change
  // together, and a header click derives the new direction from the old column.
  const [sort, setSortState] = useState<{
    by: AdminProjectsSortBy;
    dir: AdminProjectsSortDir;
  }>({ by: 'activity', dir: 'desc' });
  const { by: sortBy, dir: sortDir } = sort;
  const [page, setPage] = useState(1);

  // Page 1 on a new search term. `search` is debounced, so it lands a tick after
  // the keystroke and cannot be reset inside the input's own handler — this is
  // React's "adjust state while rendering" pattern, not an effect: it re-renders
  // before anything paints, so page 5 of the old query is never shown against
  // the new one. Status and sort reset `page` directly in their handlers below.
  const [searchAtPage, setSearchAtPage] = useState(search);
  if (search !== searchAtPage) {
    setSearchAtPage(search);
    setPage(1);
  }

  const { data, isLoading, isFetching, refetch } = useAdminProjects({
    search,
    status: status === 'all' ? [] : [status],
    sortBy,
    sortDir,
    page,
    limit: PAGE_SIZE,
  });

  const projects = data?.projects ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Scoped to the rendered page on purpose — the route pages the rows, so a
  // fleet-wide live-session count is not available here and must not be implied.
  const liveOnPage = projects.reduce((n, p) => n + p.activeSessionCount, 0);

  // Re-clicking the active column flips direction; a new column starts at desc
  // (newest / most sessions first, which is what an operator wants to see).
  const setSort = useCallback((column: AdminProjectsSortBy) => {
    setSortState((s) =>
      s.by === column
        ? { by: column, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { by: column, dir: 'desc' },
    );
    setPage(1);
  }, []);

  const applyStatus = useCallback((next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  }, []);

  const resetFilters = () => {
    setSearchInput('');
    setStatus('all');
    setPage(1);
  };

  const filtered = search.length > 0 || status !== 'all';

  return (
    <SectionContainer>
      <SectionHeader
        icon={FolderKanban}
        title={tI18nComplete.raw('text04e2a9728af7')}
        description={tI18nComplete.raw('text396b656e8564')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            {isFetching ? (
              <Loading className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {tI18nComplete.raw('text0e9161011702')}
          </Button>
        }
      />

      <StatRow className="sm:grid-cols-2 lg:grid-cols-2">
        <StatPill
          label={tI18nComplete.raw('text5871c99664b2')}
          value={total.toLocaleString()}
          hint={
            filtered ? tI18nComplete.raw('text0350dc45fdbb') : tI18nComplete.raw('text4b87271b6b81')
          }
        />
        <StatPill
          label={tI18nComplete.raw('text366487a11e4c')}
          value={liveOnPage.toLocaleString()}
          tone={liveOnPage > 0 ? 'success' : 'default'}
          hint={`On this page (${projects.length} of ${total.toLocaleString()})`}
        />
      </StatRow>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <PageSearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={tI18nComplete.raw('textfa75c1ed206e')}
        />
        <Select value={status} onValueChange={(v) => applyStatus(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder={tI18nComplete.raw('text920e413c7d41')} />
          </SelectTrigger>
          <SelectContent align="end">
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="border-border/60 bg-card rounded-md border">
          <EmptyState
            icon={IconInbox}
            title={
              filtered
                ? tI18nComplete.raw('text32f69946e3c3')
                : tI18nComplete.raw('textf83c80652286')
            }
            description={filtered ? tI18nComplete.raw('text59c2c8f63734') : undefined}
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  {tI18nComplete.raw('text7179ea0035fc')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div
          className={cn(
            'border-border/60 overflow-hidden rounded-md border transition-opacity',
            isFetching && 'opacity-70',
          )}
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{tI18nComplete.raw('text985959785319')}</TableHead>
                <TableHead>{tI18nComplete.raw('text7e1b0d5641f2')}</TableHead>
                <SortHeader
                  label={tI18nComplete.raw('text6fa3cbf451b2')}
                  column="sessions"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={setSort}
                  align="right"
                />
                <SortHeader
                  label={tI18nComplete.raw('text06475633ed3e')}
                  column="activity"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={setSort}
                />
                <SortHeader
                  label={tI18nComplete.raw('textd70b9e24bca2')}
                  column="created"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={setSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.projectId}>
                  <TableCell>
                    <div className="max-w-[320px] min-w-0">
                      <Link
                        href={`/projects/${project.projectId}`}
                        className="group inline-flex max-w-full items-center gap-1.5 text-sm font-medium"
                      >
                        <span className="truncate group-hover:underline">
                          {project.name || tI18nComplete.raw('textedba1e383471')}
                        </span>
                        <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0" />
                      </Link>
                      <div className="text-muted-foreground truncate text-xs">
                        <span className="font-mono">{project.projectId.slice(0, 8)}</span>
                        {project.status === 'archived' && (
                          <>
                            <span className="mx-1.5 opacity-50">·</span>
                            <span>{tI18nComplete.raw('textbdb86505f806')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[280px] min-w-0">
                      {project.ownerEmail ? (
                        <Link
                          href={`/admin/accounts?search=${encodeURIComponent(project.ownerEmail)}`}
                          className="block truncate text-sm hover:underline"
                        >
                          {project.ownerEmail}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {tI18nComplete.raw('textaca82dbb8ef0')}
                        </span>
                      )}
                      <div className="text-muted-foreground truncate text-xs">
                        {project.accountName || tI18nComplete.raw('textefeba8456698')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    <span
                      className={cn(
                        project.activeSessionCount > 0
                          ? 'text-kortix-green'
                          : 'text-muted-foreground',
                      )}
                    >
                      {project.activeSessionCount}
                    </span>
                    <span className="text-muted-foreground/50 mx-0.5">/</span>
                    <span>{project.sessionCount}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {project.lastSessionAt
                      ? relativeTime(project.lastSessionAt)
                      : tI18nComplete.raw('text3d40a69d3160')}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {shortDate(project.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            {tI18nComplete.raw('text0a30a815d67d')} {page} {tI18nComplete.raw('text28391d3bc64e')}{' '}
            {pages} · {total.toLocaleString()} {tI18nComplete.raw('text2577c0f557b2')}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2.5"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {tI18nComplete.raw('text73912999faf4')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-2.5"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
            >
              {tI18nComplete.raw('text1ff57a29d7c9')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </SectionContainer>
  );
}

function SortHeader({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string;
  column: AdminProjectsSortBy;
  sortBy: AdminProjectsSortBy;
  sortDir: AdminProjectsSortDir;
  onSort: (col: AdminProjectsSortBy) => void;
  align?: 'left' | 'right';
}) {
  const active = sortBy === column;
  return (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium transition-colors',
          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowDown className="h-3 w-3 opacity-0" />
        )}
      </button>
    </TableHead>
  );
}
