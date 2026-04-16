'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@numera/db';
import {
  Button,
  Input,
  Toast,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  cn,
} from '@numera/ui';
import { Plus, Trash2, Loader2, Send, Eye, Save, AlertTriangle } from 'lucide-react';
import {
  fetchClientsForDropdownAction,
  generateInvoiceNumberAction,
  saveInvoiceDraftAction,
  type ClientOption,
} from './actions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  localId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error';
}

type SubmitMode = 'draft' | 'preview' | 'send';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newLineItem(): LineItem {
  return { localId: crypto.randomUUID(), description: '', quantity: '1', unitPrice: '' };
}

function toDecimalString(value: number): string {
  return value.toFixed(2);
}

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function parseAmount(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.max(0, n);
}

function lineTotal(item: LineItem): number {
  return parseAmount(item.quantity) * parseAmount(item.unitPrice);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AmountCell({ amount, className }: { amount: number; className?: string }) {
  return (
    <span
      className={cn('tabular-nums', className)}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatCurrency(amount)}
    </span>
  );
}

function ZeroWarning() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
      Amount is ₱0.00 — allowed but verify before sending.
    </span>
  );
}

// ─── Invoice Preview Dialog ──────────────────────────────────────────────────

interface PreviewDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  lineItems: LineItem[];
  subtotal: number;
  vatAmount: number | null;
  totalAmount: number;
  issueDate: string;
  dueDate: string;
}

function PreviewDialog({
  open,
  onClose,
  invoiceNumber,
  clientName,
  clientEmail,
  lineItems,
  subtotal,
  vatAmount,
  totalAmount,
  issueDate,
  dueDate,
}: PreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Invoice Preview</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-6 text-sm">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="text-lg font-bold text-slate-900">Numera</p>
              <p className="text-xs text-slate-500">Accounting Services</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">{invoiceNumber}</p>
              <p className="text-xs text-slate-500">
                Issued: {issueDate ? formatDate(issueDate) : '—'}
              </p>
              <p className="text-xs text-slate-500">
                Due: {dueDate ? formatDate(dueDate) : '—'}
              </p>
            </div>
          </div>

          {/* Bill To */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
              Bill To
            </p>
            <p className="font-medium text-slate-900">{clientName || '—'}</p>
            {clientEmail && <p className="text-slate-500">{clientEmail}</p>}
          </div>

          {/* Line Items */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 text-left text-xs font-medium text-slate-500 w-1/2">
                  Description
                </th>
                <th className="pb-2 text-right text-xs font-medium text-slate-500 w-[80px]">
                  Qty
                </th>
                <th className="pb-2 text-right text-xs font-medium text-slate-500 w-[120px]">
                  Unit Price
                </th>
                <th className="pb-2 text-right text-xs font-medium text-slate-500 w-[120px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineItems.map((item) => (
                <tr key={item.localId}>
                  <td className="py-2 text-slate-700">{item.description || '—'}</td>
                  <td className="py-2 text-right text-slate-700 tabular-nums">
                    {item.quantity || '0'}
                  </td>
                  <td className="py-2 text-right text-slate-700 tabular-nums">
                    {item.unitPrice ? formatCurrency(parseAmount(item.unitPrice)) : '₱0.00'}
                  </td>
                  <td
                    className="py-2 text-right font-medium text-slate-900 tabular-nums"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatCurrency(lineTotal(item))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <AmountCell amount={subtotal} />
              </div>
              {vatAmount !== null && (
                <div className="flex justify-between text-slate-600">
                  <span>VAT 12%</span>
                  <AmountCell amount={vatAmount} />
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900 text-base">
                <span>Grand Total</span>
                <AmountCell amount={totalAmount} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose} className="h-9 px-4 text-sm">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledClientId = searchParams.get('clientId') ?? '';

  // Supabase (browser client — try/catch follows project convention)
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(true);

  const [selectedClientId, setSelectedClientId] = useState(prefilledClientId);
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [dueDate, setDueDate] = useState('');

  // ── Submission state ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState<SubmitMode | null>(null);
  const [lineItemError, setLineItemError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── Toast state ─────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function pushToast(message: string, variant: ToastItem['variant']) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }

  // ── Load clients + invoice number on mount ──────────────────────────────────
  useEffect(() => {
    fetchClientsForDropdownAction()
      .then(setClients)
      .catch(() => pushToast('Failed to load clients.', 'error'))
      .finally(() => setClientsLoading(false));

    generateInvoiceNumberAction()
      .then(setInvoiceNumber)
      .catch(() => setInvoiceNumber('INV-ERROR'))
      .finally(() => setInvoiceNumberLoading(false));
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────
  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;
  const isVatClient = selectedClient?.birRegistrationType === 'vat';

  const subtotal = lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const vatAmount = isVatClient ? subtotal * 0.12 : null;
  const totalAmount = subtotal + (vatAmount ?? 0);

  // ── Line item handlers ──────────────────────────────────────────────────────
  function addLineItem() {
    setLineItems((prev) => [...prev, newLineItem()]);
    setLineItemError(false);
  }

  function removeLineItem(localId: string) {
    setLineItems((prev) => prev.filter((i) => i.localId !== localId));
  }

  function updateLineItem(localId: string, field: keyof Omit<LineItem, 'localId'>, value: string) {
    setLineItems((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)),
    );
    if (field === 'description' || field === 'unitPrice') setLineItemError(false);
  }

  // ── Build save params ───────────────────────────────────────────────────────
  const buildSaveParams = useCallback(() => {
    const issueDate = todayIso();
    return {
      clientId: selectedClientId,
      invoiceNumber,
      lineItems: lineItems.map((item, i) => ({
        description: item.description,
        quantity: parseAmount(item.quantity) || 1,
        unitPrice: toDecimalString(parseAmount(item.unitPrice)),
        displayOrder: i + 1,
      })),
      subtotal: toDecimalString(subtotal),
      vatAmount: vatAmount !== null ? toDecimalString(vatAmount) : null,
      totalAmount: toDecimalString(totalAmount),
      issueDate,
      dueDate,
    };
  }, [selectedClientId, invoiceNumber, lineItems, subtotal, vatAmount, totalAmount, dueDate]);

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    if (lineItems.length === 0) {
      setLineItemError(true);
      return false;
    }
    return true;
  }

  // ── Save as Draft ───────────────────────────────────────────────────────────
  async function handleSaveDraft() {
    if (!validate()) return;
    setSubmitting('draft');
    try {
      await saveInvoiceDraftAction(buildSaveParams());
      router.push('/crm/invoices');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save draft.';
      pushToast(msg, 'error');
    } finally {
      setSubmitting(null);
    }
  }

  // ── Preview ─────────────────────────────────────────────────────────────────
  function handlePreview() {
    if (!validate()) return;
    setPreviewOpen(true);
  }

  // ── Send Invoice ─────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!validate()) return;
    setSubmitting('send');

    let invoiceId: string;
    try {
      const result = await saveInvoiceDraftAction(buildSaveParams());
      invoiceId = result.invoiceId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save invoice.';
      pushToast(msg, 'error');
      setSubmitting(null);
      return;
    }

    if (!supabase) {
      pushToast('Client not available — reload the page.', 'error');
      setSubmitting(null);
      return;
    }

    try {
      const { error: fnError, data: fnData } = await supabase.functions.invoke<{
        success: boolean;
        data?: { sentTo: string; invoiceNumber: string };
        error?: { code: string; message: string };
      }>('send-invoice', { body: { invoiceId } });

      if (fnError || !fnData?.success) {
        const code = fnData?.error?.code ?? '';
        const message = fnData?.error?.message ?? fnError?.message ?? 'Failed to send invoice.';

        if (code === 'DEPENDENCY_UNAVAILABLE' && message.toLowerCase().includes('gmail')) {
          pushToast(
            'Gmail connection is not active. Reconnect in Settings.',
            'error',
          );
        } else {
          pushToast(
            `Failed to send invoice. Check Gmail connection and try again.`,
            'error',
          );
        }
        return;
      }

      const sentTo = fnData.data?.sentTo ?? selectedClient?.gmailAddress ?? 'client';
      pushToast(`Invoice sent to ${sentTo}.`, 'success');
      setTimeout(() => router.push('/crm/invoices'), 1500);
    } catch {
      pushToast('Failed to send invoice. Check Gmail connection and try again.', 'error');
    } finally {
      setSubmitting(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const isBusy = submitting !== null;
  const showZeroWarning = totalAmount === 0 && lineItems.length > 0;

  return (
    <ToastProvider swipeDirection="right">
      <div className="flex flex-col h-full overflow-auto">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-200 shrink-0">
          <h1 className="text-xl font-semibold text-slate-900">Create Invoice</h1>
        </div>

        {/* ── Form ────────────────────────────────────────────────────────────── */}
        <div className="flex-1 px-6 py-6 space-y-6 max-w-4xl">

          {/* ── Row 1: Client + Invoice # ───────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Client dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700" htmlFor="client-select">
                Client
              </label>
              {clientsLoading ? (
                <div className="h-9 rounded-md bg-slate-100 animate-pulse" />
              ) : (
                <select
                  id="client-select"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={isBusy}
                  className={cn(
                    'w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700',
                    'focus:outline-none focus:border-teal-600 focus:border-2 transition-[border-color,border-width] duration-[100ms]',
                    'disabled:bg-slate-50 disabled:cursor-not-allowed',
                  )}
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName}
                    </option>
                  ))}
                </select>
              )}
              {selectedClient?.birRegistrationType === 'vat' && (
                <p className="text-xs text-teal-600">VAT-registered — 12% VAT will be applied.</p>
              )}
            </div>

            {/* Invoice # */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700" htmlFor="invoice-number">
                Invoice #
              </label>
              {invoiceNumberLoading ? (
                <div className="h-9 rounded-md bg-slate-100 animate-pulse" />
              ) : (
                <Input
                  id="invoice-number"
                  value={invoiceNumber}
                  readOnly
                  className="h-9 text-sm bg-slate-100 text-slate-500 cursor-default select-all"
                />
              )}
            </div>
          </div>

          {/* ── Line Items ──────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-700">Line Items</p>

            {/* Table header (md+) */}
            <div className="hidden md:grid grid-cols-[1fr_80px_140px_140px_40px] gap-2 px-1 pb-1 border-b border-slate-200">
              <span className="text-xs font-medium text-slate-500">Description</span>
              <span className="text-xs font-medium text-slate-500 text-center">Qty</span>
              <span className="text-xs font-medium text-slate-500 text-right">Unit Price</span>
              <span className="text-xs font-medium text-slate-500 text-right">Line Total</span>
              <span />
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {lineItems.map((item, idx) => {
                const total = lineTotal(item);
                return (
                  <div
                    key={item.localId}
                    className="grid grid-cols-1 md:grid-cols-[1fr_80px_140px_140px_40px] gap-2 items-center"
                  >
                    {/* Description */}
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.localId, 'description', e.target.value)}
                      disabled={isBusy}
                      className="h-9 text-sm"
                      aria-label={`Line item ${idx + 1} description`}
                    />

                    {/* Qty */}
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.localId, 'quantity', e.target.value)}
                      disabled={isBusy}
                      className="h-9 text-sm text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label={`Line item ${idx + 1} quantity`}
                    />

                    {/* Unit Price */}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none select-none">
                        ₱
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.localId, 'unitPrice', e.target.value)}
                        disabled={isBusy}
                        className="h-9 text-sm pl-7 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                        aria-label={`Line item ${idx + 1} unit price`}
                      />
                    </div>

                    {/* Line Total */}
                    <div className="h-9 flex items-center justify-end px-3 text-sm font-medium text-slate-900 rounded-md bg-slate-50 border border-slate-200 select-none">
                      <AmountCell amount={total} />
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.localId)}
                      disabled={isBusy || lineItems.length === 1}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md text-slate-400',
                        'hover:bg-red-50 hover:text-red-500 transition-colors duration-75',
                        'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400',
                      )}
                      aria-label={`Remove line item ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Error: 0 line items */}
            {lineItemError && (
              <p className="text-xs text-red-600 font-medium">Add at least one line item.</p>
            )}

            {/* Add line item */}
            <button
              type="button"
              onClick={addLineItem}
              disabled={isBusy}
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 mt-1',
                'hover:text-teal-700 transition-colors duration-75',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              <Plus className="h-4 w-4" />
              Add Line Item
            </button>
          </div>

          {/* ── Due Date + Summary ────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:justify-between">

            {/* Due Date */}
            <div className="space-y-1.5 sm:max-w-[200px] w-full">
              <label className="block text-xs font-medium text-slate-700" htmlFor="due-date">
                Due Date
              </label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                min={todayIso()}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isBusy}
                className="h-9 text-sm"
              />
            </div>

            {/* Summary block */}
            <div className="sm:text-right space-y-1.5 shrink-0 sm:min-w-[220px]">
              {/* Zero warning */}
              {showZeroWarning && (
                <div className="mb-2">
                  <ZeroWarning />
                </div>
              )}

              <div className="flex justify-between sm:justify-end sm:gap-8 text-sm text-slate-600">
                <span>Subtotal</span>
                <AmountCell amount={subtotal} />
              </div>

              {isVatClient && vatAmount !== null && (
                <div className="flex justify-between sm:justify-end sm:gap-8 text-sm text-slate-600">
                  <span>VAT 12%</span>
                  <AmountCell amount={vatAmount} />
                </div>
              )}

              <div className="flex justify-between sm:justify-end sm:gap-8 pt-2 border-t border-slate-200">
                <span className="text-base font-bold text-slate-900">Grand Total</span>
                <span
                  className="text-lg font-bold text-slate-900"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Actions ───────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
            {/* Save as Draft */}
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isBusy}
              className="gap-2 h-9 px-4 text-sm text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              {submitting === 'draft' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save as Draft
            </Button>

            {/* Preview */}
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={isBusy}
              className="gap-2 h-9 px-4 text-sm text-teal-600 border-teal-300 hover:bg-teal-50"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>

            {/* Send Invoice */}
            <Button
              onClick={handleSend}
              disabled={isBusy}
              className="gap-2 h-9 px-4 text-sm bg-teal-600 hover:bg-teal-700 text-white"
            >
              {submitting === 'send' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Invoice
            </Button>
          </div>

        </div>
      </div>

      {/* ── Preview Dialog ───────────────────────────────────────────────────── */}
      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoiceNumber={invoiceNumber}
        clientName={selectedClient?.businessName ?? ''}
        clientEmail={selectedClient?.gmailAddress ?? ''}
        lineItems={lineItems}
        subtotal={subtotal}
        vatAmount={vatAmount}
        totalAmount={totalAmount}
        issueDate={todayIso()}
        dueDate={dueDate}
      />

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
