import { z } from 'zod';

// ─── Primitives ───────────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid();

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date (YYYY-MM-DD)')
  .refine((v) => !isNaN(Date.parse(v)), 'Must be a valid date');

const amountSchema = z
  .string()
  .regex(/^\d{1,13}\.\d{2}$/, 'Must be a positive decimal with exactly 2 decimal places');

const tinSchema = z
  .string()
  .regex(/^\d{3}-\d{3}-\d{3}(-\d{3})?$/, 'Must match format ###-###-###[-###]');

const emailSchema = z.string().email();

// ─── Enum schemas ─────────────────────────────────────────────────────────────

const leadSourceSchema = z.enum(['website_form', 'cal_booking', 'referral', 'manual']);

const leadStageSchema = z.enum([
  'lead',
  'contacted',
  'call_booked',
  'proposal_sent',
  'negotiation',
  'closed_won',
  'closed_lost',
]);

const businessTypeSchema = z.enum(['sole_prop', 'opc', 'corporation']);

const birRegistrationTypeSchema = z.enum(['vat', 'non_vat']);

const revenueBracketSchema = z.enum([
  'below_250k',
  '250k_500k',
  '500k_1m',
  '1m_3m',
  'above_3m',
]);

const clientStatusSchema = z.enum(['active', 'inactive']);

const transactionTypeSchema = z.enum(['credit', 'debit']);

const transactionStatusSchema = z.enum([
  'pending',
  'in_review',
  'approved',
  'rejected',
  'manual_entry_required',
]);

const documentTypeGuessSchema = z.enum([
  'receipt',
  'bank_statement',
  'invoice',
  'credit_card_statement',
  'expense_report',
  'payroll_data',
  'other',
]);

const invoiceStatusSchema = z.enum(['draft', 'sent', 'paid']);

const taskPrioritySchema = z.enum(['low', 'medium', 'high']);

const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);

const deadlineTypeSchema = z.enum([
  'monthly_bookkeeping',
  'monthly_vat',
  'quarterly_bir',
  'quarterly_financials',
  'annual_itr',
  'annual_financials',
]);

const deadlineStatusSchema = z.enum(['upcoming', 'in_progress', 'completed']);

const reportTypeSchema = z.enum([
  'profit_and_loss',
  'balance_sheet',
  'cash_flow',
  'bank_reconciliation',
  'ar_ageing',
  'ap_ageing',
  'general_ledger',
  'trial_balance',
]);

const birFormNumberSchema = z.enum([
  '2551Q',
  '2550M',
  '2550Q',
  '1701',
  '1701Q',
  '1702',
  '1702Q',
  '1601-C',
  '1601-EQ',
  '0619-E',
  '0619-F',
]);

const taxFormStatusSchema = z.enum([
  'draft',
  'prefill_pending',
  'prefill_complete',
  'exported',
]);

const accountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);

const userRoleSchema = z.enum(['admin', 'accountant']);

// ─── Edge Function request schemas ────────────────────────────────────────────

/** POST /functions/v1/handle-contact-form */
export const contactFormSchema = z.object({
  businessName: z.string().min(1).max(255),
  contactName: z.string().min(1).max(255),
  contactEmail: emailSchema,
  contactPhone: z.string().max(50).optional(),
  message: z.string().min(10).max(1000),
});

/** Lead create/update */
export const createLeadSchema = z.object({
  businessName: z.string().min(1).max(255),
  contactName: z.string().min(1).max(255),
  contactEmail: emailSchema,
  contactPhone: z.string().max(50).optional(),
  source: leadSourceSchema,
  stage: leadStageSchema.optional(),
  notes: z.string().max(10000).optional(),
});

export const updateLeadSchema = z.object({
  businessName: z.string().min(1).max(255).optional(),
  contactName: z.string().min(1).max(255).optional(),
  contactEmail: emailSchema.optional(),
  contactPhone: z.string().max(50).nullable().optional(),
  source: leadSourceSchema.optional(),
  stage: leadStageSchema.optional(),
  closeReason: z.string().max(500).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
});

/** Client create/update */
export const createClientSchema = z.object({
  businessName: z.string().min(1).max(255),
  businessType: businessTypeSchema,
  tin: tinSchema,
  registeredAddress: z.string().min(1).max(500),
  industry: z.string().min(1).max(255),
  birRegistrationType: birRegistrationTypeSchema,
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  gmailAddress: emailSchema,
  monthlyRevenueBracket: revenueBracketSchema,
  googleSheetFolderUrl: z.string().url().optional(),
  convertedFromLeadId: uuidSchema.optional(),
});

export const updateClientSchema = z.object({
  businessName: z.string().min(1).max(255).optional(),
  businessType: businessTypeSchema.optional(),
  tin: tinSchema.optional(),
  registeredAddress: z.string().min(1).max(500).optional(),
  industry: z.string().min(1).max(255).optional(),
  birRegistrationType: birRegistrationTypeSchema.optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  gmailAddress: emailSchema.optional(),
  monthlyRevenueBracket: revenueBracketSchema.optional(),
  googleSheetFolderUrl: z.string().url().nullable().optional(),
  status: clientStatusSchema.optional(),
});

/** Transaction create/update */
export const createTransactionSchema = z.object({
  clientId: uuidSchema,
  date: isoDateSchema,
  description: z.string().min(1).max(255),
  amount: amountSchema,
  currency: z.string().length(3).optional(),
  type: transactionTypeSchema,
  categoryCode: z.string().min(1).max(20),
  sourceEmailNotificationId: uuidSchema.optional(),
  sourceDocumentAttachmentId: uuidSchema.optional(),
});

export const updateTransactionSchema = z.object({
  date: isoDateSchema.optional(),
  description: z.string().min(1).max(255).optional(),
  amount: amountSchema.optional(),
  type: transactionTypeSchema.optional(),
  categoryCode: z.string().min(1).max(20).optional(),
  status: transactionStatusSchema.optional(),
  rejectionReason: z.string().max(500).nullable().optional(),
});

export const approveTransactionSchema = z.object({
  transactionId: uuidSchema,
});

export const rejectTransactionSchema = z.object({
  transactionId: uuidSchema,
  rejectionReason: z.string().min(1).max(500),
});

/** Invoice create */
export const invoiceLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: amountSchema,
});

export const createInvoiceSchema = z.object({
  clientId: uuidSchema,
  lineItems: z.array(invoiceLineItemSchema).min(1),
  issueDate: isoDateSchema,
  dueDate: isoDateSchema,
  notes: z.string().max(2000).optional(),
}).refine(
  (d) => new Date(d.dueDate) >= new Date(d.issueDate),
  { message: 'dueDate must be on or after issueDate', path: ['dueDate'] },
);

export const updateInvoiceSchema = z.object({
  status: invoiceStatusSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  dueDate: isoDateSchema.optional(),
});

/** Task create/update */
export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  dueDate: isoDateSchema,
  linkedEntityType: z.enum(['lead', 'client']).optional(),
  linkedEntityId: uuidSchema.optional(),
  priority: taskPrioritySchema.optional(),
}).refine(
  (d) => (d.linkedEntityType === undefined) === (d.linkedEntityId === undefined),
  { message: 'linkedEntityType and linkedEntityId must both be set or both be omitted' },
);

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  dueDate: isoDateSchema.optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
});

/** Deadline create/update */
export const createDeadlineSchema = z.object({
  clientId: uuidSchema,
  deadlineType: deadlineTypeSchema,
  dueDate: isoDateSchema,
  period: z.string().min(1).max(50),
  notes: z.string().max(1000).optional(),
});

export const updateDeadlineSchema = z.object({
  status: deadlineStatusSchema.optional(),
  dueDate: isoDateSchema.optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** Report generation */
export const generateReportSchema = z
  .object({
    clientId: uuidSchema,
    reportType: reportTypeSchema,
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
  })
  .refine(
    (d) => new Date(d.periodEnd) >= new Date(d.periodStart),
    { message: 'periodEnd must be on or after periodStart', path: ['periodEnd'] },
  );

export const generateNarrativeSchema = z.object({
  reportId: uuidSchema,
});

export const approveNarrativeSchema = z.object({
  reportId: uuidSchema,
});

/** BIR tax form */
export const prefillBIRFormSchema = z.object({
  clientId: uuidSchema,
  formNumber: birFormNumberSchema,
  filingPeriod: z.string().min(1).max(20),
});

export const updateBIRFormSchema = z.object({
  recordId: uuidSchema,
  manualOverrides: z.record(z.string()),
});

export const exportBIRFormSchema = z.object({
  recordId: uuidSchema,
});

/** Email operations */
export const sendEmailSchema = z.object({
  clientId: uuidSchema,
  subject: z.string().min(1).max(255),
  body: z.string().min(1).max(5000),
  draftEmailId: uuidSchema.optional(),
});

export const classifyEmailSchema = z.object({
  emailNotificationId: uuidSchema,
});

export const dismissEmailSchema = z.object({
  emailNotificationId: uuidSchema,
});

/** Gmail connection */
export const connectGmailSchema = z.object({
  clientId: uuidSchema,
  authCode: z.string().min(1),
});

/** Document extraction */
export const extractDocumentSchema = z.object({
  attachmentId: uuidSchema,
  emailNotificationId: uuidSchema,
});

/** PDF rendering */
export const renderPdfSchema = z.object({
  type: z.enum(['report', 'bir_form', 'invoice']),
  id: uuidSchema,
});

/** Google Sheets export */
export const exportToSheetsSchema = z
  .object({
    clientId: uuidSchema,
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
  })
  .refine(
    (d) => new Date(d.periodEnd) >= new Date(d.periodStart),
    { message: 'periodEnd must be on or after periodStart', path: ['periodEnd'] },
  );

// ─── Re-export primitive schemas for consumers ────────────────────────────────

export {
  uuidSchema,
  isoDateSchema,
  amountSchema,
  tinSchema,
  emailSchema,
  leadSourceSchema,
  leadStageSchema,
  businessTypeSchema,
  birRegistrationTypeSchema,
  revenueBracketSchema,
  clientStatusSchema,
  transactionTypeSchema,
  transactionStatusSchema,
  documentTypeGuessSchema,
  invoiceStatusSchema,
  taskPrioritySchema,
  taskStatusSchema,
  deadlineTypeSchema,
  deadlineStatusSchema,
  reportTypeSchema,
  birFormNumberSchema,
  taxFormStatusSchema,
  accountTypeSchema,
  userRoleSchema,
};
