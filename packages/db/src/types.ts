// @numera/db — TypeScript entity interfaces and enums

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'accountant';

export type LeadSource = 'website_form' | 'cal_booking' | 'referral' | 'manual' | 'google' | 'facebook';

export type LeadStage =
  | 'lead'
  | 'contacted'
  | 'call_booked'
  | 'proposal_sent'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export type BusinessType = 'sole_prop' | 'opc' | 'corporation';

export type BIRRegistrationType = 'vat' | 'non_vat';

export type RevenueBracket =
  | 'below_250k'
  | '250k_500k'
  | '500k_1m'
  | '1m_3m'
  | 'above_3m';

export type ClientStatus = 'active' | 'inactive';

export type TransactionType = 'credit' | 'debit';

export type TransactionStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'manual_entry_required';

export type EmailNotificationStatus =
  | 'unprocessed'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'dismissed';

export type DocumentTypeGuess =
  | 'receipt'
  | 'bank_statement'
  | 'invoice'
  | 'credit_card_statement'
  | 'expense_report'
  | 'payroll_data'
  | 'other';

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type DeadlineType =
  | 'monthly_bookkeeping'
  | 'monthly_vat'
  | 'quarterly_bir'
  | 'quarterly_financials'
  | 'annual_itr'
  | 'annual_financials';

export type DeadlineStatus = 'upcoming' | 'in_progress' | 'completed';

export type ReportType =
  | 'profit_and_loss'
  | 'balance_sheet'
  | 'cash_flow'
  | 'bank_reconciliation'
  | 'ar_ageing'
  | 'ap_ageing'
  | 'general_ledger'
  | 'trial_balance';

export type BIRFormNumber =
  | '2551Q'
  | '2550M'
  | '2550Q'
  | '1701'
  | '1701Q'
  | '1702'
  | '1702Q'
  | '1601-C'
  | '1601-EQ'
  | '0619-E'
  | '0619-F';

export type TaxFormStatus = 'draft' | 'prefill_pending' | 'prefill_complete' | 'exported';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type NormalBalance = 'debit' | 'credit';

export type GmailConnectionStatus = 'active' | 'token_expired' | 'revoked' | 'error';

export type BIRFieldMappingType =
  | 'sum_category'
  | 'sum_account_type'
  | 'computed'
  | 'static'
  | 'client_field';

export type DraftEmailStatus = 'pending_review' | 'approved' | 'sent' | 'discarded';

// ─── Entity interfaces ────────────────────────────────────────────────────────

export interface User {
  id: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  source: LeadSource;
  stage: LeadStage;
  closeReason?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivityLog {
  id: string;
  leadId: string;
  action: string;
  details?: Record<string, unknown>;
  performedBy?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  businessName: string;
  businessType: BusinessType;
  tin: string;
  registeredAddress: string;
  industry: string;
  birRegistrationType: BIRRegistrationType;
  fiscalYearStartMonth: number;
  gmailAddress: string;
  monthlyRevenueBracket: RevenueBracket;
  googleSheetFolderUrl?: string;
  contactName?: string;
  contactPhone?: string;
  businessPhone?: string;
  status: ClientStatus;
  convertedFromLeadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChartOfAccountsCategory {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode?: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailNotification {
  id: string;
  gmailMessageId: string;
  clientId?: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
  documentTypeGuess?: DocumentTypeGuess;
  classificationConfidence?: number;
  status: EmailNotificationStatus;
  processingError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentAttachment {
  id: string;
  emailNotificationId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  clientId: string;
  date: string;
  description: string;
  amount: string;
  currency: string;
  type: TransactionType;
  categoryCode: string;
  categoryConfidence?: number;
  sourceEmailNotificationId?: string;
  sourceDocumentAttachmentId?: string;
  status: TransactionStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  displayOrder: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  lineItems?: InvoiceLineItem[];
  subtotal: string;
  vatAmount?: string;
  totalAmount: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  sentAt?: string;
  paidAt?: string;
  gmailMessageId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  linkedEntityType?: 'lead' | 'client';
  linkedEntityId?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deadline {
  id: string;
  clientId: string;
  deadlineType: DeadlineType;
  dueDate: string;
  period: string;
  status: DeadlineStatus;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialReport {
  id: string;
  clientId: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  generatedBy: string;
  aiNarrative?: string;
  aiNarrativeApproved: boolean;
  exportedPdfPath?: string;
  createdAt: string;
}

export interface BIRTaxFormRecord {
  id: string;
  clientId: string;
  templateId: string;
  formNumber: BIRFormNumber;
  filingPeriod: string;
  status: TaxFormStatus;
  prefillData: Record<string, string>;
  manualOverrides: Record<string, string>;
  exportedPdfPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DraftEmail {
  id: string;
  clientId: string;
  deadlineId?: string;
  templateType: string;
  subject: string;
  body: string;
  status: DraftEmailStatus;
  reviewedBy?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Database type (matches Supabase generated types shape) ──────────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
      };
      leads: {
        Row: {
          id: string;
          business_name: string;
          contact_name: string;
          contact_email: string;
          contact_phone: string | null;
          source: LeadSource;
          stage: LeadStage;
          close_reason: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name: string;
          contact_name: string;
          contact_email: string;
          contact_phone?: string | null;
          source: LeadSource;
          stage?: LeadStage;
          close_reason?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          contact_name?: string;
          contact_email?: string;
          contact_phone?: string | null;
          source?: LeadSource;
          stage?: LeadStage;
          close_reason?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          business_name: string;
          business_type: BusinessType;
          tin: string;
          registered_address: string;
          industry: string;
          bir_registration_type: BIRRegistrationType;
          fiscal_year_start_month: number;
          gmail_address: string;
          monthly_revenue_bracket: RevenueBracket;
          google_sheet_folder_url: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          business_phone: string | null;
          status: ClientStatus;
          converted_from_lead_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name: string;
          business_type: BusinessType;
          tin: string;
          registered_address: string;
          industry: string;
          bir_registration_type: BIRRegistrationType;
          fiscal_year_start_month: number;
          gmail_address: string;
          monthly_revenue_bracket: RevenueBracket;
          google_sheet_folder_url?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          business_phone?: string | null;
          status?: ClientStatus;
          converted_from_lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          business_type?: BusinessType;
          tin?: string;
          registered_address?: string;
          industry?: string;
          bir_registration_type?: BIRRegistrationType;
          fiscal_year_start_month?: number;
          gmail_address?: string;
          monthly_revenue_bracket?: RevenueBracket;
          google_sheet_folder_url?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          business_phone?: string | null;
          status?: ClientStatus;
          converted_from_lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chart_of_accounts: {
        Row: {
          code: string;
          name: string;
          type: AccountType;
          normal_balance: NormalBalance;
          parent_code: string | null;
          is_active: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: string;
          type: AccountType;
          normal_balance: NormalBalance;
          parent_code?: string | null;
          is_active?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          type?: AccountType;
          normal_balance?: NormalBalance;
          parent_code?: string | null;
          is_active?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_notifications: {
        Row: {
          id: string;
          gmail_message_id: string;
          client_id: string | null;
          sender_email: string;
          subject: string;
          received_at: string;
          document_type_guess: DocumentTypeGuess | null;
          classification_confidence: number | null;
          status: EmailNotificationStatus;
          processing_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gmail_message_id: string;
          client_id?: string | null;
          sender_email: string;
          subject: string;
          received_at: string;
          document_type_guess?: DocumentTypeGuess | null;
          classification_confidence?: number | null;
          status?: EmailNotificationStatus;
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gmail_message_id?: string;
          client_id?: string | null;
          sender_email?: string;
          subject?: string;
          received_at?: string;
          document_type_guess?: DocumentTypeGuess | null;
          classification_confidence?: number | null;
          status?: EmailNotificationStatus;
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          client_id: string;
          date: string;
          description: string;
          amount: string;
          currency: string;
          type: TransactionType;
          category_code: string;
          category_confidence: number | null;
          source_email_notification_id: string | null;
          source_document_attachment_id: string | null;
          status: TransactionStatus;
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          date: string;
          description: string;
          amount: string;
          currency?: string;
          type: TransactionType;
          category_code: string;
          category_confidence?: number | null;
          source_email_notification_id?: string | null;
          source_document_attachment_id?: string | null;
          status?: TransactionStatus;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          date?: string;
          description?: string;
          amount?: string;
          currency?: string;
          type?: TransactionType;
          category_code?: string;
          category_confidence?: number | null;
          source_email_notification_id?: string | null;
          source_document_attachment_id?: string | null;
          status?: TransactionStatus;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: string;
          client_id: string;
          subtotal: string;
          vat_amount: string | null;
          total_amount: string;
          issue_date: string;
          due_date: string;
          status: InvoiceStatus;
          sent_at: string | null;
          paid_at: string | null;
          gmail_message_id: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          client_id: string;
          subtotal: string;
          vat_amount?: string | null;
          total_amount: string;
          issue_date: string;
          due_date: string;
          status?: InvoiceStatus;
          sent_at?: string | null;
          paid_at?: string | null;
          gmail_message_id?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          client_id?: string;
          subtotal?: string;
          vat_amount?: string | null;
          total_amount?: string;
          issue_date?: string;
          due_date?: string;
          status?: InvoiceStatus;
          sent_at?: string | null;
          paid_at?: string | null;
          gmail_message_id?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: string;
          line_total: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string;
          quantity?: number;
          unit_price?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          due_date: string;
          linked_entity_type: 'lead' | 'client' | null;
          linked_entity_id: string | null;
          priority: TaskPriority;
          status: TaskStatus;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          due_date: string;
          linked_entity_type?: 'lead' | 'client' | null;
          linked_entity_id?: string | null;
          priority?: TaskPriority;
          status?: TaskStatus;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          due_date?: string;
          linked_entity_type?: 'lead' | 'client' | null;
          linked_entity_id?: string | null;
          priority?: TaskPriority;
          status?: TaskStatus;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      deadlines: {
        Row: {
          id: string;
          client_id: string;
          deadline_type: DeadlineType;
          due_date: string;
          period: string;
          status: DeadlineStatus;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          deadline_type: DeadlineType;
          due_date: string;
          period: string;
          status?: DeadlineStatus;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          deadline_type?: DeadlineType;
          due_date?: string;
          period?: string;
          status?: DeadlineStatus;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      financial_reports: {
        Row: {
          id: string;
          client_id: string;
          report_type: ReportType;
          period_start: string;
          period_end: string;
          generated_at: string;
          generated_by: string;
          ai_narrative: string | null;
          ai_narrative_approved: boolean;
          exported_pdf_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          report_type: ReportType;
          period_start: string;
          period_end: string;
          generated_at?: string;
          generated_by: string;
          ai_narrative?: string | null;
          ai_narrative_approved?: boolean;
          exported_pdf_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          report_type?: ReportType;
          period_start?: string;
          period_end?: string;
          generated_at?: string;
          generated_by?: string;
          ai_narrative?: string | null;
          ai_narrative_approved?: boolean;
          exported_pdf_path?: string | null;
          created_at?: string;
        };
      };
      bir_tax_form_records: {
        Row: {
          id: string;
          client_id: string;
          template_id: string;
          form_number: string;
          filing_period: string;
          status: TaxFormStatus;
          prefill_data: Record<string, string>;
          manual_overrides: Record<string, string>;
          exported_pdf_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          template_id: string;
          form_number: string;
          filing_period: string;
          status?: TaxFormStatus;
          prefill_data?: Record<string, string>;
          manual_overrides?: Record<string, string>;
          exported_pdf_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          template_id?: string;
          form_number?: string;
          filing_period?: string;
          status?: TaxFormStatus;
          prefill_data?: Record<string, string>;
          manual_overrides?: Record<string, string>;
          exported_pdf_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      draft_emails: {
        Row: {
          id: string;
          client_id: string;
          deadline_id: string | null;
          template_type: string;
          subject: string;
          body: string;
          status: DraftEmailStatus;
          reviewed_by: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          deadline_id?: string | null;
          template_type: string;
          subject: string;
          body: string;
          status?: DraftEmailStatus;
          reviewed_by?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          deadline_id?: string | null;
          template_type?: string;
          subject?: string;
          body?: string;
          status?: DraftEmailStatus;
          reviewed_by?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_corrections: {
        Row: {
          id: string;
          transaction_id: string;
          field_name: string;
          original_value: string;
          corrected_value: string;
          corrected_by: string;
          correction_source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          field_name: string;
          original_value: string;
          corrected_value: string;
          corrected_by: string;
          correction_source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          field_name?: string;
          original_value?: string;
          corrected_value?: string;
          corrected_by?: string;
          correction_source?: string;
          created_at?: string;
        };
      };
      system_settings: {
        Row: {
          key: string;
          value: unknown;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: unknown;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: unknown;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      document_attachments: {
        Row: {
          id: string;
          email_notification_id: string;
          filename: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          email_notification_id: string;
          filename: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email_notification_id?: string;
          filename?: string;
          storage_path?: string;
          mime_type?: string;
          size_bytes?: number;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
