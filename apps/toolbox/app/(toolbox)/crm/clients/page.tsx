'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input } from '@numera/ui';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { BusinessType, BIRRegistrationType } from '@numera/db';
import { fetchClientsAction, PAGE_SIZE } from './actions';
import type { ClientRow, SortColumn, SortDirection } from './actions';

// ─── Constants ───────────────────────────────────────────────────────────────

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  sole_prop: 'Sole Prop',
  opc: 'OPC',
  corporation: 'Corporation',
};

const BIR_LABELS: Record<BIRRegistrationType, string> = {
  vat: 'VAT',
  non_vat: 'Non-VAT',
};

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'businessName', label: 'Business Name' },
  { key: 'businessType', label: 'Business Type' },
  { key: 'birRegistrationType', label: 'BIR Registration' },
  { key: 'nextDeadline', label: 'Next Deadline' },
  { key: 'status', label: 'Status' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-teal-100 text-teal-900 rounded-sm not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-4 py-3">
        <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-14 rounded bg-slate-100 animate-pulse" />
      </td>
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="px-4 py-3 space-y-1.5 border-b border-slate-100">
      <div className="h-4 w-3/5 rounded bg-slate-100 animate-pulse" />
      <div className="h-3 w-2/5 rounded bg-slate-100 animate-pulse" />
      <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
    </div>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-slate-400" />;
  return direction === 'asc'
    ? <ChevronUp className="ml-1 h-3.5 w-3.5 text-teal-600" />
    : <ChevronDown className="ml-1 h-3.5 w-3.5 text-teal-600" />;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter();

  // Filter / sort / page state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | ''>('');
  const [birType, setBirType] = useState<BIRRegistrationType | ''>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('businessName');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [page, setPage] = useState(0);

  // Data state
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input (300 ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Reset to page 0 when filters or sort change
  useEffect(() => {
    setPage(0);
  }, [businessType, birType, sortColumn, sortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchClientsAction({
        search: debouncedSearch,
        businessType,
        birType,
        sortColumn,
        sortDir,
        page,
      });
      setClients(result.clients);
      setTotalCount(result.totalCount);
    } catch {
      setError('Failed to load clients.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, businessType, birType, sortColumn, sortDir, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const isEmpty = !loading && !error && clients.length === 0;
  const hasActiveFilter = !!(debouncedSearch || businessType || birType);

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0">
        <h1 className="text-lg font-semibold text-slate-900">Clients</h1>
        {!loading && !error && (
          <p className="text-xs text-slate-400 mt-0.5">
            {totalCount.toLocaleString()} {totalCount === 1 ? 'client' : 'clients'}
          </p>
        )}
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <select
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value as BusinessType | '')}
          className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]"
          aria-label="Filter by business type"
        >
          <option value="">All types</option>
          <option value="sole_prop">Sole Prop</option>
          <option value="opc">OPC</option>
          <option value="corporation">Corporation</option>
        </select>

        <select
          value={birType}
          onChange={(e) => setBirType(e.target.value as BIRRegistrationType | '')}
          className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]"
          aria-label="Filter by BIR registration"
        >
          <option value="">All BIR</option>
          <option value="vat">VAT</option>
          <option value="non_vat">Non-VAT</option>
        </select>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0">

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <p className="text-sm text-slate-500">{error}</p>
            <Button
              variant="outline"
              onClick={load}
              className="gap-1.5 h-8 min-w-0 px-3 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!error && (
          <>
            {/* ── Desktop / tablet table (≥ 768 px) ──────────────────────── */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white sticky top-0 z-10">
                    {COLUMNS.map(({ key, label }) => (
                      <th
                        key={key}
                        scope="col"
                        onClick={() => handleSort(key)}
                        className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
                      >
                        <span className="inline-flex items-center">
                          {label}
                          <SortIcon active={sortColumn === key} direction={sortDir} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {/* Loading skeleton */}
                  {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                  {/* Empty state */}
                  {!loading && isEmpty && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        {hasActiveFilter ? (
                          <p className="text-sm text-slate-500">No clients match your search.</p>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-9 w-9 text-slate-200" />
                            <p className="text-sm text-slate-500">
                              No clients yet. Close a lead to add your first client.
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {/* Rows */}
                  {!loading &&
                    clients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => router.push(`/crm/clients/${client.id}`)}
                        className="cursor-pointer hover:bg-slate-50 transition-colors duration-75"
                      >
                        {/* Business Name — truncate 2 lines, tooltip on hover */}
                        <td className="px-4 py-3 max-w-[220px]">
                          <span
                            className="line-clamp-2 font-medium text-slate-900 leading-snug"
                            title={client.businessName}
                          >
                            {highlightMatch(client.businessName, debouncedSearch)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {BUSINESS_TYPE_LABELS[client.businessType]}
                        </td>

                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {BIR_LABELS[client.birRegistrationType]}
                        </td>

                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {client.nextDeadline ? (
                            formatDate(client.nextDeadline)
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <Badge status={client.status === 'active' ? 'approved' : 'in-review'}>
                            {client.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile card list (< 768 px) ─────────────────────────────── */}
            <div className="md:hidden divide-y divide-slate-100">
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

              {!loading && isEmpty && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 px-8">
                  {hasActiveFilter ? (
                    <p className="text-sm text-slate-500 text-center">
                      No clients match your search.
                    </p>
                  ) : (
                    <>
                      <Users className="h-9 w-9 text-slate-200" />
                      <p className="text-sm text-slate-500 text-center">
                        No clients yet. Close a lead to add your first client.
                      </p>
                    </>
                  )}
                </div>
              )}

              {!loading &&
                clients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => router.push(`/crm/clients/${client.id}`)}
                    className="px-4 py-3 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors duration-75"
                  >
                    <p
                      className="line-clamp-2 text-sm font-medium text-slate-900 leading-snug"
                      title={client.businessName}
                    >
                      {highlightMatch(client.businessName, debouncedSearch)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {BUSINESS_TYPE_LABELS[client.businessType]}
                    </p>
                    {client.nextDeadline && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        Next: {formatDate(client.nextDeadline)}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-white shrink-0">
          <p className="text-xs text-slate-400">
            {(page * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString()} of{' '}
            {totalCount.toLocaleString()}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              className="h-7 min-w-0 px-2.5 text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              className="h-7 min-w-0 px-2.5 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
