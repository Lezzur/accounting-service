import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';

// ─── Constants ──────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_SONNET = 'claude-sonnet-4-6';
const NARRATIVE_TIMEOUT_MS = 15_000;

const VALID_REPORT_TYPES = [
  'profit_and_loss',
  'balance_sheet',
  'cash_flow',
  'bank_reconciliation',
  'ar_ageing',
  'ap_ageing',
  'general_ledger',
  'trial_balance',
] as const;

type ReportType = (typeof VALID_REPORT_TYPES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Report types that get AI narrative
const NARRATIVE_REPORT_TYPES: ReportType[] = ['profit_and_loss', 'balance_sheet'];

// ─── Types ──────────────────────────────────────────────────────────────────

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: 'credit' | 'debit';
  category_code: string;
  chart_of_accounts: {
    code: string;
    name: string;
    type: string;
    normal_balance: string;
  };
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  client_id: string;
  total_amount: string;
  issue_date: string;
  due_date: string;
  status: string;
  clients: { business_name: string } | null;
}

interface ReportSection {
  title: string;
  [key: string]: unknown;
}

interface ReportResult {
  sections: ReportSection[];
  totals: Record<string, unknown>;
  validationWarnings: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDecimal(val: string): number {
  return parseFloat(val) || 0;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

// ─── Report generators ─────────────────────────────────────────────────────

function generateProfitAndLoss(transactions: TransactionRow[]): ReportResult {
  const revenueMap = new Map<string, { code: string; name: string; amount: number }>();
  const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

  for (const t of transactions) {
    const acctType = t.chart_of_accounts.type;
    const amount = toDecimal(t.amount);
    const map = acctType === 'revenue' ? revenueMap : acctType === 'expense' ? expenseMap : null;
    if (!map) continue;

    const existing = map.get(t.category_code);
    if (existing) {
      existing.amount += amount;
    } else {
      map.set(t.category_code, { code: t.category_code, name: t.chart_of_accounts.name, amount });
    }
  }

  const revenueItems = [...revenueMap.values()].sort((a, b) => a.code.localeCompare(b.code));
  const expenseItems = [...expenseMap.values()].sort((a, b) => a.code.localeCompare(b.code));

  const totalRevenue = revenueItems.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenseItems.reduce((sum, i) => sum + i.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  return {
    sections: [
      {
        title: 'Revenue',
        accountType: 'revenue',
        lineItems: revenueItems.map((i) => ({ code: i.code, name: i.name, amount: fmt(i.amount) })),
        subtotal: fmt(totalRevenue),
      },
      {
        title: 'Expenses',
        accountType: 'expense',
        lineItems: expenseItems.map((i) => ({ code: i.code, name: i.name, amount: fmt(i.amount) })),
        subtotal: fmt(totalExpenses),
      },
    ],
    totals: {
      totalRevenue: fmt(totalRevenue),
      totalExpenses: fmt(totalExpenses),
      netIncome: fmt(netIncome),
    },
    validationWarnings: [],
  };
}

function generateBalanceSheet(transactions: TransactionRow[]): ReportResult {
  const accountMap = new Map<string, { code: string; name: string; type: string; normalBalance: string; balance: number }>();

  for (const t of transactions) {
    const acctType = t.chart_of_accounts.type;
    if (!['asset', 'liability', 'equity'].includes(acctType)) continue;

    const amount = toDecimal(t.amount);
    const sign = t.type === 'debit' ? 1 : -1;
    // For assets, debits increase balance; for liabilities/equity, credits increase balance
    const adjustedSign = acctType === 'asset' ? sign : -sign;

    const existing = accountMap.get(t.category_code);
    if (existing) {
      existing.balance += adjustedSign * amount;
    } else {
      accountMap.set(t.category_code, {
        code: t.category_code,
        name: t.chart_of_accounts.name,
        type: acctType,
        normalBalance: t.chart_of_accounts.normal_balance,
        balance: adjustedSign * amount,
      });
    }
  }

  // Calculate retained earnings from revenue and expense transactions
  let retainedEarnings = 0;
  for (const t of transactions) {
    const acctType = t.chart_of_accounts.type;
    const amount = toDecimal(t.amount);
    if (acctType === 'revenue') {
      retainedEarnings += amount;
    } else if (acctType === 'expense') {
      retainedEarnings -= amount;
    }
  }

  const accounts = [...accountMap.values()];
  const assets = accounts.filter((a) => a.type === 'asset').sort((a, b) => a.code.localeCompare(b.code));
  const liabilities = accounts.filter((a) => a.type === 'liability').sort((a, b) => a.code.localeCompare(b.code));
  const equity = accounts.filter((a) => a.type === 'equity').sort((a, b) => a.code.localeCompare(b.code));

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0) + retainedEarnings;

  const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  const warnings: string[] = [];
  if (!isBalanced) {
    const diff = totalAssets - (totalLiabilities + totalEquity);
    warnings.push(`Balance sheet out of balance by ₱${fmt(Math.abs(diff))}`);
  }

  return {
    sections: [
      {
        title: 'Assets',
        accountType: 'asset',
        lineItems: assets.map((a) => ({ code: a.code, name: a.name, balance: fmt(a.balance) })),
        subtotal: fmt(totalAssets),
      },
      {
        title: 'Liabilities',
        accountType: 'liability',
        lineItems: liabilities.map((a) => ({ code: a.code, name: a.name, balance: fmt(a.balance) })),
        subtotal: fmt(totalLiabilities),
      },
      {
        title: 'Equity',
        accountType: 'equity',
        lineItems: [
          ...equity.map((a) => ({ code: a.code, name: a.name, balance: fmt(a.balance) })),
          { code: 'RE', name: 'Retained Earnings', balance: fmt(retainedEarnings) },
        ],
        subtotal: fmt(totalEquity),
      },
    ],
    totals: {
      totalAssets: fmt(totalAssets),
      totalLiabilities: fmt(totalLiabilities),
      totalEquity: fmt(totalEquity),
      isBalanced,
    },
    validationWarnings: warnings,
  };
}

function generateTrialBalance(transactions: TransactionRow[]): ReportResult {
  const accountMap = new Map<string, {
    code: string; name: string; accountType: string; normalBalance: string;
    totalDebits: number; totalCredits: number;
  }>();

  for (const t of transactions) {
    const amount = toDecimal(t.amount);
    const existing = accountMap.get(t.category_code);

    if (existing) {
      if (t.type === 'debit') existing.totalDebits += amount;
      else existing.totalCredits += amount;
    } else {
      accountMap.set(t.category_code, {
        code: t.category_code,
        name: t.chart_of_accounts.name,
        accountType: t.chart_of_accounts.type,
        normalBalance: t.chart_of_accounts.normal_balance,
        totalDebits: t.type === 'debit' ? amount : 0,
        totalCredits: t.type === 'credit' ? amount : 0,
      });
    }
  }

  const items = [...accountMap.values()].sort((a, b) => a.code.localeCompare(b.code));

  const grandTotalDebits = items.reduce((sum, i) => sum + i.totalDebits, 0);
  const grandTotalCredits = items.reduce((sum, i) => sum + i.totalCredits, 0);
  const imbalance = Math.abs(grandTotalDebits - grandTotalCredits);
  const isBalanced = imbalance < 0.01;

  const warnings: string[] = [];
  if (!isBalanced) {
    warnings.push(`Trial balance out of balance by ₱${fmt(imbalance)}`);
  }

  return {
    sections: [
      {
        title: 'Trial Balance',
        lineItems: items.map((i) => ({
          code: i.code,
          name: i.name,
          accountType: i.accountType,
          normalBalance: i.normalBalance,
          totalDebits: fmt(i.totalDebits),
          totalCredits: fmt(i.totalCredits),
          balance: fmt(
            i.normalBalance === 'debit'
              ? i.totalDebits - i.totalCredits
              : i.totalCredits - i.totalDebits,
          ),
        })),
      },
    ],
    totals: {
      totalDebits: fmt(grandTotalDebits),
      totalCredits: fmt(grandTotalCredits),
      isBalanced,
      imbalance: fmt(imbalance),
    },
    validationWarnings: warnings,
  };
}

function generateCashFlow(transactions: TransactionRow[]): ReportResult {
  // Classify accounts into cash flow activities based on account type
  const operating: { description: string; amount: number }[] = [];
  const investing: { description: string; amount: number }[] = [];
  const financing: { description: string; amount: number }[] = [];

  // Track opening/closing from cash accounts
  let cashDebits = 0;
  let cashCredits = 0;

  for (const t of transactions) {
    const acctType = t.chart_of_accounts.type;
    const amount = toDecimal(t.amount);
    const signedAmount = t.type === 'debit' ? amount : -amount;

    // Cash account tracking (assets starting with 1 that are cash-like)
    const code = t.category_code;
    const isCashAccount = code.startsWith('11'); // Cash and cash equivalents

    if (isCashAccount) {
      if (t.type === 'debit') cashDebits += amount;
      else cashCredits += amount;
    }

    // Revenue and expenses → operating
    if (acctType === 'revenue' || acctType === 'expense') {
      operating.push({ description: `${t.chart_of_accounts.name} — ${t.description}`, amount: acctType === 'revenue' ? amount : -amount });
    }
    // Non-cash assets (not 11xx) → investing
    else if (acctType === 'asset' && !isCashAccount) {
      investing.push({ description: `${t.chart_of_accounts.name} — ${t.description}`, amount: signedAmount });
    }
    // Liabilities and equity → financing
    else if (acctType === 'liability' || acctType === 'equity') {
      financing.push({ description: `${t.chart_of_accounts.name} — ${t.description}`, amount: -signedAmount });
    }
  }

  const operatingTotal = operating.reduce((sum, i) => sum + i.amount, 0);
  const investingTotal = investing.reduce((sum, i) => sum + i.amount, 0);
  const financingTotal = financing.reduce((sum, i) => sum + i.amount, 0);
  const netCashFlow = operatingTotal + investingTotal + financingTotal;

  return {
    sections: [
      {
        title: 'Operating Activities',
        lineItems: aggregateByDescription(operating),
        subtotal: fmt(operatingTotal),
      },
      {
        title: 'Investing Activities',
        lineItems: aggregateByDescription(investing),
        subtotal: fmt(investingTotal),
      },
      {
        title: 'Financing Activities',
        lineItems: aggregateByDescription(financing),
        subtotal: fmt(financingTotal),
      },
    ],
    totals: {
      netCashFlow: fmt(netCashFlow),
      openingBalance: fmt(0), // Would need prior period data for accurate opening balance
      closingBalance: fmt(netCashFlow),
    },
    validationWarnings: [],
  };
}

function aggregateByDescription(items: { description: string; amount: number }[]): { description: string; amount: string }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.description, (map.get(item.description) || 0) + item.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([description, amount]) => ({ description, amount: fmt(amount) }));
}

function generateBankReconciliation(transactions: TransactionRow[]): ReportResult {
  // Separate transactions into book entries
  let bookDebits = 0;
  let bookCredits = 0;
  const bookItems: { description: string; amount: string; type: string }[] = [];

  // Outstanding items — in a real system these would be flagged; here we include all
  const outstandingDeposits: { description: string; amount: string; date: string }[] = [];
  const outstandingChecks: { description: string; amount: string; date: string }[] = [];

  for (const t of transactions) {
    const amount = toDecimal(t.amount);
    const isCashAccount = t.category_code.startsWith('11');

    if (isCashAccount) {
      bookItems.push({ description: t.description, amount: fmt(amount), type: t.type });
      if (t.type === 'debit') {
        bookDebits += amount;
      } else {
        bookCredits += amount;
      }
    }
  }

  const bookBalance = bookDebits - bookCredits;

  return {
    sections: [
      {
        title: 'Book Balance',
        lineItems: bookItems,
      },
      {
        title: 'Outstanding Deposits',
        lineItems: outstandingDeposits,
      },
      {
        title: 'Outstanding Checks',
        lineItems: outstandingChecks,
      },
    ],
    totals: {
      bookBalance: fmt(bookBalance),
      adjustedBookBalance: fmt(bookBalance),
      bankBalance: fmt(0), // Bank statement balance not available from transaction data alone
      adjustedBankBalance: fmt(0),
      difference: fmt(bookBalance),
    },
    validationWarnings: [
      'Bank statement balance not available — enter manually for reconciliation.',
    ],
  };
}

function generateAgeingReport(
  invoices: InvoiceRow[],
  periodEnd: string,
  reportType: 'ar_ageing' | 'ap_ageing',
): ReportResult {
  const endDate = new Date(periodEnd);
  const buckets = {
    current: [] as { clientOrVendor: string; invoiceNumber: string; amount: string; daysOutstanding: number }[],
    days1to30: [] as { clientOrVendor: string; invoiceNumber: string; amount: string; daysOutstanding: number }[],
    days31to60: [] as { clientOrVendor: string; invoiceNumber: string; amount: string; daysOutstanding: number }[],
    days61to90: [] as { clientOrVendor: string; invoiceNumber: string; amount: string; daysOutstanding: number }[],
    days90plus: [] as { clientOrVendor: string; invoiceNumber: string; amount: string; daysOutstanding: number }[],
  };

  for (const inv of invoices) {
    const dueDate = new Date(inv.due_date);
    const daysOutstanding = Math.floor((endDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const clientOrVendor = inv.clients?.business_name ?? 'Unknown';

    const item = {
      clientOrVendor,
      invoiceNumber: inv.invoice_number,
      amount: inv.total_amount,
      daysOutstanding: Math.max(0, daysOutstanding),
    };

    if (daysOutstanding <= 0) buckets.current.push(item);
    else if (daysOutstanding <= 30) buckets.days1to30.push(item);
    else if (daysOutstanding <= 60) buckets.days31to60.push(item);
    else if (daysOutstanding <= 90) buckets.days61to90.push(item);
    else buckets.days90plus.push(item);
  }

  const sumBucket = (items: { amount: string }[]) =>
    items.reduce((s, i) => s + toDecimal(i.amount), 0);

  const currentTotal = sumBucket(buckets.current);
  const d1 = sumBucket(buckets.days1to30);
  const d31 = sumBucket(buckets.days31to60);
  const d61 = sumBucket(buckets.days61to90);
  const d90 = sumBucket(buckets.days90plus);
  const totalOutstanding = currentTotal + d1 + d31 + d61 + d90;

  const label = reportType === 'ar_ageing' ? 'Receivable' : 'Payable';

  return {
    sections: [
      { title: `Current ${label}s`, lineItems: buckets.current },
      { title: '1-30 Days', lineItems: buckets.days1to30 },
      { title: '31-60 Days', lineItems: buckets.days31to60 },
      { title: '61-90 Days', lineItems: buckets.days61to90 },
      { title: '90+ Days', lineItems: buckets.days90plus },
    ],
    totals: {
      totalOutstanding: fmt(totalOutstanding),
      currentTotal: fmt(currentTotal),
      days1to30: fmt(d1),
      days31to60: fmt(d31),
      days61to90: fmt(d61),
      days90plus: fmt(d90),
    },
    validationWarnings: [],
  };
}

function generateGeneralLedger(transactions: TransactionRow[]): ReportResult {
  // Group transactions by account, maintain running balance per account
  const accountTxns = new Map<string, {
    code: string; name: string; transactions: TransactionRow[];
  }>();

  for (const t of transactions) {
    const existing = accountTxns.get(t.category_code);
    if (existing) {
      existing.transactions.push(t);
    } else {
      accountTxns.set(t.category_code, {
        code: t.category_code,
        name: t.chart_of_accounts.name,
        transactions: [t],
      });
    }
  }

  const sections: ReportSection[] = [];
  let totalAccounts = 0;
  let totalTransactions = 0;

  const sortedAccounts = [...accountTxns.values()].sort((a, b) => a.code.localeCompare(b.code));

  for (const account of sortedAccounts) {
    totalAccounts++;
    // Sort transactions by date
    const sorted = account.transactions.sort((a, b) => a.date.localeCompare(b.date));
    totalTransactions += sorted.length;

    let runningBalance = 0;
    const lineItems = sorted.map((t) => {
      const amount = toDecimal(t.amount);
      const debit = t.type === 'debit' ? amount : 0;
      const credit = t.type === 'credit' ? amount : 0;
      runningBalance += debit - credit;

      return {
        date: t.date,
        description: t.description,
        debit: fmt(debit),
        credit: fmt(credit),
        runningBalance: fmt(runningBalance),
      };
    });

    sections.push({
      title: `${account.code} — ${account.name}`,
      accountCode: account.code,
      lineItems,
      openingBalance: fmt(0),
      closingBalance: fmt(runningBalance),
    });
  }

  return {
    sections,
    totals: {
      accountCount: totalAccounts,
      transactionCount: totalTransactions,
    },
    validationWarnings: [],
  };
}

// ─── AI Narrative ───────────────────────────────────────────────────────────

function formatReportType(type: ReportType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildNarrativePrompt(
  reportType: ReportType,
  periodStart: string,
  periodEnd: string,
  sections: ReportSection[],
  totals: Record<string, unknown>,
): string {
  const formattedType = formatReportType(reportType);

  const keyFigures = sections
    .map((s) => {
      const items = ((s.lineItems as Array<{ name?: string; code?: string; amount?: string; balance?: string }>) ?? [])
        .map((i) => `  ${i.name ?? i.code ?? ''}: ₱${i.amount ?? i.balance ?? '0.00'}`)
        .join('\n');
      return `${s.title}:\n${items}\n  Total: ₱${(s.subtotal as string) ?? '0.00'}`;
    })
    .join('\n\n');

  const totalsBlock = Object.entries(totals)
    .filter(([, v]) => typeof v === 'string')
    .map(([k, v]) => `${k}: ₱${v}`)
    .join('\n');

  return `Generate a brief professional financial summary (3-5 sentences) for a ${formattedType} for the period ${periodStart} to ${periodEnd}.

Key figures:
${keyFigures}

${totalsBlock}

Write in third person. Focus on: revenue trends, major expense categories, net income, and any notable items. Do not invent data not provided. Label clearly as "AI-Generated Summary — Review before sharing with client."

Respond in JSON:
{
  "narrative": "your summary text here"
}`;
}

async function callClaudeNarrative(prompt: string, apiKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NARRATIVE_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_SONNET,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const result = await response.json();
    const textBlock = result.content?.find((b: { type: string }) => b.type === 'text');
    if (!textBlock?.text) return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.narrative !== 'string') return null;

    return parsed.narrative;
  } catch {
    // AI failure is non-fatal — return report without narrative
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Edge Function ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'UNAUTHORIZED', 'Missing authorization header', requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Invalid or expired token', requestId);
    }

    // --- Parse & validate body ---
    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse(400, 'VALIDATION_FAILED', 'Invalid JSON body', requestId);
    }

    const { clientId, reportType, periodStart, periodEnd } = body;
    const errors: Array<{ field: string; issue: string }> = [];

    if (!clientId || typeof clientId !== 'string' || !UUID_RE.test(clientId)) {
      errors.push({ field: 'clientId', issue: 'Must be a valid UUID' });
    }

    if (!reportType || !VALID_REPORT_TYPES.includes(reportType)) {
      errors.push({
        field: 'reportType',
        issue: `Must be one of: ${VALID_REPORT_TYPES.join(', ')}`,
      });
    }

    if (!periodStart || typeof periodStart !== 'string' || !DATE_RE.test(periodStart)) {
      errors.push({ field: 'periodStart', issue: 'Must be a valid date (YYYY-MM-DD)' });
    }

    if (!periodEnd || typeof periodEnd !== 'string' || !DATE_RE.test(periodEnd)) {
      errors.push({ field: 'periodEnd', issue: 'Must be a valid date (YYYY-MM-DD)' });
    }

    if (errors.length > 0) {
      return errorResponse(400, 'VALIDATION_FAILED', 'Request validation failed', requestId, errors);
    }

    // Validate periodEnd >= periodStart
    if (periodEnd < periodStart) {
      return errorResponse(400, 'INVALID_INPUT', 'periodEnd must not be before periodStart', requestId);
    }

    // --- Service client for DB operations ---
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // --- Verify client exists ---
    const { data: client, error: clientError } = await serviceClient
      .from('clients')
      .select('id, business_name')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return errorResponse(404, 'NOT_FOUND', 'Client not found', requestId);
    }

    // --- Generate report based on type ---
    let reportResult: ReportResult;

    if (reportType === 'ar_ageing' || reportType === 'ap_ageing') {
      // Ageing reports use invoices, not transactions
      const statusFilter = reportType === 'ar_ageing' ? 'sent' : 'draft';
      const { data: invoices, error: invError } = await serviceClient
        .from('invoices')
        .select('id, invoice_number, client_id, total_amount, issue_date, due_date, status, clients(business_name)')
        .eq('client_id', clientId)
        .eq('status', statusFilter)
        .lte('issue_date', periodEnd)
        .gte('issue_date', periodStart);

      if (invError) {
        console.error('Invoice query error:', invError);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to query invoice data', requestId);
      }

      reportResult = generateAgeingReport(
        (invoices ?? []) as unknown as InvoiceRow[],
        periodEnd,
        reportType,
      );
    } else if (reportType === 'balance_sheet') {
      // Balance sheet is cumulative — transactions up to periodEnd, not just within period
      const { data: transactions, error: txnError } = await serviceClient
        .from('transactions')
        .select('id, date, description, amount, type, category_code, chart_of_accounts!inner(code, name, type:account_type, normal_balance)')
        .eq('client_id', clientId)
        .eq('status', 'approved')
        .lte('date', periodEnd);

      if (txnError) {
        console.error('Transaction query error:', txnError);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to query transaction data', requestId);
      }

      reportResult = generateBalanceSheet((transactions ?? []) as unknown as TransactionRow[]);
    } else {
      // All other reports: transactions within period
      const { data: transactions, error: txnError } = await serviceClient
        .from('transactions')
        .select('id, date, description, amount, type, category_code, chart_of_accounts!inner(code, name, type:account_type, normal_balance)')
        .eq('client_id', clientId)
        .eq('status', 'approved')
        .gte('date', periodStart)
        .lte('date', periodEnd);

      if (txnError) {
        console.error('Transaction query error:', txnError);
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to query transaction data', requestId);
      }

      const txns = (transactions ?? []) as unknown as TransactionRow[];

      switch (reportType as ReportType) {
        case 'profit_and_loss':
          reportResult = generateProfitAndLoss(txns);
          break;
        case 'trial_balance':
          reportResult = generateTrialBalance(txns);
          break;
        case 'cash_flow':
          reportResult = generateCashFlow(txns);
          break;
        case 'bank_reconciliation':
          reportResult = generateBankReconciliation(txns);
          break;
        case 'general_ledger':
          reportResult = generateGeneralLedger(txns);
          break;
        default:
          return errorResponse(400, 'INVALID_INPUT', `Unsupported report type: ${reportType}`, requestId);
      }
    }

    // --- AI Narrative (P&L and Balance Sheet only) ---
    let aiNarrative: string | null = null;

    if (NARRATIVE_REPORT_TYPES.includes(reportType as ReportType)) {
      const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (anthropicKey) {
        const prompt = buildNarrativePrompt(
          reportType as ReportType,
          periodStart,
          periodEnd,
          reportResult.sections,
          reportResult.totals as Record<string, unknown>,
        );
        aiNarrative = await callClaudeNarrative(prompt, anthropicKey);
      }
      // If no API key or generation failed, report still succeeds with aiNarrative=null
    }

    // --- Insert report record ---
    const reportId = crypto.randomUUID();
    const generatedAt = new Date().toISOString();

    const { error: insertError } = await serviceClient
      .from('financial_reports')
      .insert({
        id: reportId,
        client_id: clientId,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        generated_at: generatedAt,
        generated_by: user.id,
        ai_narrative: aiNarrative,
        ai_narrative_approved: false,
      });

    if (insertError) {
      console.error('Report insert error:', insertError);
      return errorResponse(500, 'INTERNAL_ERROR', 'Failed to save report record', requestId);
    }

    // --- Return response ---
    return successResponse(
      {
        reportId,
        reportType,
        clientId,
        periodStart,
        periodEnd,
        sections: reportResult.sections,
        totals: reportResult.totals,
        validationWarnings: reportResult.validationWarnings,
        aiNarrative,
        aiNarrativeApproved: false,
        generatedAt,
      },
      { request_id: requestId, duration_ms: Date.now() - startTime },
    );
  } catch (err) {
    console.error('Unhandled error:', err);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', requestId);
  }
});
