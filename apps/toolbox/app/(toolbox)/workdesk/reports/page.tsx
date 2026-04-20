'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import type { Database, Client, FinancialReport, ReportType } from '@numera/db';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Input,
  Toast,
  ToastClose,
  ToastTitle,
  ToastProvider,
  ToastViewport,
} from '@numera/ui';
import {
  Loader2,
  X,
  Download,
  ExternalLink,
  FileText,
  AlertTriangle,
} from 'lucide-react';

// ─── Local types ──────────────────────────────────────────────────────────────

type ReportRow = {
  label: string;
  amount: number | null;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  indent?: number;
};

type ReportSection = {
  title: string;
  rows: ReportRow[];
};

type GeneratedReport = {
  reportId: string;
  reportType: ReportType;
  clientId: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  periodLabel?: string;
  sections: ReportSection[];
  aiNarrative?: string;
  aiNarrativeApproved?: boolean;
  warnings?: string[];
  validationWarnings?: string[];
  totals?: Record<string, unknown>;
};

// ─── Edge function → frontend section transformer ─────────────────────────────

function transformSections(raw: any[]): ReportSection[] {
  return (raw ?? []).map((s: any) => {
    const items: any[] = s.lineItems ?? s.rows ?? [];
    const rows: ReportRow[] = [];

    for (const item of items) {
      // Determine label
      const label =
        item.label ??
        (item.code && item.name ? `${item.code} — ${item.name}` : null) ??
        item.name ??
        item.description ??
        (item.clientOrVendor && item.invoiceNumber
          ? `${item.clientOrVendor} (${item.invoiceNumber})`
          : null) ??
        item.clientOrVendor ??
        `${item.date ?? ''}`;

      // Determine amount
      const amount = parseFloat(
        item.amount ?? item.balance ?? item.runningBalance ?? '0',
      );

      rows.push({
        label,
        amount: isNaN(amount) ? null : amount,
        indent: item.indent ?? 1,
      });
    }

    // Add subtotal row if present
    if (s.subtotal != null) {
      rows.push({
        label: `Total ${s.title}`,
        amount: parseFloat(s.subtotal),
        isSubtotal: true,
      });
    }

    // Add closing balance row for general ledger
    if (s.closingBalance != null) {
      rows.push({
        label: 'Closing Balance',
        amount: parseFloat(s.closingBalance),
        isSubtotal: true,
      });
    }

    return { title: s.title, rows };
  });
}
type ToastState = {
  open: boolean;
  variant: 'success' | 'error' | 'default';
  title: string;
};

type ErrorKind = 'insufficient_data' | 'empty_period' | 'generation_failed' | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  profit_and_loss: 'Profit & Loss',
  balance_sheet: 'Balance Sheet',
  cash_flow: 'Cash Flow',
  bank_reconciliation: 'Bank Reconciliation',
  ar_ageing: 'AR Ageing',
  ap_ageing: 'AP Ageing',
  general_ledger: 'General Ledger',
  trial_balance: 'Trial Balance',
};

const PERIOD_PRESETS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

// Report types that include an AI narrative
const NARRATIVE_TYPES: ReportType[] = ['profit_and_loss', 'balance_sheet'];

function resolvePeriod(preset: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const fmt = (d: Date) => d.toISOString().split('T')[0]!;

  switch (preset) {
    case 'this_month':
      return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) };
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { start: fmt(new Date(y, qStart, 1)), end: fmt(new Date(y, qStart + 3, 0)) };
    }
    case 'last_quarter': {
      const qStart = Math.floor(m / 3) * 3 - 3;
      return { start: fmt(new Date(y, qStart, 1)), end: fmt(new Date(y, qStart + 3, 0)) };
    }
    case 'this_year':
      return { start: fmt(new Date(y, 0, 1)), end: fmt(new Date(y, 11, 31)) };
    default:
      return { start: '', end: '' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPeso(amount: number | null): string {
  if (amount === null) return '—';
  return `₱${Math.abs(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function mapClientRow(row: Database['public']['Tables']['clients']['Row']): Client {
  return {
    id: row.id,
    businessName: row.business_name,
    businessType: row.business_type,
    tin: row.tin,
    registeredAddress: row.registered_address,
    industry: row.industry,
    birRegistrationType: row.bir_registration_type,
    fiscalYearStartMonth: row.fiscal_year_start_month,
    gmailAddress: row.gmail_address,
    monthlyRevenueBracket: row.monthly_revenue_bracket,
    googleSheetFolderUrl: row.google_sheet_folder_url ?? undefined,
    status: row.status,
    convertedFromLeadId: row.converted_from_lead_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReportRow(
  row: Database['public']['Tables']['financial_reports']['Row'],
): FinancialReport {
  return {
    id: row.id,
    clientId: row.client_id,
    reportType: row.report_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    aiNarrative: row.ai_narrative ?? undefined,
    aiNarrativeApproved: row.ai_narrative_approved,
    exportedPdfPath: row.exported_pdf_path ?? undefined,
    createdAt: row.created_at,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  // ── Supabase client (stable, created once) ──────────────────────────────────
  const supabase = useMemo(() => createClient(), []);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType | ''>('');
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // ── Data state ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [previousReports, setPreviousReports] = useState<FinancialReport[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // ── Generation state ────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generatingLong, setGeneratingLong] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Narrative state ─────────────────────────────────────────────────────────
  const [narrativeApproved, setNarrativeApproved] = useState(false);
  const [calloutDismissed, setCalloutDismissed] = useState(false);
  const [editingNarrative, setEditingNarrative] = useState(false);
  const [narrativeText, setNarrativeText] = useState('');

  // ── Toast state ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState>({
    open: false,
    variant: 'default',
    title: '',
  });

  // ── Load active clients on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('business_name');
      if (!cancelled && data) setClients(data.map(mapClientRow));
      if (!cancelled) setLoadingClients(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ── Load previous reports when client changes ───────────────────────────────
  useEffect(() => {
    if (!clientId) {
      setPreviousReports([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('financial_reports')
        .select('*')
        .eq('client_id', clientId)
        .order('generated_at', { ascending: false })
        .limit(10);
      if (!cancelled && data) setPreviousReports(data.map(mapReportRow));
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, supabase]);

  // ── Refresh previous reports list ───────────────────────────────────────────
  async function refreshPreviousReports(forClientId: string) {
    const { data } = await supabase
      .from('financial_reports')
      .select('*')
      .eq('client_id', forClientId)
      .order('generated_at', { ascending: false })
      .limit(10);
    if (data) setPreviousReports(data.map(mapReportRow));
  }

  // ── Load a previous report by re-generating with its parameters ─────────────
  function handleLoadPrevious(r: FinancialReport) {
    setReportType(r.reportType);
    setPeriod('custom');
    setCustomStart(r.periodStart);
    setCustomEnd(r.periodEnd);
    // Trigger generation on next tick after state settles
    setTimeout(() => {
      generateReport(r.reportType, clientId, 'custom', r.periodStart, r.periodEnd);
    }, 0);
  }

  // ── Generate report ─────────────────────────────────────────────────────────
  async function generateReport(
    type: ReportType | '',
    client: string,
    p: string,
    cStart: string,
    cEnd: string,
  ) {
    if (!type || !client) return;

    setGenerating(true);
    setGeneratingLong(false);
    setReport(null);
    setErrorKind(null);
    setNarrativeApproved(false);
    setCalloutDismissed(false);
    setEditingNarrative(false);
    setNarrativeText('');

    longTimerRef.current = setTimeout(() => setGeneratingLong(true), 3000);

    try {
      let periodStart = cStart;
      let periodEnd = cEnd;
      if (p !== 'custom') {
        const resolved = resolvePeriod(p);
        periodStart = resolved.start;
        periodEnd = resolved.end;
      }
      const body: Record<string, string> = {
        reportType: type,
        clientId: client,
        periodStart,
        periodEnd,
      };

      const { data, error } = await supabase.functions.invoke<GeneratedReport>(
        'generate-report',
        { body },
      );

      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('insufficient_data') || msg.includes('insufficient data')) {
          setErrorKind('insufficient_data');
        } else if (msg.includes('empty_period') || msg.includes('no transactions')) {
          setErrorKind('empty_period');
        } else {
          setErrorKind('generation_failed');
        }
        return;
      }

      if (data) {
        // Edge function wraps response: { success, data: { ... }, meta }
        const raw: any = (data as Record<string, unknown>).data ?? data;
        const report: GeneratedReport = {
          ...raw,
          periodLabel: raw.periodLabel ?? `${raw.periodStart} – ${raw.periodEnd}`,
          sections: transformSections(raw.sections),
          warnings: raw.validationWarnings ?? raw.warnings ?? [],
        };
        setReport(report);
        setNarrativeText(report.aiNarrative ?? '');
        await refreshPreviousReports(client);
      }
    } catch {
      setErrorKind('generation_failed');
    } finally {
      if (longTimerRef.current) clearTimeout(longTimerRef.current);
      setGenerating(false);
      setGeneratingLong(false);
    }
  }

  function handleGenerate() {
    generateReport(reportType, clientId, period, customStart, customEnd);
  }

  // ── Export PDF ──────────────────────────────────────────────────────────────
  async function handleExportPdf() {
    if (!report) return;
    try {
      const { data, error } = await supabase.functions.invoke<{ url: string }>(
        'export-report-pdf',
        { body: { reportId: report.reportId } },
      );
      if (error || !data?.url) throw error;

      const link = document.createElement('a');
      link.href = data.url;
      const type = REPORT_TYPE_LABELS[report.reportType].replace(/\s+/g, '-');
      const client = report.clientName.replace(/\s+/g, '-');
      const pd = (report.periodLabel ?? '').replace(/\s+/g, '-');
      link.download = `${type}-${client}-${pd}.pdf`;
      link.click();
    } catch {
      setToast({ open: true, variant: 'error', title: 'Export failed. Please try again.' });
    }
  }

  // ── Export Sheets ───────────────────────────────────────────────────────────
  async function handleExportSheets() {
    if (!report) return;
    try {
      const { data, error } = await supabase.functions.invoke<{ url: string }>(
        'export-report-sheets',
        { body: { reportId: report.reportId } },
      );
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('no_folder') || msg.includes('folder')) {
          setToast({
            open: true,
            variant: 'error',
            title:
              'No Google Sheets folder configured for this client. Add it in the client profile.',
          });
        } else {
          setToast({ open: true, variant: 'error', title: 'Export failed. Please try again.' });
        }
        return;
      }
      if (data?.url) window.open(data.url, '_blank');
      setToast({ open: true, variant: 'success', title: 'Report exported to Google Sheets.' });
    } catch {
      setToast({ open: true, variant: 'error', title: 'Export failed. Please try again.' });
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const hasNarrative = report !== null && NARRATIVE_TYPES.includes(report.reportType);
  const exportEnabled = !hasNarrative || narrativeApproved;
  const canGenerate =
    !!reportType &&
    !!clientId &&
    (period !== 'custom' || (!!customStart && !!customEnd));

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ToastProvider swipeDirection="right">
      <div className="flex h-full min-h-0">
        {/* ── Left Panel ──────────────────────────────────────────────────── */}
        <div className="w-[30%] min-w-[260px] max-w-[320px] border-r border-slate-200 bg-white flex flex-col overflow-y-auto shrink-0">
          <div className="p-5 space-y-5 flex-1">
            {/* Form */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Generate Report</h2>

              {/* Report Type */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Report Type</label>
                <Select
                  value={reportType}
                  onValueChange={(v) => setReportType(v as ReportType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Client */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Client</label>
                <Select
                  value={clientId}
                  onValueChange={setClientId}
                  disabled={loadingClients}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingClients ? 'Loading clients…' : 'Select client'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.businessName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Period */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Period</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom date range */}
              {period === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Start</label>
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">End</label>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!canGenerate || generating}
                onClick={handleGenerate}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </span>
                ) : (
                  'Generate'
                )}
              </Button>
            </div>

            {/* Previous Reports */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Previous Reports
              </h3>
              {!clientId ? (
                <p className="text-xs text-slate-400">
                  Select a client to see previous reports.
                </p>
              ) : previousReports.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No reports generated yet for this client.
                </p>
              ) : (
                <ul className="space-y-1">
                  {previousReports.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="w-full text-left px-2 py-2 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        onClick={() => handleLoadPrevious(r)}
                        disabled={generating}
                      >
                        <div className="text-xs font-medium text-slate-700">
                          {REPORT_TYPE_LABELS[r.reportType]}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(r.generatedAt).toLocaleDateString('en-PH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                          {' · '}
                          {r.periodStart.slice(0, 7)} – {r.periodEnd.slice(0, 7)}
                        </div>
                      </button>
                      {r.exportedPdfPath && (
                        <a
                          href={r.exportedPdfPath}
                          className="ml-2 mt-1 inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Panel ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {/* Empty state */}
          {!generating && !report && !errorKind && (
            <div className="flex items-center justify-center h-full min-h-[320px]">
              <div className="text-center">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 max-w-xs">
                  Select a report type, client, and period — then click Generate.
                </p>
              </div>
            </div>
          )}

          {/* Generating spinner */}
          {generating && (
            <div className="flex items-center justify-center h-full min-h-[320px]">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 text-teal-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-600">Generating report…</p>
                {generatingLong && (
                  <p className="text-xs text-slate-400">This may take a moment.</p>
                )}
              </div>
            </div>
          )}

          {/* Error states */}
          {!generating && errorKind && (
            <div className="flex items-center justify-center h-full min-h-[320px]">
              <div className="text-center max-w-sm px-6">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                {errorKind === 'insufficient_data' && (
                  <p className="text-sm text-slate-600">
                    Not enough approved transactions to generate this report. Approve pending
                    transactions first.
                  </p>
                )}
                {errorKind === 'empty_period' && (
                  <p className="text-sm text-slate-600">
                    No transactions found for this period.
                  </p>
                )}
                {errorKind === 'generation_failed' && (
                  <p className="text-sm text-slate-600">
                    Report generation failed. Please try again.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Report display */}
          {!generating && report && (
            <div className="p-6 max-w-4xl mx-auto">
              {/* Report header */}
              <div className="mb-5">
                <h1 className="text-xl font-semibold text-slate-900">
                  {REPORT_TYPE_LABELS[report.reportType]}
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {report.clientName} · {report.periodLabel}
                </p>
              </div>

              {/* Warnings */}
              {report.warnings?.map((w, i) => (
                <div
                  key={i}
                  className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}

              {/* Financial table */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
                {report.sections.map((section, si) => (
                  <div key={si}>
                    {/* Section header */}
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {section.title}
                      </span>
                    </div>
                    <table className="w-full">
                      <tbody>
                        {section.rows.map((row, ri) => (
                          <tr
                            key={ri}
                            className={
                              row.isGrandTotal
                                ? 'bg-slate-900'
                                : row.isSubtotal
                                  ? 'border-t border-slate-100'
                                  : 'border-b border-slate-50 last:border-b-0'
                            }
                          >
                            <td
                              className={[
                                'py-2 px-4 text-sm',
                                row.isGrandTotal
                                  ? 'font-semibold text-white'
                                  : row.isSubtotal
                                    ? 'font-semibold text-slate-700'
                                    : 'text-slate-600',
                              ].join(' ')}
                              style={
                                row.indent
                                  ? { paddingLeft: `${row.indent * 16 + 16}px` }
                                  : undefined
                              }
                            >
                              {row.label}
                            </td>
                            <td
                              className={[
                                'py-2 px-4 text-sm text-right tabular-nums',
                                row.isGrandTotal
                                  ? 'font-semibold text-white'
                                  : row.isSubtotal
                                    ? 'font-semibold text-slate-700'
                                    : 'text-slate-600',
                              ].join(' ')}
                            >
                              {formatPeso(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* AI Narrative — P&L and Balance Sheet only */}
              {hasNarrative && (
                <div className="mb-4 border-l-[4px] border-teal-600 pl-4 bg-white rounded-r-lg border border-l-0 border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">
                    AI Summary — Review before sending to client
                  </p>
                  {editingNarrative ? (
                    <textarea
                      className="w-full text-sm text-slate-700 border border-slate-200 rounded-md p-2 min-h-[120px] focus:outline-none focus:border-teal-600 resize-y"
                      value={narrativeText}
                      onChange={(e) => setNarrativeText(e.target.value)}
                    />
                  ) : (
                    <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {narrativeText}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    {editingNarrative ? (
                      <>
                        <Button
                          size="default"
                          onClick={() => {
                            setNarrativeApproved(true);
                            setEditingNarrative(false);
                          }}
                        >
                          Save &amp; Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => setEditingNarrative(false)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : narrativeApproved ? (
                      <span className="text-xs font-medium text-teal-600">
                        Narrative approved
                      </span>
                    ) : (
                      <>
                        <Button
                          size="default"
                          onClick={() => setNarrativeApproved(true)}
                        >
                          Approve Narrative
                        </Button>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => {
                            setEditingNarrative(true);
                          }}
                        >
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Approval gate callout */}
              {hasNarrative && !narrativeApproved && !calloutDismissed && (
                <div className="mb-4 flex items-start gap-3 bg-amber-100 text-amber-700 px-4 py-3 rounded-md">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="text-sm flex-1">
                    Approve the AI narrative to enable export.
                  </span>
                  <button
                    onClick={() => setCalloutDismissed(true)}
                    className="text-amber-600 hover:text-amber-800 transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Export buttons */}
              <div className="flex items-center gap-3">
                <Button
                  disabled={!exportEnabled}
                  className={!exportEnabled ? 'opacity-50' : ''}
                  onClick={handleExportPdf}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  disabled={!exportEnabled}
                  className={!exportEnabled ? 'opacity-50' : ''}
                  onClick={handleExportSheets}
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Export to Google Sheets
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <Toast
        open={toast.open}
        onOpenChange={(open) => setToast((t) => ({ ...t, open }))}
        variant={toast.variant}
      >
        <ToastTitle>{toast.title}</ToastTitle>
        <ToastClose />
      </Toast>
      <ToastViewport aria-live="polite" />
    </ToastProvider>
  );
}
