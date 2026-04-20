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


// ─── Generated types (via supabase gen types typescript) ─────────────────────
// Source of truth: live Supabase schema for project lkjqdgizzuhykmxntvcx

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_corrections: {
        Row: {
          corrected_by: string
          corrected_value: string
          correction_source: string
          created_at: string
          field_name: string
          id: string
          original_value: string
          transaction_id: string
        }
        Insert: {
          corrected_by: string
          corrected_value: string
          correction_source?: string
          created_at?: string
          field_name: string
          id?: string
          original_value: string
          transaction_id: string
        }
        Update: {
          corrected_by?: string
          corrected_value?: string
          correction_source?: string
          created_at?: string
          field_name?: string
          id?: string
          original_value?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_corrections_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      bir_form_field_mappings: {
        Row: {
          created_at: string
          display_order: number
          field_code: string
          field_label: string
          id: string
          is_editable: boolean
          is_required: boolean
          mapping_expression: Json
          mapping_type: BIRFieldMappingType
          section: string | null
          template_id: string
        }
        Insert: {
          created_at?: string
          display_order: number
          field_code: string
          field_label: string
          id?: string
          is_editable?: boolean
          is_required?: boolean
          mapping_expression: Json
          mapping_type: BIRFieldMappingType
          section?: string | null
          template_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_code?: string
          field_label?: string
          id?: string
          is_editable?: boolean
          is_required?: boolean
          mapping_expression?: Json
          mapping_type?: BIRFieldMappingType
          section?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bir_form_field_mappings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bir_form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bir_form_templates: {
        Row: {
          applicable_to: string[]
          created_at: string
          form_number: string
          form_title: string
          id: string
          is_current: boolean
          template_layout: Json
          updated_at: string
          version: string
        }
        Insert: {
          applicable_to: string[]
          created_at?: string
          form_number: string
          form_title: string
          id?: string
          is_current?: boolean
          template_layout: Json
          updated_at?: string
          version: string
        }
        Update: {
          applicable_to?: string[]
          created_at?: string
          form_number?: string
          form_title?: string
          id?: string
          is_current?: boolean
          template_layout?: Json
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      bir_tax_form_records: {
        Row: {
          client_id: string
          created_at: string
          exported_pdf_path: string | null
          filing_period: string
          form_number: BIRFormNumber
          id: string
          manual_overrides: Json
          prefill_data: Json
          status: TaxFormStatus
          template_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          exported_pdf_path?: string | null
          filing_period: string
          form_number: BIRFormNumber
          id?: string
          manual_overrides?: Json
          prefill_data?: Json
          status?: TaxFormStatus
          template_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          exported_pdf_path?: string | null
          filing_period?: string
          form_number?: BIRFormNumber
          id?: string
          manual_overrides?: Json
          prefill_data?: Json
          status?: TaxFormStatus
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bir_tax_form_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bir_tax_form_records_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bir_form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: AccountType
          code: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          normal_balance: NormalBalance
          parent_code: string | null
          updated_at: string
        }
        Insert: {
          account_type: AccountType
          code: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          normal_balance: NormalBalance
          parent_code?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: AccountType
          code?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          normal_balance?: NormalBalance
          parent_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["code"]
          },
        ]
      }
      client_activity_log: {
        Row: {
          action: string
          client_id: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          client_id: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          client_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_activity_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activity_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          bir_registration_type: BIRRegistrationType
          business_name: string
          business_phone: string | null
          business_type: BusinessType
          contact_name: string | null
          contact_phone: string | null
          converted_from_lead_id: string | null
          created_at: string
          fiscal_year_start_month: number
          gmail_address: string
          google_sheet_folder_url: string | null
          id: string
          industry: string
          monthly_revenue_bracket: RevenueBracket
          registered_address: string
          status: ClientStatus
          tin: string
          updated_at: string
        }
        Insert: {
          bir_registration_type: BIRRegistrationType
          business_name: string
          business_phone?: string | null
          business_type: BusinessType
          contact_name?: string | null
          contact_phone?: string | null
          converted_from_lead_id?: string | null
          created_at?: string
          fiscal_year_start_month: number
          gmail_address: string
          google_sheet_folder_url?: string | null
          id?: string
          industry: string
          monthly_revenue_bracket: RevenueBracket
          registered_address: string
          status?: ClientStatus
          tin: string
          updated_at?: string
        }
        Update: {
          bir_registration_type?: BIRRegistrationType
          business_name?: string
          business_phone?: string | null
          business_type?: BusinessType
          contact_name?: string | null
          contact_phone?: string | null
          converted_from_lead_id?: string | null
          created_at?: string
          fiscal_year_start_month?: number
          gmail_address?: string
          google_sheet_folder_url?: string | null
          id?: string
          industry?: string
          monthly_revenue_bracket?: RevenueBracket
          registered_address?: string
          status?: ClientStatus
          tin?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      deadlines: {
        Row: {
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          deadline_type: DeadlineType
          due_date: string
          id: string
          notes: string | null
          period_label: string
          status: DeadlineStatus
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deadline_type: DeadlineType
          due_date: string
          id?: string
          notes?: string | null
          period_label: string
          status?: DeadlineStatus
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deadline_type?: DeadlineType
          due_date?: string
          id?: string
          notes?: string | null
          period_label?: string
          status?: DeadlineStatus
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_attachments: {
        Row: {
          created_at: string
          email_notification_id: string
          file_size_bytes: number
          id: string
          mime_type: string
          original_filename: string
          page_count: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          email_notification_id: string
          file_size_bytes: number
          id?: string
          mime_type: string
          original_filename: string
          page_count?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          email_notification_id?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          original_filename?: string
          page_count?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_email_notification_id_fkey"
            columns: ["email_notification_id"]
            isOneToOne: false
            referencedRelation: "email_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_emails: {
        Row: {
          body: string
          client_id: string
          created_at: string
          deadline_id: string | null
          id: string
          reviewed_by: string | null
          sent_at: string | null
          status: DraftEmailStatus
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          deadline_id?: string | null
          id?: string
          reviewed_by?: string | null
          sent_at?: string | null
          status?: DraftEmailStatus
          subject: string
          template_type: string
          updated_at?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          deadline_id?: string | null
          id?: string
          reviewed_by?: string | null
          sent_at?: string | null
          status?: DraftEmailStatus
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_emails_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_emails_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          auto_dismissed: boolean
          classification_confidence: number | null
          client_id: string | null
          created_at: string
          document_type_guess: DocumentTypeGuess | null
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          is_document: boolean
          processed_by: string | null
          processing_error: string | null
          processing_started_at: string | null
          received_at: string
          sender_email: string
          sender_name: string | null
          snippet: string | null
          status: EmailNotificationStatus
          subject: string
          updated_at: string
        }
        Insert: {
          auto_dismissed?: boolean
          classification_confidence?: number | null
          client_id?: string | null
          created_at?: string
          document_type_guess?: DocumentTypeGuess | null
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          is_document?: boolean
          processed_by?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          received_at: string
          sender_email: string
          sender_name?: string | null
          snippet?: string | null
          status?: EmailNotificationStatus
          subject: string
          updated_at?: string
        }
        Update: {
          auto_dismissed?: boolean
          classification_confidence?: number | null
          client_id?: string | null
          created_at?: string
          document_type_guess?: DocumentTypeGuess | null
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          is_document?: boolean
          processed_by?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          received_at?: string
          sender_email?: string
          sender_name?: string | null
          snippet?: string | null
          status?: EmailNotificationStatus
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_reports: {
        Row: {
          ai_narrative: string | null
          ai_narrative_approved: boolean
          ai_narrative_approved_at: string | null
          ai_narrative_approved_by: string | null
          client_id: string
          created_at: string
          exported_pdf_path: string | null
          exported_sheets_url: string | null
          generated_at: string
          generated_by: string
          id: string
          period_end: string
          period_start: string
          report_type: ReportType
        }
        Insert: {
          ai_narrative?: string | null
          ai_narrative_approved?: boolean
          ai_narrative_approved_at?: string | null
          ai_narrative_approved_by?: string | null
          client_id: string
          created_at?: string
          exported_pdf_path?: string | null
          exported_sheets_url?: string | null
          generated_at?: string
          generated_by: string
          id?: string
          period_end: string
          period_start: string
          report_type: ReportType
        }
        Update: {
          ai_narrative?: string | null
          ai_narrative_approved?: boolean
          ai_narrative_approved_at?: string | null
          ai_narrative_approved_by?: string | null
          client_id?: string
          created_at?: string
          exported_pdf_path?: string | null
          exported_sheets_url?: string | null
          generated_at?: string
          generated_by?: string
          id?: string
          period_end?: string
          period_start?: string
          report_type?: ReportType
        }
        Relationships: [
          {
            foreignKeyName: "financial_reports_ai_narrative_approved_by_fkey"
            columns: ["ai_narrative_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          access_token_encrypted: string
          created_at: string
          gmail_email: string
          id: string
          last_error: string | null
          refresh_token_encrypted: string
          status: GmailConnectionStatus
          token_expires_at: string
          updated_at: string
          user_id: string
          watch_expiration: string | null
          watch_history_id: string | null
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          gmail_email: string
          id?: string
          last_error?: string | null
          refresh_token_encrypted: string
          status?: GmailConnectionStatus
          token_expires_at: string
          updated_at?: string
          user_id: string
          watch_expiration?: string | null
          watch_history_id?: string | null
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          gmail_email?: string
          id?: string
          last_error?: string | null
          refresh_token_encrypted?: string
          status?: GmailConnectionStatus
          token_expires_at?: string
          updated_at?: string
          user_id?: string
          watch_expiration?: string | null
          watch_history_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          invoice_id: string
          line_total: string
          quantity: number
          unit_price: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number
          id?: string
          invoice_id: string
          line_total?: string
          quantity: number
          unit_price: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          invoice_id?: string
          line_total?: string
          quantity?: number
          unit_price?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          due_date: string
          gmail_message_id: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          sent_at: string | null
          status: InvoiceStatus
          subtotal: string
          total_amount: string
          updated_at: string
          vat_amount: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          due_date: string
          gmail_message_id?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: InvoiceStatus
          subtotal: string
          total_amount: string
          updated_at?: string
          vat_amount?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          due_date?: string
          gmail_message_id?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          sent_at?: string | null
          status?: InvoiceStatus
          subtotal?: string
          total_amount?: string
          updated_at?: string
          vat_amount?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          lead_id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          lead_id: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          lead_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          business_name: string
          close_reason: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          source: LeadSource
          stage: LeadStage
          updated_at: string
        }
        Insert: {
          business_name: string
          close_reason?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          source: LeadSource
          stage?: LeadStage
          updated_at?: string
        }
        Update: {
          business_name?: string
          close_reason?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          source?: LeadSource
          stage?: LeadStage
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          priority: TaskPriority
          status: TaskStatus
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          priority?: TaskPriority
          status?: TaskStatus
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          priority?: TaskPriority
          status?: TaskStatus
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: string
          approved_at: string | null
          approved_by: string | null
          category_code: string | null
          category_confidence: number | null
          client_id: string
          created_at: string
          currency: string
          date: string
          description: string
          extraction_batch_id: string | null
          extraction_page_number: number | null
          id: string
          rejection_reason: string | null
          source_document_attachment_id: string | null
          source_email_notification_id: string | null
          status: TransactionStatus
          type: TransactionType
          updated_at: string
        }
        Insert: {
          amount: string
          approved_at?: string | null
          approved_by?: string | null
          category_code?: string | null
          category_confidence?: number | null
          client_id: string
          created_at?: string
          currency?: string
          date: string
          description: string
          extraction_batch_id?: string | null
          extraction_page_number?: number | null
          id?: string
          rejection_reason?: string | null
          source_document_attachment_id?: string | null
          source_email_notification_id?: string | null
          status?: TransactionStatus
          type: TransactionType
          updated_at?: string
        }
        Update: {
          amount?: string
          approved_at?: string | null
          approved_by?: string | null
          category_code?: string | null
          category_confidence?: number | null
          client_id?: string
          created_at?: string
          currency?: string
          date?: string
          description?: string
          extraction_batch_id?: string | null
          extraction_page_number?: number | null
          id?: string
          rejection_reason?: string | null
          source_document_attachment_id?: string | null
          source_email_notification_id?: string | null
          status?: TransactionStatus
          type?: TransactionType
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_document_attachment_id_fkey"
            columns: ["source_document_attachment_id"]
            isOneToOne: false
            referencedRelation: "document_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_source_email_notification_id_fkey"
            columns: ["source_email_notification_id"]
            isOneToOne: false
            referencedRelation: "email_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: UserRole
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role: UserRole
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: UserRole
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_correction_rates: {
        Args: { p_days: number }
        Returns: {
          corrections: number
          field_name: string
          transactions_corrected: number
        }[]
      }
      get_financial_summary: {
        Args: {
          p_client_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
