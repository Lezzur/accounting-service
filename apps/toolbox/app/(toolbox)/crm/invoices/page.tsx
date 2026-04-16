'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@numera/db';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Toast,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@numera/ui';
import { FileText, Loader2, Plus, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  invoice_number: string;
  total_amount: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid';
  client: { business_name: string } | null;
}

type DisplayStatus = 'draft' | 'sent' | 'paid' | 'overdue';

interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDisplayStatus(invoice: InvoiceRow): DisplayStatus {
  if (invoice.status === 'sent' && new Date(invoice.due_date) < new Date()) {
    return 'overdue';
  }
  return invoice.status;
}

type BadgeStatus = 'in-review' | 'approved' | 'completed' | 'rejected';

const STATUS_BADGE: Record<DisplayStatus, { status: BadgeStatus; label: string }> = {
  draft:   { status: 'in-review',  label: 'Draft'   },
  sent:    { status: 'approved',   label: 'Sent'    },
  paid:    { status: 'completed',  label: 'Paid'    },
  overdue: { status: 'rejected',   label: 'Overdue' },
};

function formatAmount(amount: string): string {
  const n = parseFloat(amount);
  return `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-slate-100 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-slate-100 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-slate-100 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-slate-100 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-slate-100 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-slate-100 animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-7 w-24 rounded bg-slate-100 animate-pulse" /></td>
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmInvoice, setConfirmInvoice] = useState<InvoiceRow | null>(null);
  const [paying, setPaying] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function pushToast(message: string, variant: 'success' | 'error') {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*, client:clients(business_name), line_items:invoice_line_items(*)')
        .order('issue_date', { ascending: false });
      if (err) throw err;
      setInvoices((data ?? []) as unknown as InvoiceRow[]);
    } catch {
      setError('Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleMarkPaid() {
    if (!confirmInvoice) return;
    setPaying(true);
    try {
      const { error: err } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', confirmInvoice.id);
      if (err) throw err;
      setInvoices((prev) =>
        prev.map((inv) => inv.id === confirmInvoice.id ? { ...inv, status: 'paid' } : inv),
      );
      pushToast('Invoice marked as paid.', 'success');
      setConfirmInvoice(null);
    } catch {
      pushToast('Failed to mark invoice as paid. Try again.', 'error');
    } finally {
      setPaying(false);
    }
  }

  const isEmpty = !loading && !error && invoices.length === 0;

  return (
    <ToastProvider swipeDirection="right">
      <div className="flex flex-col h-full">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-200 shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Invoices</h1>
            {!loading && !error && (
              <p className="text-xs text-slate-400 mt-0.5">
                {invoices.length.toLocaleString()}{' '}
                {invoices.length === 1 ? 'invoice' : 'invoices'}
              </p>
            )}
          </div>
          <Button
            onClick={() => router.push('/crm/invoices/new')}
            className="h-8 px-3 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New Invoice
          </Button>
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
                      {['Invoice #', 'Client', 'Amount', 'Issue Date', 'Due Date', 'Status', ''].map(
                        (label, i) => (
                          <th
                            key={i}
                            scope="col"
                            className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap"
                          >
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {/* Loading skeleton */}
                    {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                    {/* Empty state */}
                    {isEmpty && (
                      <tr>
                        <td colSpan={7} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-9 w-9 text-slate-200" />
                            <p className="text-sm text-slate-500">
                              No invoices yet. Create your first invoice.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Rows */}
                    {!loading &&
                      invoices.map((invoice) => {
                        const displayStatus = getDisplayStatus(invoice);
                        const badge = STATUS_BADGE[displayStatus];
                        const isSentOrOverdue =
                          displayStatus === 'sent' || displayStatus === 'overdue';
                        return (
                          <tr
                            key={invoice.id}
                            className="hover:bg-slate-50 transition-colors duration-75"
                          >
                            <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                              {invoice.invoice_number}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-[220px]">
                              <span className="line-clamp-1">
                                {invoice.client?.business_name ?? (
                                  <span className="text-slate-300">—</span>
                                )}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 text-slate-700 whitespace-nowrap"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {formatAmount(invoice.total_amount)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {formatDate(invoice.issue_date)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {formatDate(invoice.due_date)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge status={badge.status}>{badge.label}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              {isSentOrOverdue && (
                                <Button
                                  variant="outline"
                                  onClick={() => setConfirmInvoice(invoice)}
                                  className="h-7 px-2.5 text-xs text-teal-600 border-teal-200 hover:bg-teal-50"
                                >
                                  Mark as Paid
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile card list (< 768 px) ─────────────────────────────── */}
              <div className="md:hidden divide-y divide-slate-100">
                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

                {isEmpty && (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 px-8">
                    <FileText className="h-9 w-9 text-slate-200" />
                    <p className="text-sm text-slate-500 text-center">
                      No invoices yet. Create your first invoice.
                    </p>
                  </div>
                )}

                {!loading &&
                  invoices.map((invoice) => {
                    const displayStatus = getDisplayStatus(invoice);
                    const badge = STATUS_BADGE[displayStatus];
                    const isSentOrOverdue =
                      displayStatus === 'sent' || displayStatus === 'overdue';
                    return (
                      <div key={invoice.id} className="px-4 py-3 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {invoice.invoice_number}
                          </p>
                          <Badge status={badge.status}>{badge.label}</Badge>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1">
                          {invoice.client?.business_name ?? (
                            <span className="text-slate-300">—</span>
                          )}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-500">
                            Due {formatDate(invoice.due_date)} ·{' '}
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatAmount(invoice.total_amount)}
                            </span>
                          </p>
                          {isSentOrOverdue && (
                            <button
                              type="button"
                              onClick={() => setConfirmInvoice(invoice)}
                              className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors duration-75 shrink-0"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Confirm Dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!confirmInvoice}
        onOpenChange={(open) => {
          if (!open && !paying) setConfirmInvoice(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark Invoice {confirmInvoice?.invoice_number} as paid?
            </DialogTitle>
            <DialogDescription>
              This will update the invoice status to Paid. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmInvoice(null)}
              disabled={paying}
              className="h-9 px-4 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkPaid}
              disabled={paying}
              className="h-9 px-4 text-sm gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {paying && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
      <ToastViewport aria-live="polite" />
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant} open>
          <ToastTitle>{t.message}</ToastTitle>
          <ToastClose />
        </Toast>
      ))}
    </ToastProvider>
  );
}
