'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from '@numera/ui';
import { ArrowLeft, RefreshCw, Send, Printer } from 'lucide-react';
import { createClient } from '../../../../../lib/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  subtotal: string;
  vat_amount: string | null;
  total_amount: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid';
  sent_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  client: { id: string; business_name: string; bir_registration_type: string; gmail_address: string } | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  display_order: number;
}

type DisplayStatus = 'draft' | 'sent' | 'paid' | 'overdue';
type BadgeStatus = 'in-review' | 'approved' | 'completed' | 'rejected';

const STATUS_BADGE: Record<DisplayStatus, { status: BadgeStatus; label: string }> = {
  draft:   { status: 'in-review', label: 'Draft' },
  sent:    { status: 'approved',  label: 'Sent' },
  paid:    { status: 'completed', label: 'Paid' },
  overdue: { status: 'rejected',  label: 'Overdue' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAmount(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function getDisplayStatus(invoice: InvoiceDetail): DisplayStatus {
  if (invoice.status === 'sent' && new Date(invoice.due_date) < new Date()) return 'overdue';
  return invoice.status;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoice = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [invoiceRes, itemsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, client:clients(id, business_name, bir_registration_type, gmail_address)')
          .eq('id', params.id)
          .single(),
        supabase
          .from('invoice_line_items')
          .select('*')
          .eq('invoice_id', params.id)
          .order('display_order', { ascending: true }),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      setInvoice(invoiceRes.data as unknown as InvoiceDetail);
      setLineItems((itemsRes.data ?? []) as unknown as LineItem[]);
    } catch {
      setError('Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  }, [supabase, params.id]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="h-8 w-48 rounded bg-slate-100 animate-pulse" />
        <div className="h-64 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-48 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-sm text-slate-500">{error || 'Invoice not found.'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/crm/invoices')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          <Button variant="outline" onClick={loadInvoice}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const displayStatus = getDisplayStatus(invoice);
  const badge = STATUS_BADGE[displayStatus];
  const isVAT = invoice.vat_amount !== null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/crm/invoices')}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Back to invoices"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{invoice.invoice_number}</h1>
              <Badge status={badge.status}>{badge.label}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {invoice.client?.business_name ?? 'Unknown client'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* ── Invoice Info ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Invoice Number" value={invoice.invoice_number} />
            <InfoRow label="Issue Date" value={formatDate(invoice.issue_date)} />
            <InfoRow label="Due Date" value={formatDate(invoice.due_date)} />
            <InfoRow label="Status" value={badge.label} />
            {invoice.sent_at && <InfoRow label="Sent At" value={formatDateTime(invoice.sent_at)} />}
            {invoice.paid_at && <InfoRow label="Paid At" value={formatDateTime(invoice.paid_at)} />}
            {invoice.notes && <InfoRow label="Notes" value={invoice.notes} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Business Name" value={invoice.client?.business_name ?? '—'} />
            <InfoRow label="BIR Type" value={invoice.client?.bir_registration_type === 'vat' ? 'VAT' : 'Non-VAT'} />
            <InfoRow label="Email" value={invoice.client?.gmail_address ?? '—'} />
            {invoice.client && (
              <button
                onClick={() => router.push(`/crm/clients/${invoice.client!.id}`)}
                className="text-sm text-teal-600 hover:text-teal-700 hover:underline"
              >
                View client profile
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Line Items ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">#</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Description</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">Unit Price</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-slate-900">{item.description}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">{parseFloat(item.quantity)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">{formatAmount(item.unit_price)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-900 font-medium tabular-nums">{formatAmount(item.line_total)}</td>
                  </tr>
                ))}
                {lineItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No line items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Summary ────────────────────────────────────────────────── */}
          <div className="flex justify-end border-t border-slate-200 px-4 py-4">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-slate-900 tabular-nums">{formatAmount(invoice.subtotal)}</span>
              </div>
              {isVAT && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">VAT (12%)</span>
                  <span className="text-slate-900 tabular-nums">{formatAmount(invoice.vat_amount!)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-base font-semibold text-slate-900">Total</span>
                <span className="text-base font-semibold text-slate-900 tabular-nums">{formatAmount(invoice.total_amount)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-teal-600">{label}</p>
      <p className="text-sm text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}
