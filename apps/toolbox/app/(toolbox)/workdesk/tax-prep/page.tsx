'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import type { Database, Client, BIRFormNumber } from '@numera/db';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Toast,
  ToastClose,
  ToastTitle,
  ToastProvider,
  ToastViewport,
} from '@numera/ui';
import {
  Loader2,
  Download,
  AlertTriangle,
  FileText,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  X,
  Info,
} from 'lucide-react';

// ─── Local types ──────────────────────────────────────────────────────────────

type FieldKind = 'editable' | 'readonly';

interface FormField {
  id: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
}

interface FormSection {
  title: string;
  fields: FormField[];
}

interface PrefillResponse {
  recordId: string;
  formNumber: BIRFormNumber;
  clientTin: string;
  filingPeriod: string;
  prefillData: Record<string, string>;
  warnings?: string[];
  templateStale?: boolean;
}

type ToastState = {
  open: boolean;
  variant: 'success' | 'error' | 'default';
  title: string;
};

type FormApplicability =
  | 'ok'
  | 'wrong_registration_type'
  | 'wrong_business_type'
  | 'missing_tin';

// ─── Form templates ───────────────────────────────────────────────────────────

const FORM_TEMPLATES: Record<BIRFormNumber, { name: string; sections: FormSection[] }> = {
  '2550Q': {
    name: 'Quarterly VAT Return',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'rdo_code', label: 'RDO Code', kind: 'readonly' },
          { id: 'taxpayer_name', label: "Taxpayer's Name / Business Name", kind: 'readonly', required: true },
          { id: 'registered_address', label: 'Registered Address', kind: 'readonly', required: true },
          { id: 'quarter', label: 'Quarter', kind: 'readonly', required: true },
          { id: 'year', label: 'Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Computation of Output Tax',
        fields: [
          { id: 'taxable_sales', label: 'Taxable Sales / Receipts (₱)', kind: 'editable', required: true },
          { id: 'output_tax', label: 'Output Tax (12%)', kind: 'readonly' },
          { id: 'zero_rated_sales', label: 'Zero-Rated Sales / Receipts (₱)', kind: 'editable' },
          { id: 'vat_exempt_sales', label: 'VAT-Exempt Sales / Receipts (₱)', kind: 'editable' },
          { id: 'total_sales', label: 'Total Sales / Receipts (₱)', kind: 'readonly' },
        ],
      },
      {
        title: 'Part III — Computation of Input Tax',
        fields: [
          { id: 'input_tax_cf', label: 'Input Tax Carried Forward from Previous Quarter (₱)', kind: 'editable' },
          { id: 'current_input_tax', label: "Current Quarter's Creditable Input Tax (₱)", kind: 'editable', required: true },
          { id: 'total_input_tax', label: 'Total Available Input Tax (₱)', kind: 'readonly' },
          { id: 'input_tax_applied', label: 'Input Tax Applied Against Output Tax (₱)', kind: 'readonly' },
          { id: 'excess_input_tax', label: 'Excess Input Tax Carried Over (₱)', kind: 'readonly' },
        ],
      },
      {
        title: 'Part IV — VAT Payable / Overpayment',
        fields: [
          { id: 'vat_payable', label: 'VAT Payable / (Overpayment) (₱)', kind: 'readonly', required: true },
          { id: 'tax_credits', label: 'Less: Tax Credits / Payments (₱)', kind: 'editable' },
          { id: 'net_vat_payable', label: 'Net VAT Payable (₱)', kind: 'readonly' },
          { id: 'surcharge', label: 'Add: Surcharge (₱)', kind: 'editable' },
          { id: 'interest', label: 'Add: Interest (₱)', kind: 'editable' },
          { id: 'compromise', label: 'Add: Compromise Penalty (₱)', kind: 'editable' },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '2550M': {
    name: 'Monthly VAT Declaration',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'taxpayer_name', label: "Taxpayer's Name / Business Name", kind: 'readonly', required: true },
          { id: 'month', label: 'Month', kind: 'readonly', required: true },
          { id: 'year', label: 'Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Computation of Output Tax',
        fields: [
          { id: 'taxable_sales', label: 'Taxable Sales / Receipts (₱)', kind: 'editable', required: true },
          { id: 'output_tax', label: 'Output Tax (12%)', kind: 'readonly' },
          { id: 'zero_rated_sales', label: 'Zero-Rated Sales / Receipts (₱)', kind: 'editable' },
          { id: 'vat_exempt_sales', label: 'VAT-Exempt Sales / Receipts (₱)', kind: 'editable' },
        ],
      },
      {
        title: 'Part III — Input Tax and VAT Payable',
        fields: [
          { id: 'input_tax', label: "Current Month's Creditable Input Tax (₱)", kind: 'editable', required: true },
          { id: 'vat_payable', label: 'VAT Payable (₱)', kind: 'readonly', required: true },
          { id: 'tax_credits', label: 'Less: Tax Credits / Payments (₱)', kind: 'editable' },
          { id: 'net_vat_payable', label: 'Net VAT Payable (₱)', kind: 'readonly' },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '2551Q': {
    name: 'Quarterly Percentage Tax Return',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'taxpayer_name', label: "Taxpayer's Name / Business Name", kind: 'readonly', required: true },
          { id: 'quarter', label: 'Quarter', kind: 'readonly', required: true },
          { id: 'year', label: 'Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Computation of Tax',
        fields: [
          { id: 'gross_receipts', label: 'Gross Receipts / Sales (₱)', kind: 'editable', required: true },
          { id: 'tax_rate', label: 'Tax Rate', kind: 'readonly' },
          { id: 'percentage_tax', label: 'Percentage Tax Due (₱)', kind: 'readonly', required: true },
          { id: 'tax_credits', label: 'Less: Tax Credits / Payments (₱)', kind: 'editable' },
          { id: 'net_tax_payable', label: 'Net Tax Payable (₱)', kind: 'readonly' },
          { id: 'surcharge', label: 'Add: Surcharge (₱)', kind: 'editable' },
          { id: 'interest', label: 'Add: Interest (₱)', kind: 'editable' },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '1701': {
    name: 'Annual Income Tax Return (Individuals)',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'taxpayer_name', label: "Taxpayer's Name", kind: 'readonly', required: true },
          { id: 'registered_address', label: 'Registered Address', kind: 'readonly', required: true },
          { id: 'year', label: 'Taxable Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Computation of Tax',
        fields: [
          { id: 'gross_compensation', label: 'Gross Compensation Income (₱)', kind: 'editable' },
          { id: 'gross_business_income', label: 'Gross Business Income (₱)', kind: 'editable', required: true },
          { id: 'total_gross_income', label: 'Total Gross Income (₱)', kind: 'readonly', required: true },
          { id: 'allowable_deductions', label: 'Less: Allowable Deductions (₱)', kind: 'editable' },
          { id: 'taxable_income', label: 'Taxable Income (₱)', kind: 'readonly', required: true },
          { id: 'income_tax_due', label: 'Income Tax Due (₱)', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part III — Tax Credits and Payments',
        fields: [
          { id: 'quarterly_payments', label: 'Total Quarterly Payments Made (₱)', kind: 'editable' },
          { id: 'creditable_wt', label: 'Creditable Withholding Tax (₱)', kind: 'editable' },
          { id: 'total_tax_credits', label: 'Total Tax Credits / Payments (₱)', kind: 'readonly' },
          { id: 'tax_still_due', label: 'Tax Still Due / (Overpayment) (₱)', kind: 'readonly', required: true },
          { id: 'surcharge', label: 'Add: Surcharge (₱)', kind: 'editable' },
          { id: 'interest', label: 'Add: Interest (₱)', kind: 'editable' },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '1701Q': {
    name: 'Quarterly Income Tax Return (Individuals)',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'taxpayer_name', label: "Taxpayer's Name / Business Name", kind: 'readonly', required: true },
          { id: 'quarter', label: 'Quarter', kind: 'readonly', required: true },
          { id: 'year', label: 'Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Computation of Income Tax',
        fields: [
          { id: 'gross_income', label: 'Total Gross Income (₱)', kind: 'editable', required: true },
          { id: 'allowable_deductions', label: 'Less: Allowable Deductions (₱)', kind: 'editable' },
          { id: 'taxable_income', label: 'Taxable Income (₱)', kind: 'readonly', required: true },
          { id: 'income_tax_due', label: 'Income Tax Due (₱)', kind: 'readonly', required: true },
          { id: 'prior_quarter_tax', label: 'Less: Tax Paid in Prior Quarters (₱)', kind: 'editable' },
          { id: 'net_tax_payable', label: 'Net Tax Payable (₱)', kind: 'readonly', required: true },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '1702': {
    name: 'Annual Income Tax Return (Corporations)',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'corporation_name', label: 'Corporation / Partnership Name', kind: 'readonly', required: true },
          { id: 'registered_address', label: 'Registered Address', kind: 'readonly', required: true },
          { id: 'fiscal_year_end', label: 'Fiscal Year End', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Income and Deductions',
        fields: [
          { id: 'gross_revenue', label: 'Gross Revenue / Receipts (₱)', kind: 'editable', required: true },
          { id: 'cost_of_sales', label: 'Less: Cost of Sales / Services (₱)', kind: 'editable', required: true },
          { id: 'gross_income', label: 'Gross Income (₱)', kind: 'readonly', required: true },
          { id: 'operating_expenses', label: 'Less: Operating Expenses (₱)', kind: 'editable' },
          { id: 'taxable_income', label: 'Net Taxable Income (₱)', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part III — Computation of Tax',
        fields: [
          { id: 'income_tax_due', label: 'Normal Corporate Income Tax (NCIT) (₱)', kind: 'readonly', required: true },
          { id: 'mcit', label: 'Minimum Corporate Income Tax (MCIT) (₱)', kind: 'readonly' },
          { id: 'tax_due', label: 'Income Tax Due (₱)', kind: 'readonly', required: true },
          { id: 'quarterly_payments', label: 'Less: Quarterly Payments (₱)', kind: 'editable' },
          { id: 'creditable_wt', label: 'Less: Creditable Withholding Tax (₱)', kind: 'editable' },
          { id: 'tax_still_due', label: 'Tax Still Due / (Overpayment) (₱)', kind: 'readonly', required: true },
          { id: 'surcharge', label: 'Add: Surcharge (₱)', kind: 'editable' },
          { id: 'interest', label: 'Add: Interest (₱)', kind: 'editable' },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '1702Q': {
    name: 'Quarterly Income Tax Return (Corporations)',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'corporation_name', label: 'Corporation / Partnership Name', kind: 'readonly', required: true },
          { id: 'quarter', label: 'Quarter', kind: 'readonly', required: true },
          { id: 'fiscal_year_end', label: 'Fiscal Year End', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Computation of Income',
        fields: [
          { id: 'gross_income', label: 'Cumulative Gross Income (₱)', kind: 'editable', required: true },
          { id: 'allowable_deductions', label: 'Cumulative Allowable Deductions (₱)', kind: 'editable' },
          { id: 'taxable_income', label: 'Cumulative Net Taxable Income (₱)', kind: 'readonly', required: true },
          { id: 'income_tax_due', label: 'Cumulative Income Tax Due (₱)', kind: 'readonly', required: true },
          { id: 'prior_quarter_tax', label: 'Less: Tax Paid in Prior Quarters (₱)', kind: 'editable' },
          { id: 'net_tax_payable', label: 'Net Tax Payable (₱)', kind: 'readonly', required: true },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '1601-C': {
    name: 'Monthly Remittance — Compensation Withholding',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'taxpayer_name', label: "Taxpayer's Name / Business Name", kind: 'readonly', required: true },
          { id: 'month', label: 'Month', kind: 'readonly', required: true },
          { id: 'year', label: 'Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Tax Withheld',
        fields: [
          { id: 'total_compensation', label: 'Total Compensation Paid (₱)', kind: 'editable', required: true },
          { id: 'total_employees', label: 'Number of Employees', kind: 'editable', required: true },
          { id: 'tax_withheld', label: 'Total Tax Withheld on Compensation (₱)', kind: 'editable', required: true },
          { id: 'tax_remitted', label: 'Less: Tax Remitted in Prior Month (₱)', kind: 'editable' },
          { id: 'net_tax_due', label: 'Net Tax Due (₱)', kind: 'readonly', required: true },
          { id: 'surcharge', label: 'Add: Surcharge (₱)', kind: 'editable' },
          { id: 'interest', label: 'Add: Interest (₱)', kind: 'editable' },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '1601-EQ': {
    name: 'Quarterly Remittance — Expanded Withholding',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'taxpayer_name', label: "Taxpayer's Name / Business Name", kind: 'readonly', required: true },
          { id: 'quarter', label: 'Quarter', kind: 'readonly', required: true },
          { id: 'year', label: 'Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Schedule of Income Payments and Tax Withheld',
        fields: [
          { id: 'professional_fees_income', label: 'Professional Fees — Income Payments (₱)', kind: 'editable' },
          { id: 'professional_fees_tax', label: 'Professional Fees — Tax Withheld (₱)', kind: 'editable' },
          { id: 'rental_income', label: 'Rent — Income Payments (₱)', kind: 'editable' },
          { id: 'rental_tax', label: 'Rent — Tax Withheld (₱)', kind: 'editable' },
          { id: 'other_income', label: 'Other Income Payments (₱)', kind: 'editable' },
          { id: 'other_tax', label: 'Other Tax Withheld (₱)', kind: 'editable' },
          { id: 'total_tax_withheld', label: 'Total Tax Withheld (₱)', kind: 'readonly', required: true },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '0619-E': {
    name: 'Monthly Remittance — Expanded Withholding',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'taxpayer_name', label: "Taxpayer's Name / Business Name", kind: 'readonly', required: true },
          { id: 'month', label: 'Month', kind: 'readonly', required: true },
          { id: 'year', label: 'Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Tax Withheld',
        fields: [
          { id: 'total_income_payments', label: 'Total Income Payments (₱)', kind: 'editable', required: true },
          { id: 'total_tax_withheld', label: 'Total Tax Withheld (₱)', kind: 'editable', required: true },
          { id: 'tax_remitted', label: 'Less: Amount Remitted Previously (₱)', kind: 'editable' },
          { id: 'net_tax_due', label: 'Net Tax Due (₱)', kind: 'readonly', required: true },
          { id: 'surcharge', label: 'Add: Surcharge (₱)', kind: 'editable' },
          { id: 'interest', label: 'Add: Interest (₱)', kind: 'editable' },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
  '0619-F': {
    name: 'Monthly Remittance — Final Withholding',
    sections: [
      {
        title: 'Part I — Background Information',
        fields: [
          { id: 'tin', label: 'Taxpayer Identification Number (TIN)', kind: 'readonly', required: true },
          { id: 'taxpayer_name', label: "Taxpayer's Name / Business Name", kind: 'readonly', required: true },
          { id: 'month', label: 'Month', kind: 'readonly', required: true },
          { id: 'year', label: 'Year', kind: 'readonly', required: true },
        ],
      },
      {
        title: 'Part II — Final Withholding Tax',
        fields: [
          { id: 'dividends_income', label: 'Dividends — Income Payments (₱)', kind: 'editable' },
          { id: 'dividends_tax', label: 'Dividends — Tax Withheld (₱)', kind: 'editable' },
          { id: 'interest_income', label: 'Interest — Income Payments (₱)', kind: 'editable' },
          { id: 'interest_tax', label: 'Interest — Tax Withheld (₱)', kind: 'editable' },
          { id: 'royalties_income', label: 'Royalties — Income Payments (₱)', kind: 'editable' },
          { id: 'royalties_tax', label: 'Royalties — Tax Withheld (₱)', kind: 'editable' },
          { id: 'total_tax_withheld', label: 'Total Final Withholding Tax (₱)', kind: 'readonly', required: true },
          { id: 'surcharge', label: 'Add: Surcharge (₱)', kind: 'editable' },
          { id: 'interest', label: 'Add: Interest (₱)', kind: 'editable' },
          { id: 'total_amount_due', label: 'Total Amount Due (₱)', kind: 'readonly', required: true },
        ],
      },
    ],
  },
};

// ─── Period helpers ───────────────────────────────────────────────────────────

const MONTHLY_FORMS: BIRFormNumber[] = ['2550M', '1601-C', '0619-E', '0619-F'];
const QUARTERLY_FORMS: BIRFormNumber[] = ['2550Q', '2551Q', '1701Q', '1702Q', '1601-EQ'];
const ANNUAL_FORMS: BIRFormNumber[] = ['1701', '1702'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function generatePeriods(formNumber: BIRFormNumber): { value: string; label: string }[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const periods: { value: string; label: string }[] = [];

  if (MONTHLY_FORMS.includes(formNumber)) {
    for (let y = currentYear; y >= currentYear - 1; y--) {
      for (let m = 11; m >= 0; m--) {
        if (y === currentYear && m > now.getMonth()) continue;
        const val = `${y}-${String(m + 1).padStart(2, '0')}`;
        periods.push({ value: val, label: `${MONTHS[m]} ${y}` });
      }
    }
  } else if (QUARTERLY_FORMS.includes(formNumber)) {
    for (let y = currentYear; y >= currentYear - 1; y--) {
      for (let q = 4; q >= 1; q--) {
        if (y === currentYear && (q - 1) * 3 > now.getMonth()) continue;
        periods.push({ value: `${y}-Q${q}`, label: `Q${q} ${y}` });
      }
    }
  } else {
    for (let y = currentYear; y >= currentYear - 2; y--) {
      periods.push({ value: String(y), label: String(y) });
    }
  }

  return periods;
}

// ─── Applicability check ──────────────────────────────────────────────────────

function checkApplicability(
  formNumber: BIRFormNumber,
  client: Client,
): FormApplicability {
  if (!client.tin) return 'missing_tin';

  const isVat = client.birRegistrationType === 'vat';
  const isCorp = client.businessType === 'corporation';

  if ((formNumber === '2550M' || formNumber === '2550Q') && !isVat)
    return 'wrong_registration_type';
  if (formNumber === '2551Q' && isVat) return 'wrong_registration_type';
  if ((formNumber === '1702' || formNumber === '1702Q') && !isCorp)
    return 'wrong_business_type';
  if ((formNumber === '1701' || formNumber === '1701Q') && isCorp)
    return 'wrong_business_type';

  return 'ok';
}

function suggestForm(formNumber: BIRFormNumber, client: Client): string | null {
  const isVat = client.birRegistrationType === 'vat';
  const isCorp = client.businessType === 'corporation';

  if ((formNumber === '2550M' || formNumber === '2550Q') && !isVat)
    return '2551Q (Quarterly Percentage Tax)';
  if (formNumber === '2551Q' && isVat) return '2550Q (Quarterly VAT Return)';
  if ((formNumber === '1702' || formNumber === '1702Q') && !isCorp)
    return '1701Q (Quarterly Individual ITR)';
  if ((formNumber === '1701' || formNumber === '1701Q') && isCorp)
    return '1702Q (Quarterly Corporate ITR)';

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    contactName: row.contact_name ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    businessPhone: row.business_phone ?? undefined,
    status: row.status,
    convertedFromLeadId: row.converted_from_lead_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatFieldDiff(current: string | undefined, prior: string | undefined) {
  if (!current || !prior) return null;
  const c = parseFloat(current.replace(/[^0-9.-]/g, ''));
  const p = parseFloat(prior.replace(/[^0-9.-]/g, ''));
  if (isNaN(c) || isNaN(p) || p === 0) return null;
  const pct = ((c - p) / Math.abs(p)) * 100;
  return { pct: Math.abs(pct).toFixed(1), up: c >= p };
}

// ─── Shimmer component ────────────────────────────────────────────────────────

function Shimmer() {
  return <div className="h-9 bg-slate-200 rounded animate-pulse" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaxPrepPage() {
  // ── Supabase client ─────────────────────────────────────────────────────────
  const supabase = useMemo(() => createClient(), []);

  // ── Selector state ──────────────────────────────────────────────────────────
  const [formNumber, setFormNumber] = useState<BIRFormNumber | ''>('');
  const [clientId, setClientId] = useState('');
  const [filingPeriod, setFilingPeriod] = useState('');

  // ── Data state ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // ── Prefill state ───────────────────────────────────────────────────────────
  const [prefilling, setPrefilling] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [prefillData, setPrefillData] = useState<Record<string, string>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [prefillWarnings, setPrefillWarnings] = useState<string[]>([]);
  const [templateStale, setTemplateStale] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [clientTin, setClientTin] = useState('');

  // ── Prior-year state ────────────────────────────────────────────────────────
  const [priorYearData, setPriorYearData] = useState<Record<string, string> | null>(null);
  const [priorYearLabel, setPriorYearLabel] = useState('');
  const [priorYearOpen, setPriorYearOpen] = useState(true);

  // ── Export state ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [showValidation, setShowValidation] = useState(false);

  // ── Toast state ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState>({
    open: false,
    variant: 'default',
    title: '',
  });

  // ── Load clients ─────────────────────────────────────────────────────────────
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
    return () => { cancelled = true; };
  }, [supabase]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedClient = clients.find((c) => c.id === clientId) ?? null;
  const template = formNumber ? FORM_TEMPLATES[formNumber] : null;
  const periods = formNumber ? generatePeriods(formNumber) : [];

  const applicability: FormApplicability =
    formNumber && selectedClient
      ? checkApplicability(formNumber, selectedClient)
      : 'ok';

  const canPrefill =
    !!formNumber &&
    !!clientId &&
    !!filingPeriod &&
    applicability === 'ok' &&
    !prefilling;

  // ── Reset on selector change ─────────────────────────────────────────────────
  useEffect(() => {
    setPrefilled(false);
    setPrefillData({});
    setFieldValues({});
    setPrefillWarnings([]);
    setTemplateStale(false);
    setRecordId(null);
    setClientTin('');
    setPriorYearData(null);
    setPriorYearLabel('');
    setValidationErrors(new Set());
    setShowValidation(false);
  }, [formNumber, clientId, filingPeriod]);

  // ── Reset period when form type changes ─────────────────────────────────────
  useEffect(() => {
    setFilingPeriod('');
  }, [formNumber]);

  // ── Pre-fill ─────────────────────────────────────────────────────────────────
  const fetchPriorYear = useCallback(async () => {
    if (!formNumber || !clientId || !filingPeriod) return;

    try {
      const { data } = await supabase.functions.invoke<{
        prefillData: Record<string, string>;
        periodLabel: string;
      }>('prefill-bir-form', {
        body: { formNumber, clientId, filingPeriod, priorYear: true },
      });
      if (data) {
        setPriorYearData(data.prefillData);
        setPriorYearLabel(data.periodLabel);
      } else {
        setPriorYearData(null);
      }
    } catch {
      setPriorYearData(null);
    }
  }, [supabase, formNumber, clientId, filingPeriod]);

  const handlePrefill = useCallback(async () => {
    if (!canPrefill) return;

    setPrefilling(true);
    try {
      const { data, error } = await supabase.functions.invoke<PrefillResponse>(
        'prefill-bir-form',
        { body: { formNumber, clientId, filingPeriod } },
      );

      if (error || !data) {
        setToast({ open: true, variant: 'error', title: 'Pre-fill failed. Please try again.' });
        return;
      }

      setPrefillData(data.prefillData);
      setFieldValues(data.prefillData);
      setPrefillWarnings(data.warnings ?? []);
      setTemplateStale(data.templateStale ?? false);
      setRecordId(data.recordId);
      setClientTin(data.clientTin);
      setPrefilled(true);

      // Fetch prior-year comparison
      fetchPriorYear();
    } catch {
      setToast({ open: true, variant: 'error', title: 'Pre-fill failed. Please try again.' });
    } finally {
      setPrefilling(false);
    }
  }, [canPrefill, supabase, formNumber, clientId, filingPeriod, fetchPriorYear]);

  // ── Field change ─────────────────────────────────────────────────────────────
  function handleFieldChange(fieldId: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    if (showValidation) {
      setValidationErrors((prev) => {
        const next = new Set(prev);
        if (value.trim()) next.delete(fieldId);
        return next;
      });
    }
  }

  // ── Export PDF ───────────────────────────────────────────────────────────────
  async function handleExportPdf() {
    if (!template || !formNumber) return;

    // Validate required fields
    const errors = new Set<string>();
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.required && !fieldValues[field.id]?.trim()) {
          errors.add(field.id);
        }
      }
    }

    if (errors.size > 0) {
      setValidationErrors(errors);
      setShowValidation(true);
      return;
    }

    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ url: string }>(
        'export-bir-form-pdf',
        { body: { recordId, formNumber, clientId, filingPeriod, fieldValues } },
      );

      if (error || !data?.url) throw error;

      const link = document.createElement('a');
      link.href = data.url;
      link.download = `${formNumber}-${clientTin}-${filingPeriod}.pdf`;
      link.click();
    } catch {
      setToast({ open: true, variant: 'error', title: 'Export failed. Please try again.' });
    } finally {
      setExporting(false);
    }
  }

  // ── Field visual state ───────────────────────────────────────────────────────
  function fieldClassName(field: FormField): string {
    if (field.kind === 'readonly') {
      return 'bg-slate-100 text-slate-600 cursor-not-allowed border border-slate-200';
    }
    const isOverride =
      prefilled &&
      prefillData[field.id] !== undefined &&
      fieldValues[field.id] !== prefillData[field.id];
    const isError = showValidation && validationErrors.has(field.id);

    if (isError) return 'border-2 border-red-500 bg-white';
    if (isOverride) return 'border border-slate-200 bg-amber-100';
    return 'border-2 border-teal-600 bg-white';
  }

  const isMissing = (field: FormField) =>
    prefilled &&
    field.required &&
    !fieldValues[field.id]?.trim() &&
    !showValidation;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <ToastProvider swipeDirection="right">
      <div className="flex h-full min-h-0 overflow-hidden">

        {/* ── Main form area ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Top selector bar */}
          <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 flex flex-wrap items-end gap-3">
            {/* Form Type */}
            <div className="space-y-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-500">Form Type</label>
              <Select
                value={formNumber}
                onValueChange={(v) => setFormNumber(v as BIRFormNumber)}
                disabled={prefilling}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select BIR form" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FORM_TEMPLATES) as BIRFormNumber[]).map((fn) => (
                    <SelectItem key={fn} value={fn}>
                      {fn} — {FORM_TEMPLATES[fn].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client */}
            <div className="space-y-1 min-w-[180px]">
              <label className="text-xs font-medium text-slate-500">Client</label>
              <Select
                value={clientId}
                onValueChange={setClientId}
                disabled={loadingClients || prefilling}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue
                    placeholder={loadingClients ? 'Loading…' : 'Select client'}
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

            {/* Filing Period */}
            <div className="space-y-1 min-w-[160px]">
              <label className="text-xs font-medium text-slate-500">Filing Period</label>
              <Select
                value={filingPeriod}
                onValueChange={setFilingPeriod}
                disabled={!formNumber || prefilling}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue
                    placeholder={!formNumber ? 'Select form first' : 'Select period'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pre-fill button */}
            <div className="pb-0.5">
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={!canPrefill}
                onClick={handlePrefill}
              >
                {prefilling ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Pre-filling…
                  </span>
                ) : (
                  'Pre-fill from Data'
                )}
              </Button>
            </div>
          </div>

          {/* Pre-filling status */}
          {prefilling && (
            <div className="shrink-0 px-6 py-2 bg-teal-50 border-b border-teal-100">
              <p className="text-sm text-teal-700 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Pre-filling from transaction data…
              </p>
            </div>
          )}

          {/* Stale template banner */}
          {templateStale && (
            <div className="shrink-0 px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This form template may be outdated. Verify against the current BIR version before filing.
            </div>
          )}

          {/* Validation summary */}
          {showValidation && validationErrors.size > 0 && (
            <div className="shrink-0 mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {validationErrors.size} required field{validationErrors.size !== 1 ? 's' : ''} must be filled before exporting.
              </span>
            </div>
          )}

          {/* Warnings */}
          {prefillWarnings.map((w, i) => (
            <div
              key={i}
              className="shrink-0 mx-6 mt-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-sm text-amber-700"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}

          {/* Scroll area */}
          <div className="flex-1 overflow-y-auto">

            {/* Empty state */}
            {!formNumber && !prefilling && (
              <div className="flex items-center justify-center h-full min-h-[320px]">
                <div className="text-center">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 max-w-xs">
                    Select a BIR form type, client, and filing period — then click Pre-fill from Data.
                  </p>
                </div>
              </div>
            )}

            {/* Applicability error */}
            {formNumber && selectedClient && applicability !== 'ok' && (
              <div className="m-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    {applicability === 'missing_tin' && (
                      <>
                        <p className="text-sm font-medium text-amber-800">Client TIN is required.</p>
                        <p className="text-sm text-amber-700 mt-0.5">
                          Update the client profile with a TIN before preparing tax forms.
                        </p>
                      </>
                    )}
                    {applicability === 'wrong_registration_type' && (
                      <>
                        <p className="text-sm font-medium text-amber-800">
                          This form does not apply to this client&apos;s BIR registration type.
                        </p>
                        {suggestForm(formNumber, selectedClient) && (
                          <p className="text-sm text-amber-700 mt-0.5">
                            Suggested form: {suggestForm(formNumber, selectedClient)}
                          </p>
                        )}
                      </>
                    )}
                    {applicability === 'wrong_business_type' && (
                      <>
                        <p className="text-sm font-medium text-amber-800">
                          This form does not apply to this client&apos;s business type.
                        </p>
                        {suggestForm(formNumber, selectedClient) && (
                          <p className="text-sm text-amber-700 mt-0.5">
                            Suggested form: {suggestForm(formNumber, selectedClient)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            {template && applicability === 'ok' && (
              <div className="p-6 max-w-3xl">
                {/* Form header */}
                <div className="mb-5">
                  <h1 className="text-lg font-semibold text-slate-900">
                    BIR Form {formNumber}
                  </h1>
                  <p className="text-sm text-slate-500">{template.name}</p>
                  {prefilled && selectedClient && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedClient.businessName} · {filingPeriod}
                    </p>
                  )}
                </div>

                {/* Field legend */}
                {prefilled && (
                  <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded border-2 border-teal-600 bg-white" />
                      Editable
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded bg-slate-100 border border-slate-200" />
                      System-populated
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-slate-200" />
                      Manually overridden
                    </span>
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                      Missing data
                    </span>
                  </div>
                )}

                {/* Form sections */}
                <div className="space-y-5">
                  {template.sections.map((section) => (
                    <div
                      key={section.title}
                      className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                    >
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {section.title}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {section.fields.map((field) => (
                          <div
                            key={field.id}
                            className="flex items-center gap-3 px-4 py-2.5"
                          >
                            <label className="w-64 shrink-0 text-sm text-slate-600 leading-snug">
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-0.5">*</span>
                              )}
                            </label>
                            <div className="flex-1 relative">
                              {prefilling ? (
                                <Shimmer />
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    value={fieldValues[field.id] ?? ''}
                                    onChange={
                                      field.kind === 'editable'
                                        ? (e) => handleFieldChange(field.id, e.target.value)
                                        : undefined
                                    }
                                    readOnly={field.kind === 'readonly'}
                                    className={[
                                      'w-full rounded-md px-3 py-2 text-sm outline-none transition-colors',
                                      fieldClassName(field),
                                      'read-only:select-none',
                                    ].join(' ')}
                                    aria-label={field.label}
                                  />
                                  {isMissing(field) && (
                                    <span
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500"
                                      title="Missing data — warning, not blocking"
                                    >
                                      <HelpCircle className="h-4 w-4" />
                                    </span>
                                  )}
                                  {showValidation && validationErrors.has(field.id) && (
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500">
                                      <AlertTriangle className="h-4 w-4" />
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Export */}
                {prefilled && (
                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      disabled={exporting}
                      onClick={handleExportPdf}
                    >
                      {exporting ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Exporting…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Export as PDF
                        </span>
                      )}
                    </Button>
                    <span className="text-xs text-slate-400">
                      {formNumber}-{clientTin || 'TIN'}-{filingPeriod}.pdf
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Prior-year comparison sidebar ─────────────────────────────────── */}
        {/* Desktop: always visible at 320px. Tablet: collapsible toggle. Mobile: hidden. */}

        {/* Tablet toggle button */}
        <button
          className="hidden md:flex xl:hidden shrink-0 w-8 border-l border-slate-200 bg-white items-center justify-center hover:bg-slate-50 transition-colors"
          onClick={() => setPriorYearOpen((o) => !o)}
          aria-label={priorYearOpen ? 'Collapse prior-year sidebar' : 'Expand prior-year sidebar'}
        >
          <ChevronRight
            className={[
              'h-4 w-4 text-slate-400 transition-transform',
              priorYearOpen ? 'rotate-180' : '',
            ].join(' ')}
          />
        </button>

        <div
          className={[
            'shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden transition-all',
            // Desktop: always 320px
            'xl:w-80 xl:flex',
            // Tablet: collapsible
            'hidden md:flex',
            priorYearOpen ? 'md:w-80' : 'md:w-0',
          ].join(' ')}
        >
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Prior Year Comparison
            </span>
            {priorYearLabel && (
              <span className="text-xs text-slate-400">{priorYearLabel}</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!prefilled && (
              <div className="flex items-center justify-center h-32">
                <p className="text-xs text-slate-400 px-4 text-center">
                  Pre-fill the form to see prior-year comparison.
                </p>
              </div>
            )}

            {prefilled && priorYearData === null && (
              <div className="flex items-center justify-center h-32">
                <p className="text-xs text-slate-400 px-4 text-center">
                  No prior-year data available.
                </p>
              </div>
            )}

            {prefilled && priorYearData && template && (
              <div className="p-3 space-y-4">
                {template.sections.map((section) => (
                  <div key={section.title}>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">
                      {section.title}
                    </p>
                    <div className="space-y-0.5">
                      {section.fields.map((field) => {
                        const prior = priorYearData[field.id];
                        const current = fieldValues[field.id];
                        const diff = formatFieldDiff(current, prior);

                        return (
                          <div
                            key={field.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50"
                          >
                            <span className="flex-1 text-xs text-slate-500 leading-snug truncate">
                              {field.label.replace(/\s*\(₱\)/, '')}
                            </span>
                            <span className="text-xs text-slate-700 tabular-nums shrink-0">
                              {prior ?? '—'}
                            </span>
                            {diff && (
                              <span
                                className={[
                                  'flex items-center gap-0.5 text-[10px] font-medium shrink-0',
                                  diff.up ? 'text-green-600' : 'text-red-500',
                                ].join(' ')}
                              >
                                {diff.up ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {diff.pct}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="pt-2 border-t border-slate-100 px-1">
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Values from {priorYearLabel}. % change vs current pre-filled values.
                  </p>
                </div>
              </div>
            )}
          </div>
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
