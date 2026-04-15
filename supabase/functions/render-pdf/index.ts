import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3';
import React from 'https://esm.sh/react@18';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from 'https://esm.sh/@react-pdf/renderer@3';
// Deno compatibility note: @react-pdf/renderer is loaded via esm.sh which
// handles Node.js polyfills. If esm.sh resolution fails at deploy time,
// fallback option: use a minimal Cloud Run sidecar (~$5/month) that accepts
// React-PDF JSX and returns a PDF buffer over HTTP.

// ─── Types ───────────────────────────────────────────────────────────────────

interface ErrorResponse {
  code: string;
  message: string;
  request_id: string;
  details?: Array<{ field: string; issue: string }>;
}

interface ReportSection {
  title: string;
  rows: Array<{ code: string; name: string; amount: number }>;
  subtotal: number;
}

interface ReportData {
  reportType: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  sections: ReportSection[];
  grandTotal: number;
  narrative: string | null;
}

interface BIRFormData {
  formNumber: string;
  formTitle: string;
  filingPeriod: string;
  clientName: string;
  tin: string;
  templateLayout: Record<string, unknown>;
  fields: Record<string, string>;
}

interface InvoiceData {
  invoiceNumber: string;
  clientName: string;
  clientAddress: string;
  issueDate: string;
  dueDate: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  subtotal: string;
  vatAmount: string | null;
  totalAmount: string;
  notes: string | null;
  status: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const renderPdfSchema = z.object({
  type: z.enum(['report', 'bir_form', 'invoice']),
  id: z.string().uuid(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 30_000;

function errorJson(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: ErrorResponse['details'],
): Response {
  const body: { error: ErrorResponse } = {
    error: { code, message, request_id: requestId },
  };
  if (details) body.error.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function successJson(
  data: Record<string, unknown>,
  requestId: string,
  startTime: number,
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: {
        request_id: requestId,
        duration_ms: Date.now() - startTime,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatReportType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── PDF Styles ──────────────────────────────────────────────────────────────

const colors = {
  primary: '#1a365d',
  secondary: '#2d3748',
  accent: '#3182ce',
  border: '#e2e8f0',
  lightBg: '#f7fafc',
  text: '#1a202c',
  muted: '#718096',
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.text,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 16,
  },
  brandName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.secondary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 9,
    color: colors.muted,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.lightBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  subtotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.secondary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.lightBg,
  },
  grandTotalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  colCode: { width: '15%', fontSize: 9 },
  colName: { width: '55%', fontSize: 9 },
  colAmount: {
    width: '30%',
    fontSize: 9,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  colAmountBold: {
    width: '30%',
    fontSize: 10,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontVariantNumeric: 'tabular-nums',
  },
  narrativeBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#fffff0',
    borderWidth: 1,
    borderColor: '#ecc94b',
    borderRadius: 4,
  },
  narrativeLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#b7791f',
    marginBottom: 6,
  },
  narrativeText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: colors.secondary,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: colors.muted,
  },
  // Invoice styles
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  invoiceNumber: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  invoiceStatus: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.accent,
    marginTop: 4,
  },
  addressBlock: {
    marginBottom: 20,
  },
  addressLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  invoiceMeta: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 40,
  },
  invoiceMetaBlock: {
    minWidth: 100,
  },
  lineItemHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  lineItemHeaderText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  lineItemRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  lineItemRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.lightBg,
  },
  colDesc: { width: '45%', fontSize: 9 },
  colQty: { width: '15%', fontSize: 9, textAlign: 'center' },
  colPrice: {
    width: '20%',
    fontSize: 9,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  colTotal: {
    width: '20%',
    fontSize: 9,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  totalsSection: {
    alignSelf: 'flex-end',
    width: '40%',
    marginTop: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: colors.secondary,
  },
  totalValue: {
    fontSize: 10,
    fontVariantNumeric: 'tabular-nums',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  grandTotalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    fontVariantNumeric: 'tabular-nums',
  },
  notesSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: colors.lightBg,
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.4,
    color: colors.secondary,
  },
  // BIR form styles
  birHeader: {
    textAlign: 'center',
    marginBottom: 16,
  },
  birFormNumber: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    textAlign: 'center',
  },
  birFormTitle: {
    fontSize: 11,
    textAlign: 'center',
    color: colors.secondary,
    marginTop: 4,
  },
  birFieldRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
    minHeight: 24,
  },
  birFieldLabel: {
    width: '60%',
    fontSize: 9,
  },
  birFieldValue: {
    width: '40%',
    fontSize: 9,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'Helvetica-Bold',
  },
  birOverrideIndicator: {
    fontSize: 7,
    color: '#e53e3e',
    marginLeft: 4,
  },
  birSectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: colors.lightBg,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});

// ─── PDF Template Components ─────────────────────────────────────────────────

const e = React.createElement;

function NumeraFooter(props: { generatedAt: string }) {
  return e(View, { style: styles.footer, fixed: true },
    e(Text, { style: styles.footerText }, 'Numera Accounting Services'),
    e(Text, { style: styles.footerText }, `Generated: ${props.generatedAt}`),
  );
}

function ReportPdf(props: { data: ReportData }) {
  const { data } = props;
  const now = new Date().toLocaleString('en-PH');

  return e(Document, null,
    e(Page, { size: 'A4', style: styles.page },
      // Header
      e(View, { style: styles.header },
        e(Text, { style: styles.brandName }, 'Numera'),
        e(Text, { style: styles.brandTagline }, 'Accounting Services'),
        e(Text, { style: styles.reportTitle }, formatReportType(data.reportType)),
        e(View, { style: styles.metaRow },
          e(Text, { style: styles.metaLabel }, 'Client:'),
          e(Text, { style: styles.metaValue }, data.clientName),
        ),
        e(View, { style: styles.metaRow },
          e(Text, { style: styles.metaLabel }, 'Period:'),
          e(Text, { style: styles.metaValue },
            `${formatDate(data.periodStart)} — ${formatDate(data.periodEnd)}`),
        ),
      ),

      // Sections
      ...data.sections.map((section, si) =>
        e(View, { key: `section-${si}` },
          e(Text, { style: styles.sectionTitle }, section.title),
          // Table header
          e(View, { style: styles.tableHeader },
            e(Text, { style: { ...styles.colCode, fontFamily: 'Helvetica-Bold' } }, 'Code'),
            e(Text, { style: { ...styles.colName, fontFamily: 'Helvetica-Bold' } }, 'Account'),
            e(Text, { style: styles.colAmountBold }, 'Amount'),
          ),
          // Data rows
          ...section.rows.map((row, ri) =>
            e(View, { key: `row-${si}-${ri}`, style: styles.tableRow },
              e(Text, { style: styles.colCode }, row.code),
              e(Text, { style: styles.colName }, row.name),
              e(Text, { style: styles.colAmount }, formatCurrency(row.amount)),
            ),
          ),
          // Subtotal
          e(View, { style: styles.subtotalRow },
            e(Text, { style: { ...styles.colCode } }),
            e(Text, { style: { ...styles.colName, fontFamily: 'Helvetica-Bold', fontSize: 10 } },
              `Total ${section.title}`),
            e(Text, { style: styles.colAmountBold }, formatCurrency(section.subtotal)),
          ),
        ),
      ),

      // Grand total
      e(View, { style: styles.grandTotalRow },
        e(Text, { style: { ...styles.colCode } }),
        e(Text, { style: { ...styles.colName, fontFamily: 'Helvetica-Bold', fontSize: 12, color: colors.primary } },
          data.reportType === 'profit_and_loss' ? 'Net Income' :
          data.reportType === 'balance_sheet' ? 'Total' :
          'Grand Total'),
        e(Text, { style: { ...styles.colAmountBold, fontSize: 12, color: colors.primary } },
          formatCurrency(data.grandTotal)),
      ),

      // AI Narrative
      ...(data.narrative ? [
        e(View, { key: 'narrative', style: styles.narrativeBox },
          e(Text, { style: styles.narrativeLabel },
            'AI-Generated Summary — Review before sharing with client.'),
          e(Text, { style: styles.narrativeText }, data.narrative),
        ),
      ] : []),

      e(NumeraFooter, { generatedAt: now }),
    ),
  );
}

function InvoicePdf(props: { data: InvoiceData }) {
  const { data } = props;
  const now = new Date().toLocaleString('en-PH');

  return e(Document, null,
    e(Page, { size: 'A4', style: styles.page },
      // Header with brand + invoice title
      e(View, { style: styles.invoiceHeader },
        e(View, null,
          e(Text, { style: styles.brandName }, 'Numera'),
          e(Text, { style: styles.brandTagline }, 'Accounting Services'),
        ),
        e(View, { style: { alignItems: 'flex-end' } },
          e(Text, { style: styles.invoiceTitle }, 'INVOICE'),
          e(Text, { style: styles.invoiceNumber }, `#${data.invoiceNumber}`),
          e(Text, { style: styles.invoiceStatus }, data.status.toUpperCase()),
        ),
      ),

      // Bill To
      e(View, { style: styles.addressBlock },
        e(Text, { style: styles.addressLabel }, 'Bill To'),
        e(Text, { style: { ...styles.addressText, fontFamily: 'Helvetica-Bold' } }, data.clientName),
        e(Text, { style: styles.addressText }, data.clientAddress),
      ),

      // Dates
      e(View, { style: styles.invoiceMeta },
        e(View, { style: styles.invoiceMetaBlock },
          e(Text, { style: styles.addressLabel }, 'Issue Date'),
          e(Text, { style: styles.addressText }, formatDate(data.issueDate)),
        ),
        e(View, { style: styles.invoiceMetaBlock },
          e(Text, { style: styles.addressLabel }, 'Due Date'),
          e(Text, { style: styles.addressText }, formatDate(data.dueDate)),
        ),
      ),

      // Line items table
      e(View, { style: styles.lineItemHeader },
        e(Text, { style: { ...styles.colDesc, ...styles.lineItemHeaderText } }, 'Description'),
        e(Text, { style: { ...styles.colQty, ...styles.lineItemHeaderText } }, 'Qty'),
        e(Text, { style: { ...styles.colPrice, ...styles.lineItemHeaderText } }, 'Unit Price'),
        e(Text, { style: { ...styles.colTotal, ...styles.lineItemHeaderText } }, 'Total'),
      ),
      ...data.lineItems.map((item, i) =>
        e(View, { key: `li-${i}`, style: i % 2 === 0 ? styles.lineItemRow : styles.lineItemRowAlt },
          e(Text, { style: styles.colDesc }, item.description),
          e(Text, { style: styles.colQty }, String(item.quantity)),
          e(Text, { style: styles.colPrice }, formatCurrency(item.unitPrice)),
          e(Text, { style: styles.colTotal }, formatCurrency(item.lineTotal)),
        ),
      ),

      // Totals
      e(View, { style: styles.totalsSection },
        e(View, { style: styles.totalRow },
          e(Text, { style: styles.totalLabel }, 'Subtotal'),
          e(Text, { style: styles.totalValue }, formatCurrency(data.subtotal)),
        ),
        ...(data.vatAmount ? [
          e(View, { key: 'vat', style: styles.totalRow },
            e(Text, { style: styles.totalLabel }, 'VAT (12%)'),
            e(Text, { style: styles.totalValue }, formatCurrency(data.vatAmount)),
          ),
        ] : []),
        e(View, { style: { ...styles.totalRow, borderTopWidth: 2, borderTopColor: colors.primary, paddingTop: 8, marginTop: 4 } },
          e(Text, { style: styles.grandTotalLabel }, 'Total'),
          e(Text, { style: styles.grandTotalValue }, formatCurrency(data.totalAmount)),
        ),
      ),

      // Notes
      ...(data.notes ? [
        e(View, { key: 'notes', style: styles.notesSection },
          e(Text, { style: styles.notesLabel }, 'Notes'),
          e(Text, { style: styles.notesText }, data.notes),
        ),
      ] : []),

      e(NumeraFooter, { generatedAt: now }),
    ),
  );
}

function BIRFormPdf(props: { data: BIRFormData }) {
  const { data } = props;
  const now = new Date().toLocaleString('en-PH');

  // Parse template_layout sections if available
  const layout = data.templateLayout as {
    sections?: Array<{
      title: string;
      fields?: Array<{ field_code: string; label: string }>;
    }>;
  };

  const sections = layout?.sections ?? [];

  return e(Document, null,
    e(Page, { size: 'A4', style: styles.page },
      // Header
      e(View, { style: styles.header },
        e(Text, { style: styles.brandName }, 'Numera'),
        e(Text, { style: styles.brandTagline }, 'Accounting Services'),
      ),

      // BIR form title
      e(View, { style: styles.birHeader },
        e(Text, { style: { fontSize: 8, color: colors.muted } }, 'Bureau of Internal Revenue'),
        e(Text, { style: styles.birFormNumber }, `BIR Form No. ${data.formNumber}`),
        e(Text, { style: styles.birFormTitle }, data.formTitle),
      ),

      // Filing info
      e(View, { style: { ...styles.metaRow, marginBottom: 4 } },
        e(Text, { style: styles.metaLabel }, 'Filing Period:'),
        e(Text, { style: styles.metaValue }, data.filingPeriod),
      ),
      e(View, { style: { ...styles.metaRow, marginBottom: 4 } },
        e(Text, { style: styles.metaLabel }, 'Taxpayer:'),
        e(Text, { style: styles.metaValue }, data.clientName),
      ),
      e(View, { style: { ...styles.metaRow, marginBottom: 16 } },
        e(Text, { style: styles.metaLabel }, 'TIN:'),
        e(Text, { style: styles.metaValue }, data.tin),
      ),

      // Render sections from template layout
      ...(sections.length > 0
        ? sections.map((section, si) =>
            e(View, { key: `bir-s-${si}` },
              e(Text, { style: styles.birSectionTitle }, section.title),
              ...(section.fields ?? []).map((field, fi) => {
                const value = data.fields[field.field_code] ?? '';
                const isOverride = value !== '' && data.fields[`__override_${field.field_code}`] === 'true';
                return e(View, { key: `bir-f-${si}-${fi}`, style: styles.birFieldRow },
                  e(Text, { style: styles.birFieldLabel }, field.label),
                  e(View, { style: { flexDirection: 'row', width: '40%', justifyContent: 'flex-end' } },
                    e(Text, { style: styles.birFieldValue }, value),
                    ...(isOverride
                      ? [e(Text, { key: 'ovr', style: styles.birOverrideIndicator }, '(edited)')]
                      : []),
                  ),
                );
              }),
            ),
          )
        : // Fallback: render fields flat if no template layout sections
          Object.entries(data.fields)
            .filter(([k]) => !k.startsWith('__'))
            .map(([code, value], i) =>
              e(View, { key: `bir-flat-${i}`, style: styles.birFieldRow },
                e(Text, { style: styles.birFieldLabel }, code),
                e(Text, { style: styles.birFieldValue }, value),
              ),
            )
      ),

      e(NumeraFooter, { generatedAt: now }),
    ),
  );
}

// ─── Data fetchers ───────────────────────────────────────────────────────────

async function fetchReportData(
  serviceClient: ReturnType<typeof createClient>,
  id: string,
): Promise<{ data: ReportData | null; clientId: string | null; error: string | null; status: number }> {
  const { data: report, error: reportErr } = await serviceClient
    .from('financial_reports')
    .select('*, clients(business_name)')
    .eq('id', id)
    .single();

  if (reportErr || !report) {
    return { data: null, clientId: null, error: 'Report not found', status: 404 };
  }

  const clientName = (report.clients as { business_name: string })?.business_name ?? 'Unknown';

  // AI Narrative Gate: omit if not approved
  const narrative =
    report.ai_narrative && report.ai_narrative_approved
      ? report.ai_narrative
      : null;

  // Fetch report data from transactions, grouped by account type
  const { data: txns, error: txnErr } = await serviceClient
    .from('transactions')
    .select('amount, type, category_code, chart_of_accounts(code, name, type, normal_balance)')
    .eq('client_id', report.client_id)
    .gte('date', report.period_start)
    .lte('date', report.period_end)
    .eq('status', 'approved');

  if (txnErr) {
    return { data: null, clientId: report.client_id, error: 'Failed to fetch transaction data', status: 422 };
  }

  // Group transactions by account type
  const accountGroups = new Map<string, Map<string, { code: string; name: string; total: number }>>();

  for (const txn of txns ?? []) {
    const coa = txn.chart_of_accounts as {
      code: string;
      name: string;
      type: string;
      normal_balance: string;
    } | null;
    if (!coa) continue;

    const groupKey = coa.type;
    if (!accountGroups.has(groupKey)) {
      accountGroups.set(groupKey, new Map());
    }

    const group = accountGroups.get(groupKey)!;
    if (!group.has(coa.code)) {
      group.set(coa.code, { code: coa.code, name: coa.name, total: 0 });
    }

    const entry = group.get(coa.code)!;
    const amount = parseFloat(txn.amount);

    // Amounts follow normal balance convention
    if (txn.type === coa.normal_balance) {
      entry.total += amount;
    } else {
      entry.total -= amount;
    }
  }

  // Build sections based on report type
  const sections: ReportSection[] = [];
  let grandTotal = 0;

  const buildSection = (title: string, accountType: string): ReportSection => {
    const group = accountGroups.get(accountType);
    const rows = group
      ? Array.from(group.values()).map((v) => ({
          code: v.code,
          name: v.name,
          amount: v.total,
        }))
      : [];
    const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);
    return { title, rows, subtotal };
  };

  switch (report.report_type) {
    case 'profit_and_loss': {
      const revenue = buildSection('Revenue', 'revenue');
      const expenses = buildSection('Expenses', 'expense');
      sections.push(revenue, expenses);
      grandTotal = revenue.subtotal - expenses.subtotal;
      break;
    }
    case 'balance_sheet': {
      const assets = buildSection('Assets', 'asset');
      const liabilities = buildSection('Liabilities', 'liability');
      const equity = buildSection('Equity', 'equity');
      sections.push(assets, liabilities, equity);
      grandTotal = assets.subtotal;
      break;
    }
    case 'trial_balance': {
      for (const [type, group] of accountGroups) {
        const title = type.charAt(0).toUpperCase() + type.slice(1);
        const rows = Array.from(group.values()).map((v) => ({
          code: v.code,
          name: v.name,
          amount: v.total,
        }));
        const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);
        sections.push({ title, rows, subtotal });
      }
      grandTotal = sections.reduce((sum, s) => sum + s.subtotal, 0);
      break;
    }
    default: {
      // Generic: group all account types
      for (const [type, group] of accountGroups) {
        const title = type.charAt(0).toUpperCase() + type.slice(1);
        const rows = Array.from(group.values()).map((v) => ({
          code: v.code,
          name: v.name,
          amount: v.total,
        }));
        const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);
        sections.push({ title, rows, subtotal });
      }
      grandTotal = sections.reduce((sum, s) => sum + s.subtotal, 0);
    }
  }

  return {
    data: {
      reportType: report.report_type,
      clientName,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      sections,
      grandTotal,
      narrative,
    },
    clientId: report.client_id,
    error: null,
    status: 200,
  };
}

async function fetchInvoiceData(
  serviceClient: ReturnType<typeof createClient>,
  id: string,
): Promise<{ data: InvoiceData | null; clientId: string | null; error: string | null; status: number }> {
  const { data: invoice, error: invErr } = await serviceClient
    .from('invoices')
    .select('*, clients(business_name, registered_address), invoice_line_items(*)')
    .eq('id', id)
    .single();

  if (invErr || !invoice) {
    return { data: null, clientId: null, error: 'Invoice not found', status: 404 };
  }

  const client = invoice.clients as { business_name: string; registered_address: string } | null;
  const lineItems = (
    invoice.invoice_line_items as Array<{
      description: string;
      quantity: number;
      unit_price: string;
      line_total: string;
      display_order: number;
    }>
  )?.sort((a, b) => a.display_order - b.display_order) ?? [];

  return {
    data: {
      invoiceNumber: invoice.invoice_number,
      clientName: client?.business_name ?? 'Unknown',
      clientAddress: client?.registered_address ?? '',
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      lineItems: lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unit_price,
        lineTotal: li.line_total,
      })),
      subtotal: invoice.subtotal,
      vatAmount: invoice.vat_amount,
      totalAmount: invoice.total_amount,
      notes: invoice.notes,
      status: invoice.status,
    },
    clientId: invoice.client_id,
    error: null,
    status: 200,
  };
}

async function fetchBIRFormData(
  serviceClient: ReturnType<typeof createClient>,
  id: string,
): Promise<{ data: BIRFormData | null; clientId: string | null; error: string | null; status: number }> {
  const { data: record, error: recErr } = await serviceClient
    .from('bir_tax_form_records')
    .select('*, clients(business_name, tin), bir_form_templates(form_title, template_layout)')
    .eq('id', id)
    .single();

  if (recErr || !record) {
    return { data: null, clientId: null, error: 'BIR form record not found', status: 404 };
  }

  const client = record.clients as { business_name: string; tin: string } | null;
  const template = record.bir_form_templates as {
    form_title: string;
    template_layout: Record<string, unknown>;
  } | null;

  // Merge prefill data with manual overrides
  const prefill = (record.prefill_data ?? {}) as Record<string, string>;
  const overrides = (record.manual_overrides ?? {}) as Record<string, string>;
  const fields: Record<string, string> = { ...prefill };
  for (const [key, value] of Object.entries(overrides)) {
    fields[key] = value;
    fields[`__override_${key}`] = 'true';
  }

  return {
    data: {
      formNumber: record.form_number,
      formTitle: template?.form_title ?? `BIR Form ${record.form_number}`,
      filingPeriod: record.filing_period,
      clientName: client?.business_name ?? 'Unknown',
      tin: client?.tin ?? '',
      templateLayout: template?.template_layout ?? {},
      fields,
    },
    clientId: record.client_id,
    error: null,
    status: 200,
  };
}

// ─── Storage path builders ───────────────────────────────────────────────────

function reportStoragePath(clientId: string, reportType: string, periodStart: string, periodEnd: string): string {
  const start = periodStart.slice(0, 7);
  const end = periodEnd.slice(0, 7);
  const period = start === end ? start : `${start}_${end}`;
  return `exports/${clientId}/reports/${reportType}-${period}.pdf`;
}

function birStoragePath(clientId: string, formNumber: string, filingPeriod: string): string {
  return `exports/${clientId}/bir/${formNumber}-${filingPeriod}.pdf`;
}

function invoiceStoragePath(clientId: string, invoiceNumber: string): string {
  return `exports/${clientId}/invoices/${invoiceNumber}.pdf`;
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return errorJson(405, 'METHOD_NOT_ALLOWED', 'POST required', requestId);
  }

  // --- Auth ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorJson(401, 'UNAUTHORIZED', 'Missing authorization token', requestId);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return errorJson(401, 'UNAUTHORIZED', 'Invalid authorization token', requestId);
  }

  // --- Parse & validate ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorJson(400, 'VALIDATION_FAILED', 'Invalid JSON body', requestId);
  }

  const parsed = renderPdfSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      issue: i.message,
    }));
    return errorJson(400, 'VALIDATION_FAILED', 'Invalid request body', requestId, details);
  }

  const { type, id } = parsed.data;

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Fetch data & render PDF ---
  let pdfBuffer: Uint8Array;
  let storagePath: string;
  let clientId: string;

  try {
    if (type === 'report') {
      const result = await fetchReportData(serviceClient, id);
      if (result.error || !result.data) {
        return errorJson(result.status, result.status === 404 ? 'NOT_FOUND' : 'PROCESSING_FAILED',
          result.error!, requestId);
      }
      clientId = result.clientId!;

      storagePath = reportStoragePath(
        clientId,
        result.data.reportType,
        result.data.periodStart,
        result.data.periodEnd,
      );

      pdfBuffer = await renderToBuffer(e(ReportPdf, { data: result.data }));

    } else if (type === 'invoice') {
      const result = await fetchInvoiceData(serviceClient, id);
      if (result.error || !result.data) {
        return errorJson(result.status, result.status === 404 ? 'NOT_FOUND' : 'PROCESSING_FAILED',
          result.error!, requestId);
      }
      clientId = result.clientId!;

      storagePath = invoiceStoragePath(clientId, result.data.invoiceNumber);

      pdfBuffer = await renderToBuffer(e(InvoicePdf, { data: result.data }));

    } else {
      // bir_form
      const result = await fetchBIRFormData(serviceClient, id);
      if (result.error || !result.data) {
        return errorJson(result.status, result.status === 404 ? 'NOT_FOUND' : 'PROCESSING_FAILED',
          result.error!, requestId);
      }
      clientId = result.clientId!;

      storagePath = birStoragePath(clientId, result.data.formNumber, result.data.filingPeriod);

      pdfBuffer = await renderToBuffer(e(BIRFormPdf, { data: result.data }));
    }
  } catch (err) {
    console.error('PDF rendering failed:', err);
    return errorJson(422, 'PROCESSING_FAILED', 'PDF rendering failed', requestId);
  }

  // --- Upload to Supabase Storage ---
  const { error: uploadError } = await serviceClient.storage
    .from('documents')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error('Storage upload failed:', uploadError);
    return errorJson(500, 'INTERNAL_ERROR', 'Failed to upload PDF to storage', requestId);
  }

  // --- Generate signed URL (1 hour) ---
  const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600);

  if (signedUrlError || !signedUrlData) {
    console.error('Signed URL generation failed:', signedUrlError);
    return errorJson(500, 'INTERNAL_ERROR', 'Failed to generate signed URL', requestId);
  }

  // --- Update exported_pdf_path on the source record ---
  if (type === 'report') {
    await serviceClient
      .from('financial_reports')
      .update({ exported_pdf_path: storagePath })
      .eq('id', id);
  } else if (type === 'bir_form') {
    await serviceClient
      .from('bir_tax_form_records')
      .update({ exported_pdf_path: storagePath })
      .eq('id', id);
  }

  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  return successJson(
    {
      storagePath,
      signedUrl: signedUrlData.signedUrl,
      expiresAt,
      fileSizeBytes: pdfBuffer.length,
    },
    requestId,
    startTime,
  );
});
