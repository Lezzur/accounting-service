# Numera Accounting Service — API Specification

**Version:** 1.0.0
**Author:** Tony Stark (Architecture / Engineering)
**Status:** Draft
**Last Updated:** 2026-04-15
**Tech Spec Reference:** TECH-SPEC-numera-accounting.md (2026-04-15)
**Discovery Reference:** DISCOVERY-accounting-service.md (2026-04-14)

---

## 1. Overview

This API specification defines the contracts between Numera's frontend applications and backend services. The system has two API layers:

1. **Supabase PostgREST (auto-generated)** — The Toolbox frontend reads and writes business data directly via `@supabase/supabase-js`. Row Level Security (RLS) policies govern access. No custom REST endpoints needed for CRUD.

2. **Supabase Edge Functions (custom)** — Server-side logic that requires secrets (AI API keys, Gmail tokens), compute (PDF rendering), or orchestration (document processing pipeline). Invoked via `supabase.functions.invoke()` from the Toolbox client or via external webhooks.

3. **Public endpoint** — Contact form submission from the marketing website. No authentication.

**Base URLs:**

| Surface | URL | Purpose |
|---------|-----|---------|
| Supabase PostgREST | `https://<project-ref>.supabase.co/rest/v1` | Direct DB access via SDK |
| Supabase Edge Functions | `https://<project-ref>.supabase.co/functions/v1` | Custom server-side logic |
| Marketing Website | `https://numera.ph` | Public site |
| Toolbox Application | `https://app.numera.ph` | Internal CRM + Workdesk |

**Content-Type:** `application/json` for all Edge Function requests and responses.

---

## 2. Authentication & Authorization

### 2.1 Auth Model Summary

| Endpoint | Auth Method | Who Calls It |
|----------|-------------|--------------|
| Supabase PostgREST (all tables) | Supabase Auth JWT (`Authorization: Bearer <access_token>`) | Toolbox frontend via SDK |
| `process-document` | Supabase Auth JWT | Toolbox frontend |
| `generate-report` | Supabase Auth JWT | Toolbox frontend |
| `prefill-bir-form` | Supabase Auth JWT | Toolbox frontend |
| `render-pdf` | Supabase Auth JWT | Toolbox frontend |
| `export-sheets` | Supabase Auth JWT | Toolbox frontend |
| `send-invoice` | Supabase Auth JWT | Toolbox frontend |
| `send-email` | Supabase Auth JWT | Toolbox frontend |
| `suggest-category` | Supabase Auth JWT | Toolbox frontend |
| `connect-gmail` | Supabase Auth JWT (admin only) | Toolbox Settings page |
| `draft-email` | Supabase Auth JWT | Toolbox frontend |
| `generate-client-deadlines` | Supabase Auth JWT | Toolbox frontend (onboarding flow) |
| `handle-contact-form` | None (public) | Marketing website |
| `gmail-webhook` | Google Pub/Sub message signature | Gmail API push notification |
| `classify-email` | Service role key (internal) | Called by `gmail-webhook` only |
| `categorize-transaction` | Service role key (internal) | Called by `process-document` only |
| `cron-gmail-watch` | Service role key (cron) | Supabase pg_cron |
| `cron-generate-deadlines` | Service role key (cron) | Supabase pg_cron |

### 2.2 Supabase Auth JWT

All Toolbox-facing Edge Functions require a valid Supabase Auth JWT in the `Authorization` header. The `@supabase/supabase-js` SDK includes this automatically when calling `supabase.functions.invoke()`.

```
Authorization: Bearer <supabase_access_token>
```

**Token lifecycle:** Access tokens expire after 1 hour. The Supabase client SDK refreshes them automatically. If a refresh token is revoked, the user is redirected to `/login`.

### 2.3 Google Pub/Sub Signature Verification

The `gmail-webhook` function verifies the incoming Pub/Sub message by checking:
1. The `subscription` field matches the expected Pub/Sub subscription name.
2. The request originates from Google's Pub/Sub IP ranges (validated at the Supabase edge layer).
3. The decoded `message.data` payload contains a valid `emailAddress` matching a row in `gmail_connections`.

No Bearer token is used. Gmail Pub/Sub does not send JWTs — authentication is via the subscription identity and message integrity.

### 2.4 Roles

| Role | Access |
|------|--------|
| `admin` | Full access to all tables and Edge Functions. System settings. Gmail connection management. |
| `accountant` | CRUD on business data (leads, clients, transactions, invoices, tasks). Cannot access system settings or Gmail connection management. |

Role enforcement: RLS policies on `system_settings` and `gmail_connections` restrict to `admin` role. Toolbox middleware blocks `/settings` route for non-admin.

---

## 3. Common Response Formats

### 3.1 Edge Function Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "duration_ms": 1250
  }
}
```

### 3.2 Edge Function Error Response

All errors follow this shape. No exceptions.

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description of what went wrong",
    "details": [
      { "field": "clientId", "issue": "Must be a valid UUID" }
    ],
    "request_id": "req_abc123"
  }
}
```

### 3.3 Standard Error Codes

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | `VALIDATION_FAILED` | Request body failed schema validation |
| 400 | `INVALID_INPUT` | Semantically invalid input (e.g., periodEnd before periodStart) |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Valid JWT but insufficient role |
| 404 | `NOT_FOUND` | Referenced resource does not exist |
| 409 | `CONFLICT` | Resource state conflict (e.g., already processing) |
| 422 | `PROCESSING_FAILED` | Operation attempted but failed (e.g., OCR extraction) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |
| 503 | `DEPENDENCY_UNAVAILABLE` | External dependency (Claude API, Gmail, etc.) unreachable |

### 3.4 Supabase PostgREST Responses

PostgREST responses follow Supabase conventions, not the Edge Function envelope above. The `@supabase/supabase-js` SDK returns:

```typescript
// Success
{ data: [...], error: null, count: number | null }

// Error
{ data: null, error: { message: string, details: string, hint: string, code: string } }
```

### 3.5 Pagination (PostgREST)

PostgREST uses range-based pagination via HTTP headers:

```typescript
const { data, count } = await supabase
  .from('transactions')
  .select('*', { count: 'exact' })
  .range(0, 49) // rows 0-49 (50 items)
  .order('date', { ascending: false })
```

Response includes `Content-Range` header: `0-49/1234`.

Edge Functions that return lists use offset/limit pagination:

```json
{
  "data": [...],
  "pagination": {
    "total": 1234,
    "offset": 0,
    "limit": 50
  }
}
```

---

## 4. Rate Limits

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `handle-contact-form` | 5 requests | per hour | per IP |
| All authenticated Edge Functions | 60 requests | per minute | per user |
| Supabase PostgREST | 1000 requests | per minute | per user (Supabase default) |
| `gmail-webhook` | No custom limit | — | Gmail Pub/Sub controls delivery rate |

When rate limited, the API returns `429` with:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1713168000
```

---

## 5. Supabase PostgREST — Direct Table Access

The Toolbox frontend uses `@supabase/supabase-js` for all CRUD operations. PostgREST auto-generates REST endpoints from the PostgreSQL schema. RLS policies enforce access control.

### 5.1 Exposed Tables

All tables are exposed via PostgREST. RLS is enabled on every table.

| Table | RLS Policy Summary | Primary Consumer |
|-------|-------------------|-----------------|
| `users` | SELECT/UPDATE own row; admin can SELECT all | Toolbox (profile) |
| `leads` | All authenticated: full CRUD | CRM module |
| `lead_activity_log` | All authenticated: SELECT. INSERT via trigger/Edge Function. | CRM module (read-only) |
| `clients` | All authenticated: full CRUD | CRM + Workdesk |
| `gmail_connections` | Admin only: SELECT/UPDATE | Settings page |
| `email_notifications` | All authenticated: SELECT. INSERT/UPDATE via Edge Functions (service role). | Workdesk notification panel |
| `document_attachments` | All authenticated: SELECT. INSERT via Edge Functions (service role). | Workdesk document preview |
| `chart_of_accounts` | All authenticated: SELECT. Admin: INSERT/UPDATE. | Workdesk (dropdowns, reports) |
| `transactions` | All authenticated: CRUD. DELETE restricted to admin. | Workdesk transaction grid |
| `ai_corrections` | All authenticated: SELECT/INSERT. DELETE restricted to admin. | Workdesk (auto-tracked on edit) |
| `invoices` | All authenticated: full CRUD | CRM invoicing |
| `invoice_line_items` | All authenticated: full CRUD | CRM invoicing |
| `tasks` | All authenticated: full CRUD | CRM task tracker |
| `deadlines` | All authenticated: CRUD | Workdesk deadline tracker |
| `financial_reports` | All authenticated: SELECT/INSERT. UPDATE for narrative approval. | Workdesk reports |
| `bir_form_templates` | All authenticated: SELECT. Admin: full CRUD. | Tax prep (read), admin (manage) |
| `bir_form_field_mappings` | All authenticated: SELECT. Admin: full CRUD. | Tax prep (read), admin (manage) |
| `bir_tax_form_records` | All authenticated: full CRUD | Tax prep module |
| `system_settings` | Admin only: SELECT/UPDATE | Settings page |

### 5.2 Key Query Patterns

These are the primary Supabase client queries the frontend executes. Documented here as the API contract between frontend and database.

---

#### 5.2.1 Leads — Pipeline Board

```typescript
// Fetch all leads grouped by stage for Kanban view
const { data: leads } = await supabase
  .from('leads')
  .select('*')
  .order('updated_at', { ascending: false })

// Filter by stage
const { data: activeLeads } = await supabase
  .from('leads')
  .select('*')
  .in('stage', ['lead', 'contacted', 'call_booked', 'proposal_sent', 'negotiation'])
  .order('updated_at', { ascending: false })

// Update lead stage (drag-and-drop)
const { error } = await supabase
  .from('leads')
  .update({ stage: 'contacted', updated_at: new Date().toISOString() })
  .eq('id', leadId)
```

---

#### 5.2.2 Leads — Activity Log

```typescript
// Fetch activity log for a lead
const { data: activity } = await supabase
  .from('lead_activity_log')
  .select('*, performed_by:users(full_name)')
  .eq('lead_id', leadId)
  .order('created_at', { ascending: false })
```

---

#### 5.2.3 Clients — List with Search

```typescript
// Client list with search
const { data: clients, count } = await supabase
  .from('clients')
  .select('*', { count: 'exact' })
  .eq('status', 'active')
  .ilike('business_name', `%${searchTerm}%`)
  .order('business_name')
  .range(offset, offset + limit - 1)
```

---

#### 5.2.4 Transactions — Data Grid (Primary Query)

```typescript
// Transaction grid for a client within date range
const { data: transactions, count } = await supabase
  .from('transactions')
  .select(`
    *,
    category:chart_of_accounts(code, name, account_type),
    source_email:email_notifications(subject, sender_email),
    approved_by_user:users!approved_by(full_name)
  `, { count: 'exact' })
  .eq('client_id', clientId)
  .gte('date', periodStart)
  .lte('date', periodEnd)
  .order('date', { ascending: false })
  .range(offset, offset + limit - 1)

// Filter by status (pending review queue)
const { data: pendingTxns } = await supabase
  .from('transactions')
  .select('*, category:chart_of_accounts(code, name)')
  .eq('client_id', clientId)
  .in('status', ['pending', 'in_review', 'manual_entry_required'])
  .order('date', { ascending: false })
```

---

#### 5.2.5 Transactions — Approve / Reject

```typescript
// Approve a transaction
const { error } = await supabase
  .from('transactions')
  .update({
    status: 'approved',
    approved_by: userId,
    approved_at: new Date().toISOString()
  })
  .eq('id', transactionId)

// Bulk approve
const { error } = await supabase
  .from('transactions')
  .update({
    status: 'approved',
    approved_by: userId,
    approved_at: new Date().toISOString()
  })
  .in('id', transactionIds)

// Reject with reason
const { error } = await supabase
  .from('transactions')
  .update({
    status: 'rejected',
    rejection_reason: 'Duplicate entry'
  })
  .eq('id', transactionId)
```

---

#### 5.2.6 Transactions — Edit with AI Correction Tracking

When the accountant edits an AI-extracted field, the frontend writes the correction to `ai_corrections` before updating the transaction.

```typescript
// Record correction, then update transaction
const { error: correctionError } = await supabase
  .from('ai_corrections')
  .insert({
    transaction_id: transactionId,
    field_name: 'category_code',
    original_value: '5200',
    corrected_value: '5300',
    corrected_by: userId
  })

const { error: updateError } = await supabase
  .from('transactions')
  .update({ category_code: '5300' })
  .eq('id', transactionId)
```

---

#### 5.2.7 Email Notifications — Notification Panel

```typescript
// Unprocessed notifications (Workdesk notification panel)
const { data: notifications } = await supabase
  .from('email_notifications')
  .select(`
    *,
    client:clients(business_name),
    attachments:document_attachments(id, original_filename, mime_type)
  `)
  .eq('status', 'unprocessed')
  .order('received_at', { ascending: false })
```

**Realtime subscription:**

```typescript
// Subscribe to new notifications
const channel = supabase
  .channel('email-notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'email_notifications',
      filter: 'status=eq.unprocessed'
    },
    (payload) => {
      // Add to notification panel
    }
  )
  .subscribe()
```

---

#### 5.2.8 Invoices — List with Derived Overdue Status

```typescript
// Invoice list with overdue derivation
const { data: invoices } = await supabase
  .from('invoices')
  .select(`
    *,
    client:clients(business_name),
    line_items:invoice_line_items(*)
  `)
  .eq('client_id', clientId)
  .order('issue_date', { ascending: false })

// Overdue is derived client-side:
// invoice.status === 'sent' && new Date(invoice.due_date) < new Date()
```

---

#### 5.2.9 Deadlines — Dashboard with Overdue

```typescript
// Upcoming and overdue deadlines across all clients
const { data: deadlines } = await supabase
  .from('deadlines')
  .select('*, client:clients(business_name)')
  .in('status', ['upcoming', 'in_progress'])
  .order('due_date', { ascending: true })
  .limit(50)

// Overdue derived client-side:
// deadline.status !== 'completed' && new Date(deadline.due_date) < new Date()
```

---

#### 5.2.10 Chart of Accounts — Dropdown / Categorization

```typescript
// Active accounts for category dropdown
const { data: accounts } = await supabase
  .from('chart_of_accounts')
  .select('code, name, account_type, parent_code')
  .eq('is_active', true)
  .order('display_order')
```

---

#### 5.2.11 Report Aggregation Queries (Read-Only Views)

These queries are used by the Toolbox for summary dashboards. They read approved transaction data.

```typescript
// Revenue vs Expenses summary for a client/period (dashboard widget)
const { data: summary } = await supabase.rpc('get_financial_summary', {
  p_client_id: clientId,
  p_period_start: '2026-01-01',
  p_period_end: '2026-03-31'
})
```

**Supabase RPC function `get_financial_summary`:**

```sql
CREATE OR REPLACE FUNCTION get_financial_summary(
  p_client_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS json AS $$
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' THEN t.amount ELSE 0 END), 0),
    'total_expenses', COALESCE(SUM(CASE WHEN coa.account_type = 'expense' THEN t.amount ELSE 0 END), 0),
    'transaction_count', COUNT(*),
    'pending_count', COUNT(*) FILTER (WHERE t.status = 'pending'),
    'approved_count', COUNT(*) FILTER (WHERE t.status = 'approved')
  )
  FROM transactions t
  JOIN chart_of_accounts coa ON t.category_code = coa.code
  WHERE t.client_id = p_client_id
    AND t.date BETWEEN p_period_start AND p_period_end
    AND t.status = 'approved';
$$ LANGUAGE sql STABLE;
```

---

#### 5.2.12 Tasks — Filtered List

```typescript
// Open tasks sorted by due date
const { data: tasks } = await supabase
  .from('tasks')
  .select('*, created_by_user:users!created_by(full_name)')
  .neq('status', 'done')
  .order('due_date', { ascending: true })

// Tasks for a specific client or lead
const { data: entityTasks } = await supabase
  .from('tasks')
  .select('*')
  .eq('linked_entity_type', 'client')
  .eq('linked_entity_id', clientId)
  .order('due_date', { ascending: true })
```

---

## 6. Edge Functions — Custom Endpoints

All Edge Functions are invoked via `supabase.functions.invoke('<function-name>', { body: {...} })` from the Toolbox frontend, except where noted.

---

### 6.1 `process-document`

**Purpose:** Download email attachment(s), run OCR/extraction via Claude Vision (with Google Cloud Vision fallback), categorize transactions, write results to database.

**Auth:** Supabase Auth JWT (authenticated user).

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('process-document', {
  body: { notificationId: 'uuid' }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notificationId` | `string (uuid)` | Yes | ID from `email_notifications` table |

#### Response (200)

```json
{
  "success": true,
  "data": {
    "transactionsCreated": 5,
    "transactions": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "date": "2026-01-15",
        "description": "BDO ATM Withdrawal",
        "amount": "5000.00",
        "type": "debit",
        "categoryCode": "1110",
        "categoryName": "Cash on Hand",
        "categoryConfidence": 0.92,
        "status": "pending",
        "pageNumber": 1
      },
      {
        "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "date": "2026-01-16",
        "description": "GCash Transfer from Juan Dela Cruz",
        "amount": "15000.00",
        "type": "credit",
        "categoryCode": "4100",
        "categoryName": "Service Revenue",
        "categoryConfidence": 0.78,
        "status": "pending",
        "pageNumber": 1
      }
    ],
    "documentsStored": 1,
    "pagesProcessed": 3,
    "extractionBatchId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "warnings": []
  },
  "meta": {
    "request_id": "req_abc123",
    "duration_ms": 12500
  }
}
```

#### Errors

| Status | Code | Description | Client Action |
|--------|------|-------------|---------------|
| 400 | `VALIDATION_FAILED` | `notificationId` missing or not a valid UUID | Fix request |
| 404 | `NOT_FOUND` | Notification does not exist | Refresh notification list |
| 409 | `CONFLICT` | Notification already processing (started within last 5 min) or already processed | Wait and refresh |
| 422 | `PROCESSING_FAILED` | Vision API failed on all fallbacks. Transactions created with `manual_entry_required` status. | Accountant enters manually |
| 500 | `INTERNAL_ERROR` | Unexpected failure | Retry once |
| 503 | `DEPENDENCY_UNAVAILABLE` | Both Claude Vision and Google Cloud Vision unreachable | Retry later |

#### Processing Flow

1. Verify notification status is `unprocessed`. If `processing` and `processing_started_at` < 5 min ago → 409.
2. Set status = `processing`, `processing_started_at = now()`.
3. Fetch Gmail attachments using decrypted access token from `gmail_connections`.
4. Store each attachment in Supabase Storage: `documents/{client_id}/{year}/{filename}`.
5. Create `document_attachments` rows.
6. Process via Claude Sonnet Vision (max 3 pages per API call, sequential batches).
7. On Vision failure → fallback to Google Cloud Vision for raw OCR → parse to structured format.
8. Deduplicate boundary transactions across page batches (same date + amount + description with Levenshtein ≤ 3).
9. For each extracted transaction → call `categorize-transaction` internally.
10. INSERT transactions. If category confidence ≥ 0.85 → assign category. Else → `category_code = null`.
11. Set notification status = `processed`.

**Timeout:** 120 seconds.

---

### 6.2 `generate-report`

**Purpose:** Generate a financial report from approved transactions via SQL aggregation. Optionally generates an AI narrative summary.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('generate-report', {
  body: {
    clientId: 'uuid',
    reportType: 'profit_and_loss',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31'
  }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | `string (uuid)` | Yes | Client to generate report for |
| `reportType` | `string (enum)` | Yes | One of: `profit_and_loss`, `balance_sheet`, `cash_flow`, `bank_reconciliation`, `ar_ageing`, `ap_ageing`, `general_ledger`, `trial_balance` |
| `periodStart` | `string (ISO date)` | Yes | Start of reporting period. Format: `YYYY-MM-DD` |
| `periodEnd` | `string (ISO date)` | Yes | End of reporting period. Format: `YYYY-MM-DD` |

**Date range notes:** The frontend translates user-friendly period selections into concrete ISO dates before calling this endpoint:
- "January 2026" → `periodStart: "2026-01-01"`, `periodEnd: "2026-01-31"`
- "Q1 2026" → `periodStart: "2026-01-01"`, `periodEnd: "2026-03-31"`
- "FY 2025" → `periodStart: "2025-01-01"`, `periodEnd: "2025-12-31"` (adjusted for client's `fiscal_year_start_month`)

#### Response (200) — Profit & Loss Example

```json
{
  "success": true,
  "data": {
    "reportId": "d4e5f6a7-b8c9-0123-defa-234567890123",
    "reportType": "profit_and_loss",
    "clientId": "a1b2c3d4-0000-0000-0000-000000000001",
    "periodStart": "2026-01-01",
    "periodEnd": "2026-03-31",
    "sections": [
      {
        "title": "Revenue",
        "accountType": "revenue",
        "lineItems": [
          { "code": "4100", "name": "Service Revenue", "amount": "450000.00" },
          { "code": "4300", "name": "Other Income", "amount": "12500.00" }
        ],
        "subtotal": "462500.00"
      },
      {
        "title": "Expenses",
        "accountType": "expense",
        "lineItems": [
          { "code": "5100", "name": "Cost of Services", "amount": "85000.00" },
          { "code": "5200", "name": "Salaries and Wages", "amount": "120000.00" },
          { "code": "5300", "name": "Rent Expense", "amount": "25000.00" },
          { "code": "5400", "name": "Utilities Expense", "amount": "8500.00" },
          { "code": "5500", "name": "Office Supplies", "amount": "3200.00" },
          { "code": "5900", "name": "Bank Charges", "amount": "1500.00" }
        ],
        "subtotal": "243200.00"
      }
    ],
    "totals": {
      "totalRevenue": "462500.00",
      "totalExpenses": "243200.00",
      "netIncome": "219300.00"
    },
    "validationWarnings": [],
    "aiNarrative": "The business generated ₱462,500.00 in total revenue for Q1 2026, driven primarily by Service Revenue (₱450,000.00). Total expenses of ₱243,200.00 were led by Salaries and Wages (₱120,000.00) and Cost of Services (₱85,000.00). Net income of ₱219,300.00 represents a 47.4% profit margin. No unusual expense categories were observed.\n\nAI-Generated Summary — Review before sharing with client.",
    "aiNarrativeApproved": false,
    "generatedAt": "2026-04-15T10:30:00Z"
  },
  "meta": {
    "request_id": "req_def456",
    "duration_ms": 3200
  }
}
```

#### Response (200) — Trial Balance Example

```json
{
  "success": true,
  "data": {
    "reportId": "e5f6a7b8-c9d0-1234-efab-345678901234",
    "reportType": "trial_balance",
    "clientId": "a1b2c3d4-0000-0000-0000-000000000001",
    "periodStart": "2026-01-01",
    "periodEnd": "2026-03-31",
    "sections": [
      {
        "title": "Trial Balance",
        "lineItems": [
          {
            "code": "1120",
            "name": "Cash in Bank",
            "accountType": "asset",
            "normalBalance": "debit",
            "totalDebits": "580000.00",
            "totalCredits": "360700.00",
            "balance": "219300.00"
          }
        ]
      }
    ],
    "totals": {
      "totalDebits": "705700.00",
      "totalCredits": "705700.00",
      "isBalanced": true,
      "imbalance": "0.00"
    },
    "validationWarnings": [],
    "aiNarrative": null,
    "aiNarrativeApproved": false,
    "generatedAt": "2026-04-15T10:32:00Z"
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing or invalid fields |
| 400 | `INVALID_INPUT` | `periodEnd` before `periodStart`, or invalid `reportType` |
| 404 | `NOT_FOUND` | Client does not exist |
| 500 | `INTERNAL_ERROR` | SQL aggregation or AI narrative generation failed |

**AI narrative:** Generated for `profit_and_loss` and `balance_sheet` only. Returns `null` for other report types. The narrative must be approved (`aiNarrativeApproved: true`) before it appears in exported PDFs/Sheets.

#### Response Schemas — All Report Types

All report types share the same envelope (`reportId`, `reportType`, `clientId`, `periodStart`, `periodEnd`, `sections`, `totals`, `validationWarnings`, `aiNarrative`, `aiNarrativeApproved`, `generatedAt`). The `sections` and `totals` shapes vary per type:

**Balance Sheet:** `sections` = `[{title: "Assets", accountType: "asset", lineItems: [{code, name, balance}], subtotal}, {title: "Liabilities", ...}, {title: "Equity", ...}]`. `totals` = `{totalAssets, totalLiabilities, totalEquity, isBalanced}`. `aiNarrative` = generated.

**Cash Flow:** `sections` = `[{title: "Operating Activities", lineItems: [{description, amount}], subtotal}, {title: "Investing Activities", ...}, {title: "Financing Activities", ...}]`. `totals` = `{netCashFlow, openingBalance, closingBalance}`. `aiNarrative` = `null`.

**Bank Reconciliation:** `sections` = `[{title: "Book Balance", lineItems}, {title: "Outstanding Deposits", lineItems}, {title: "Outstanding Checks", lineItems}]`. `totals` = `{bookBalance, adjustedBookBalance, bankBalance, adjustedBankBalance, difference}`. `aiNarrative` = `null`.

**AR Ageing / AP Ageing:** `sections` = `[{title: "Current", lineItems: [{clientOrVendor, invoiceNumber, amount, daysOutstanding}]}, {title: "1-30 Days", ...}, {title: "31-60 Days", ...}, {title: "61-90 Days", ...}, {title: "90+ Days", ...}]`. `totals` = `{totalOutstanding, currentTotal, days1to30, days31to60, days61to90, days90plus}`. `aiNarrative` = `null`.

**General Ledger:** `sections` = `[{title: "1110 — Cash on Hand", accountCode: "1110", lineItems: [{date, description, debit, credit, runningBalance}], openingBalance, closingBalance}]` (one section per account with transactions in the period). `totals` = `{accountCount, transactionCount}`. `aiNarrative` = `null`.

**Timeout:** 30 seconds.

---

### 6.3 `prefill-bir-form`

**Purpose:** Pre-fill a BIR tax form by evaluating field mappings against approved transaction data for a client and filing period.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('prefill-bir-form', {
  body: {
    clientId: 'uuid',
    formNumber: '2550Q',
    filingPeriod: 'Q1-2026'
  }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | `string (uuid)` | Yes | Client to generate form for |
| `formNumber` | `string` | Yes | BIR form number (e.g., `2550Q`, `2551Q`, `1701`, `1701Q`, `1702`, `1702Q`) |
| `filingPeriod` | `string` | Yes | Filing period identifier. Format: `Q{1-4}-YYYY` for quarterly, `YYYY-MM` for monthly, `YYYY` for annual |

**Filing period to date range mapping:** The Edge Function resolves `filingPeriod` to concrete dates internally:
- `Q1-2026` → January 1 to March 31, 2026
- `2026-01` → January 1 to January 31, 2026
- `2026` → Client's fiscal year (based on `fiscal_year_start_month`)

#### Response (200)

```json
{
  "success": true,
  "data": {
    "recordId": "f6a7b8c9-d0e1-2345-fabc-456789012345",
    "formNumber": "2550Q",
    "formTitle": "Quarterly VAT Return",
    "filingPeriod": "Q1-2026",
    "status": "prefill_complete",
    "sections": [
      {
        "title": "Part I - Background Information",
        "fields": [
          {
            "fieldCode": "tin",
            "label": "Taxpayer Identification Number",
            "value": "123-456-789-000",
            "isEditable": false,
            "isRequired": true,
            "mappingType": "client_field"
          },
          {
            "fieldCode": "registered_name",
            "label": "Registered Name",
            "value": "Juan's Bakery",
            "isEditable": false,
            "isRequired": true,
            "mappingType": "client_field"
          }
        ]
      },
      {
        "title": "Part III - Tax Due",
        "fields": [
          {
            "fieldCode": "total_sales",
            "label": "Total Sales / Receipts",
            "value": "1250000.00",
            "isEditable": true,
            "isRequired": true,
            "mappingType": "sum_account_type"
          },
          {
            "fieldCode": "vat_on_sales",
            "label": "Output VAT (12%)",
            "value": "150000.00",
            "isEditable": true,
            "isRequired": true,
            "mappingType": "computed"
          }
        ]
      }
    ],
    "warnings": [
      "No transactions found for account code 4200 (Sales Revenue) — verify if applicable"
    ]
  },
  "meta": {
    "request_id": "req_ghi789",
    "duration_ms": 1800
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing or invalid fields |
| 404 | `NOT_FOUND` | Client not found, or no current template for `formNumber` |
| 500 | `INTERNAL_ERROR` | Field mapping evaluation failed (e.g., circular dependency) |

**Timeout:** 15 seconds.

---

### 6.4 `render-pdf`

**Purpose:** Server-side PDF generation for financial reports, BIR forms, and invoices.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('render-pdf', {
  body: {
    type: 'report',
    id: 'uuid'
  }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string (enum)` | Yes | One of: `report`, `bir_form`, `invoice` |
| `id` | `string (uuid)` | Yes | ID of the record to render. `financial_reports.id`, `bir_tax_form_records.id`, or `invoices.id` |

#### Response (200)

```json
{
  "success": true,
  "data": {
    "storagePath": "exports/a1b2c3d4/reports/profit_and_loss-2026-Q1.pdf",
    "signedUrl": "https://<project-ref>.supabase.co/storage/v1/object/sign/documents/exports/...",
    "expiresAt": "2026-04-15T11:30:00Z",
    "fileSizeBytes": 45230
  },
  "meta": {
    "request_id": "req_jkl012",
    "duration_ms": 2800
  }
}
```

**Storage paths:**
- Reports: `exports/{client_id}/reports/{report_type}-{period}.pdf`
- BIR forms: `exports/{client_id}/bir/{form_number}-{period}.pdf`
- Invoices: `exports/{client_id}/invoices/{invoice_number}.pdf`

**Signed URL:** Valid for 1 hour. Frontend uses this for download or preview.

**AI Narrative Gate (reports only):** When `type = 'report'`, the function checks `financial_reports.ai_narrative_approved`. If the report has an `ai_narrative` that has not been approved (`ai_narrative_approved = false`), the narrative is **omitted from the PDF** — the report renders without the AI summary section. The PDF is still generated successfully; the narrative section is simply blank. This matches the UI behavior where export buttons are disabled until narrative approval, but provides a server-side safety net.

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Invalid `type` or `id` |
| 404 | `NOT_FOUND` | Referenced record not found |
| 422 | `PROCESSING_FAILED` | PDF rendering failed |
| 500 | `INTERNAL_ERROR` | Unexpected failure |

**Timeout:** 30 seconds.

---

### 6.5 `export-sheets`

**Purpose:** Export transaction data or report tables to a new Google Sheets spreadsheet in the client's Google Drive folder.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('export-sheets', {
  body: {
    type: 'report',
    clientId: 'uuid',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    reportId: 'uuid'
  }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string (enum)` | Yes | One of: `transactions`, `report` |
| `clientId` | `string (uuid)` | Yes | Client whose data to export |
| `periodStart` | `string (ISO date)` | Yes | Period start. Format: `YYYY-MM-DD` |
| `periodEnd` | `string (ISO date)` | Yes | Period end. Format: `YYYY-MM-DD` |
| `reportId` | `string (uuid)` | No | Required when `type = 'report'`. The `financial_reports.id` to export. |

#### Response (200)

```json
{
  "success": true,
  "data": {
    "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/1BxiM...",
    "spreadsheetId": "1BxiM0k...",
    "title": "PnL-JuansBakery-Q1-2026-20260415T103000"
  },
  "meta": {
    "request_id": "req_mno345",
    "duration_ms": 4500
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing or invalid fields |
| 400 | `INVALID_INPUT` | `type = 'report'` but `reportId` not provided |
| 404 | `NOT_FOUND` | Client not found, or `reportId` not found |
| 422 | `PROCESSING_FAILED` | Client has no `google_sheet_folder_url` configured |
| 503 | `DEPENDENCY_UNAVAILABLE` | Google Sheets API unreachable |

**Timeout:** 60 seconds.

---

### 6.6 `send-invoice`

**Purpose:** Send a finalized invoice to the client via Gmail. Renders PDF, attaches it, and sends from the connected Gmail account.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('send-invoice', {
  body: { invoiceId: 'uuid' }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoiceId` | `string (uuid)` | Yes | Invoice to send |

#### Response (200)

```json
{
  "success": true,
  "data": {
    "gmailMessageId": "18e1234abcd5678",
    "sentTo": "client@example.com",
    "sentAt": "2026-04-15T10:45:00Z",
    "invoiceNumber": "INV-2026-0042"
  },
  "meta": {
    "request_id": "req_pqr678",
    "duration_ms": 5200
  }
}
```

#### Processing Flow

1. Load invoice with client data and line items.
2. Validate invoice status is `draft` or `sent` (re-send allowed).
3. Render invoice PDF via `render-pdf` logic.
4. Compose email: subject = `Invoice {invoice_number} from Numera`, body = professional template with amount summary, attachment = PDF.
5. Send via Gmail API using decrypted access token from `gmail_connections`.
6. Update `invoices` row: `status = 'sent'`, `sent_at = now()`, `gmail_message_id = <id>`.
7. Return confirmation.

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing `invoiceId` |
| 404 | `NOT_FOUND` | Invoice not found |
| 422 | `PROCESSING_FAILED` | PDF rendering failed or email composition failed |
| 503 | `DEPENDENCY_UNAVAILABLE` | Gmail API unreachable or connection expired/revoked |

**Timeout:** 30 seconds.

---

### 6.7 `send-email`

**Purpose:** Send a general email (follow-ups, reminders, custom messages) to a client via the connected Gmail account. Does NOT render a PDF attachment — this is for text-based correspondence.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    to: 'client@example.com',
    subject: 'Reminder: Please send January bank statement',
    body: 'Hi Juan,\n\nJust a friendly reminder...',
    clientId: 'uuid'
  }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string (email)` | Yes | Recipient email address |
| `subject` | `string` | Yes | Email subject line. Max 255 characters. |
| `body` | `string` | Yes | Email body in plain text. Max 5000 characters. |
| `clientId` | `string (uuid)` | Yes | Client this email is associated with (for audit trail) |

#### Response (200)

```json
{
  "success": true,
  "data": {
    "gmailMessageId": "18e5678efgh1234",
    "sentTo": "client@example.com",
    "sentAt": "2026-04-15T11:00:00Z"
  },
  "meta": {
    "request_id": "req_stu901",
    "duration_ms": 1800
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing required fields or invalid email format |
| 404 | `NOT_FOUND` | Client not found |
| 503 | `DEPENDENCY_UNAVAILABLE` | Gmail API unreachable or connection expired/revoked |

**Timeout:** 15 seconds.

---

### 6.8 `connect-gmail`

**Purpose:** Exchange a Google OAuth authorization code for access and refresh tokens, encrypt and store them, and initialize Gmail push notifications via `watch()`.

**Auth:** Supabase Auth JWT (admin role only — Rick manages Gmail connections).

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('connect-gmail', {
  body: { code: 'authorization_code_from_google' }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | Google OAuth2 authorization code from the consent redirect |

#### Response (200)

```json
{
  "success": true,
  "data": {
    "gmailEmail": "accountant@gmail.com",
    "connectionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "watchExpiration": "2026-04-22T10:00:00Z",
    "status": "active"
  },
  "meta": {
    "request_id": "req_connect01",
    "duration_ms": 2200
  }
}
```

#### Processing Flow

1. Verify caller has `admin` role.
2. Exchange `code` for `access_token`, `refresh_token`, and `expires_in` via Google OAuth2 token endpoint.
3. Fetch the Gmail address from the token via `gmail.users.getProfile()`.
4. Encrypt `access_token` and `refresh_token` with AES-256-GCM (key from Supabase secrets).
5. INSERT into `gmail_connections` (or UPDATE if row exists for this email): encrypted tokens, `token_expires_at`, `status = 'active'`.
6. Call `gmail.users.watch()` with the configured Pub/Sub topic.
7. UPDATE `gmail_connections` with `watch_history_id` and `watch_expiration` from the watch response.
8. Return confirmation.

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing `code` parameter |
| 403 | `FORBIDDEN` | Caller is not `admin` role |
| 422 | `PROCESSING_FAILED` | OAuth token exchange failed (invalid or expired code) |
| 503 | `DEPENDENCY_UNAVAILABLE` | Google OAuth or Gmail API unreachable |

**Timeout:** 15 seconds.

---

### 6.9 `draft-email`

**Purpose:** Generate an AI-drafted follow-up email for a client using Claude API. The accountant selects a template type and optionally provides a custom intent.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('draft-email', {
  body: {
    clientId: 'uuid',
    templateType: 'document_request',
    customIntent: null
  }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | `string (uuid)` | Yes | Client to draft email for |
| `templateType` | `string (enum)` | Yes | One of: `document_request`, `deadline_reminder`, `report_delivery`, `custom` |
| `customIntent` | `string` | No | Free-text intent. Required when `templateType = 'custom'`. Max 500 characters. |

#### Response (200)

```json
{
  "success": true,
  "data": {
    "subject": "Reminder: Please send January bank statement",
    "body": "Hi Juan,\n\nI hope this message finds you well. I'm writing to kindly request your January 2026 bank statement for our monthly bookkeeping. If you could send it at your earliest convenience, that would help us stay on schedule.\n\nPlease reply to this email with the document attached, or forward it directly from your bank.\n\nThank you,\nNumera Accounting",
    "templateType": "document_request",
    "clientName": "Juan's Bakery"
  },
  "meta": {
    "request_id": "req_draft01",
    "duration_ms": 2500
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing required fields or `customIntent` missing when `templateType = 'custom'` |
| 404 | `NOT_FOUND` | Client not found |
| 503 | `DEPENDENCY_UNAVAILABLE` | Claude API unreachable |

**Timeout:** 15 seconds.

---

### 6.10 `generate-client-deadlines`

**Purpose:** Generate 12 months of BIR and bookkeeping deadlines for a specific client. Called during client onboarding (after client record is created) and can be invoked manually to regenerate deadlines.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('generate-client-deadlines', {
  body: { clientId: 'uuid' }
})
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | `string (uuid)` | Yes | Client to generate deadlines for |

#### Response (200)

```json
{
  "success": true,
  "data": {
    "deadlinesCreated": 18,
    "deadlinesSkipped": 0,
    "clientId": "a1b2c3d4-0000-0000-0000-000000000001",
    "periodCovered": "2026-04 to 2027-03"
  },
  "meta": {
    "request_id": "req_deadlines01",
    "duration_ms": 450
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing `clientId` |
| 404 | `NOT_FOUND` | Client not found |
| 500 | `INTERNAL_ERROR` | Deadline generation logic failed |

**Idempotency:** Uses `ON CONFLICT (client_id, deadline_type, period_label) DO NOTHING`. Safe to call multiple times.

**Timeout:** 10 seconds.

---

### 6.11 `suggest-category`

**Purpose:** Suggest a chart of accounts category for a single transaction. Used when the accountant is reviewing a transaction with no category assigned (low AI confidence during batch processing) or wants a re-suggestion.

**Auth:** Supabase Auth JWT.

**Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('suggest-category', {
  body: {
    transactionId: 'uuid'
  }
})
// OR for manual entry (no existing transaction):
const { data, error } = await supabase.functions.invoke('suggest-category', {
  body: {
    description: 'Globe Telecom monthly bill',
    amount: '2899.00',
    type: 'debit',
    clientId: 'uuid'
  }
})
```

#### Request Body (Option A: Existing Transaction)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionId` | `string (uuid)` | Yes | Existing transaction to re-categorize |

#### Request Body (Option B: Raw Data)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | Transaction description |
| `amount` | `string` | Yes | Amount as decimal string (e.g., `"2899.00"`) |
| `type` | `string (enum)` | Yes | `credit` or `debit` |
| `clientId` | `string (uuid)` | Yes | Client context (for industry and correction history) |

One of `transactionId` or (`description` + `amount` + `type` + `clientId`) must be provided.

#### Response (200)

```json
{
  "success": true,
  "data": {
    "suggestedCategoryCode": "5400",
    "suggestedCategoryName": "Utilities Expense",
    "confidence": 0.94,
    "reasoning": "Globe Telecom is a telecommunications provider. Monthly bills from telecom companies are typically classified as Utilities Expense.",
    "alternatives": [
      {
        "categoryCode": "5500",
        "categoryName": "Office Supplies",
        "confidence": 0.12
      }
    ]
  },
  "meta": {
    "request_id": "req_vwx234",
    "duration_ms": 1100
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Neither `transactionId` nor complete raw data provided |
| 404 | `NOT_FOUND` | Transaction or client not found |
| 503 | `DEPENDENCY_UNAVAILABLE` | Claude API unreachable |

**Timeout:** 10 seconds.

---

### 6.12 `handle-contact-form`

**Purpose:** Process contact form submissions from the marketing website. Creates a lead in the CRM. Public endpoint — no authentication required.

**Auth:** None.

**CORS Policy:** `Access-Control-Allow-Origin: https://numera.ph` (exact origin, no wildcard). This is a write endpoint that creates CRM records — it must not be callable from arbitrary origins.

**CORS Headers:**

```
Access-Control-Allow-Origin: https://numera.ph
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 86400
```

**Invocation (from marketing site):**
```typescript
const response = await fetch(
  `https://<project-ref>.supabase.co/functions/v1/handle-contact-form`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      phone: '+63 917 123 4567',
      businessName: "Juan's Bakery",
      message: 'I need help with my quarterly BIR filings.',
      website: ''
    })
  }
)
```

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | `string` | Yes | 1–100 characters | Contact person name |
| `email` | `string` | Yes | Valid email format | Contact email |
| `phone` | `string` | No | Max 20 characters | Contact phone |
| `businessName` | `string` | No | Max 200 characters | Business name |
| `message` | `string` | Yes | 10–1000 characters | Inquiry message |
| `website` | `string` | No | — | **Honeypot field.** If non-empty, silently return 200 (bot detected). Hidden via CSS in the form. |

#### Response (200)

```json
{
  "success": true
}
```

Returns `200` in all cases to prevent information leakage (including honeypot catches and rate limit hits that have already been counted).

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_FAILED` | Missing required fields or validation failure |
| 429 | `RATE_LIMITED` | More than 5 submissions from this IP in the last hour |

#### Side Effects

- Creates a row in `leads` with `source = 'website_form'`, `stage = 'lead'`, `created_by = null`.
- Phone stored in `contact_phone` if provided.

**Rate Limiting:** 5 submissions per IP per hour. Implemented via Edge Function with IP-based counter (stored in a simple `contact_form_rate_limits` table or in-memory cache with TTL).

**Spam Protection:** Honeypot field (`website`) catches most bots. If spam rate exceeds 10% of submissions, add Cloudflare Turnstile in a future iteration.

---

### 6.13 `gmail-webhook`

**Purpose:** Receive Gmail push notifications via Google Pub/Sub and trigger the email classification pipeline.

**Auth:** Google Pub/Sub message signature (see Section 2.3).

**Caller:** Gmail API push notification system. Not called by the Toolbox frontend.

**HTTP Method:** POST

**URL:** `https://<project-ref>.supabase.co/functions/v1/gmail-webhook`

#### Request Body (from Google Pub/Sub)

```json
{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiAiYWNjb3VudGFudEBnbWFpbC5jb20iLCAiaGlzdG9yeUlkIjogIjEyMzQ1In0=",
    "messageId": "1234567890",
    "publishTime": "2026-04-15T10:00:00.000Z"
  },
  "subscription": "projects/numera-project/subscriptions/gmail-push"
}
```

**Decoded `message.data`:**
```json
{
  "emailAddress": "accountant@gmail.com",
  "historyId": "12345"
}
```

#### Response

Always returns `200 OK` with empty body. Gmail Pub/Sub retries on non-2xx responses — returning anything other than 200 causes duplicate delivery.

```json
{}
```

#### Processing Flow

1. Decode base64 `message.data`.
2. Look up `gmail_connections` by `gmail_email = emailAddress`.
3. If no active connection or `historyId` ≤ `watch_history_id` → return 200 (idempotent, no-op).
4. Call Gmail `history.list` from `watch_history_id` to current `historyId`.
5. For each new message with attachments:
   a. Check `email_notifications` for existing `gmail_message_id` (idempotency guard).
   b. Match `sender_email` against `clients.gmail_address` to identify client.
   c. Invoke `classify-email` internally with message metadata.
6. Update `gmail_connections.watch_history_id` to current historyId.
7. Return 200.

**Timeout:** 30 seconds.

**Idempotency:** `email_notifications.gmail_message_id` has a UNIQUE constraint. Duplicate Pub/Sub deliveries are caught by this constraint and silently skipped.

---

### 6.14 Internal Functions (Not Client-Callable)

These functions are invoked server-side by other Edge Functions. They use the Supabase service role key for DB writes. They are **not** exposed to the Toolbox frontend.

---

#### `classify-email`

**Called by:** `gmail-webhook`

**Input:**
```typescript
{
  gmailMessageId: string
  senderEmail: string
  senderName: string
  subject: string
  snippet: string          // First ~200 chars of body
  hasAttachments: boolean
  attachmentNames: string[]
  matchedClientId: string | null
}
```

**Output:** Writes to `email_notifications` table.
- If `isDocument = true AND confidence ≥ 0.70` → status = `unprocessed`, notification appears in Workdesk.
- If `isDocument = false OR confidence < 0.70` → status = `dismissed`, `auto_dismissed = true`.

**Failure behavior:** On Claude API timeout or malformed response → create notification with status = `unprocessed` and `document_type_guess = null` (fail-open; let accountant decide).

---

#### `categorize-transaction`

**Called by:** `process-document` (during batch extraction) and `suggest-category` (for single transactions).

**Input:**
```typescript
{
  description: string
  amount: string
  type: 'credit' | 'debit'
  clientIndustry: string
  existingCategories: { code: string; name: string; type: string }[]
  recentCorrections?: { original: string; corrected: string; description: string }[]
}
```

**Output:**
```typescript
{
  categoryCode: string
  confidence: number    // 0.00 – 1.00
  reasoning: string
}
```

**Confidence threshold:** Read from `system_settings.category_confidence_threshold` (default: 0.85). If confidence < threshold, `category_code` on the transaction is set to NULL.

**Few-shot learning:** Includes up to 10 recent corrections from `ai_corrections` for the same client to improve accuracy over time.

---

#### `cron-gmail-watch`

**Schedule:** Every 6 days (1-day buffer before 7-day Gmail watch expiry).

**Flow:** Renew `gmail.users.watch()` for all active connections. Refresh access tokens if expired. Set connection to `revoked` or `error` if renewal fails.

---

#### `cron-generate-deadlines`

**Schedule:** January 1 each year.

**Flow:** Generate 12 months of BIR and bookkeeping deadlines for all active clients. Idempotent via `ON CONFLICT DO NOTHING` on the unique index `(client_id, deadline_type, period_label)`.

---

## 7. Supabase Realtime Subscriptions

The Toolbox uses Supabase Realtime for live updates without polling.

### 7.1 Active Subscriptions

| Channel | Table | Event | Filter | Purpose |
|---------|-------|-------|--------|---------|
| `email-notifications` | `email_notifications` | INSERT | `status=eq.unprocessed` | New document notification badge |
| `email-notifications` | `email_notifications` | UPDATE | — | Status change (processing → processed) |
| `transactions` | `transactions` | INSERT | `client_id=eq.{clientId}` | New transactions appear in grid after processing |
| `transactions` | `transactions` | UPDATE | `client_id=eq.{clientId}` | Approval status changes |

### 7.2 Subscription Pattern

```typescript
// Generic pattern for all Realtime subscriptions
const channel = supabase
  .channel('channel-name')
  .on(
    'postgres_changes',
    {
      event: '*',      // INSERT, UPDATE, DELETE, or *
      schema: 'public',
      table: 'table_name',
      filter: 'column=eq.value'  // optional
    },
    (payload) => {
      // payload.new = new row data
      // payload.old = previous row data (UPDATE/DELETE only)
      // payload.eventType = 'INSERT' | 'UPDATE' | 'DELETE'
    }
  )
  .subscribe()

// Cleanup on unmount
channel.unsubscribe()
```

---

## 8. Supabase Storage

### 8.1 Buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `documents` | Private (signed URLs only) | Original uploaded documents and generated exports |

### 8.2 Storage Path Convention

```
documents/
├── {client_id}/
│   ├── inbox/                         # Original email attachments
│   │   └── {year}/
│   │       └── {original_filename}
│   └── exports/
│       ├── reports/
│       │   └── {report_type}-{period}.pdf
│       ├── bir/
│       │   └── {form_number}-{period}.pdf
│       └── invoices/
│           └── {invoice_number}.pdf
```

### 8.3 Signed URL Pattern

All document access is via time-limited signed URLs (default: 1 hour expiry).

```typescript
const { data } = await supabase.storage
  .from('documents')
  .createSignedUrl('path/to/file.pdf', 3600) // 1 hour

// data.signedUrl = "https://...supabase.co/storage/v1/object/sign/documents/..."
```

---

## 9. Supabase RPC Functions

Custom PostgreSQL functions exposed via PostgREST RPC for queries too complex for the standard query builder.

### 9.1 `get_financial_summary`

**Purpose:** Dashboard widget — quick revenue/expense/count summary for a client and period.

**Invocation:**
```typescript
const { data } = await supabase.rpc('get_financial_summary', {
  p_client_id: clientId,
  p_period_start: '2026-01-01',
  p_period_end: '2026-03-31'
})
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_client_id` | `uuid` | Client ID |
| `p_period_start` | `date` | Period start (inclusive) |
| `p_period_end` | `date` | Period end (inclusive) |

**Returns:**
```json
{
  "total_revenue": "462500.00",
  "total_expenses": "243200.00",
  "transaction_count": 156,
  "pending_count": 12,
  "approved_count": 144
}
```

### 9.2 `get_correction_rates`

**Purpose:** Admin dashboard — AI accuracy metrics for prompt tuning.

**Invocation:**
```typescript
const { data } = await supabase.rpc('get_correction_rates', {
  p_days: 30
})
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_days` | `integer` | Lookback window in days |

**Returns:**
```json
[
  {
    "field_name": "category_code",
    "corrections": 23,
    "transactions_corrected": 18
  },
  {
    "field_name": "amount",
    "corrections": 5,
    "transactions_corrected": 5
  }
]
```

---

## 10. Webhook: Gmail Push Notifications

This section documents the external webhook contract — how Google's systems call Numera.

### 10.1 Setup Requirements

1. **Google Cloud Pub/Sub topic:** `projects/{project-id}/topics/gmail-notifications`
2. **Push subscription:** `projects/{project-id}/subscriptions/gmail-push` → `https://<project-ref>.supabase.co/functions/v1/gmail-webhook`
3. **Gmail watch:** Called via `gmail.users.watch()` with the topic. Expires every 7 days, renewed by `cron-gmail-watch`.
4. **IAM:** Gmail service account must have publish permission on the Pub/Sub topic.

### 10.2 Delivery Guarantees

- **At-least-once delivery:** Google Pub/Sub may deliver the same message multiple times. The `gmail_message_id` UNIQUE constraint prevents duplicate processing.
- **Ordering:** Not guaranteed. Messages may arrive out of order. `historyId` comparison handles this — only messages newer than the last processed `historyId` are fetched.
- **Retry:** Google retries on non-2xx responses with exponential backoff. The webhook always returns 200 to acknowledge receipt, even on internal errors (errors are logged and handled asynchronously).

---

## 11. Error Handling Patterns

### 11.1 AI API Failures

| Scenario | Detection | Fallback | User Impact |
|----------|-----------|----------|-------------|
| Claude Haiku timeout (classification) | Edge Function timeout > 10s | Create notification with `document_type_guess = null`, status = `unprocessed` | Notification appears without type label |
| Claude Haiku 429 (rate limit) | HTTP 429 | Exponential backoff: 2s, 4s, 8s (3 retries) | Processing delayed by seconds |
| Claude Sonnet Vision timeout (OCR) | Edge Function timeout > 30s | Fallback to Google Cloud Vision | Toast: "Using backup document scanner" |
| Claude Sonnet Vision 5xx | HTTP 5xx | Fallback to Google Cloud Vision | Toast: "Using backup document scanner" |
| Google Cloud Vision failure | API error | Create blank transactions with `status = 'manual_entry_required'` | Toast: "Document could not be processed. Please enter manually." |
| Claude Sonnet timeout (narrative) | Edge Function timeout | Return report without narrative (`aiNarrative: null`) | Report generated without summary text |

### 11.2 Gmail API Failures

| Scenario | Detection | Fallback | User Impact |
|----------|-----------|----------|-------------|
| Token revoked | 401 `invalid_grant` | Set `gmail_connections.status = 'revoked'` | Banner: "Gmail disconnected. Reconnect in Settings." |
| Rate limited | HTTP 429 | Exponential backoff | Email processing delayed |
| Push notification delay | No notifications > 1 hour | None (Gmail delivers eventually) | Banner: "Email sync may be delayed." |

### 11.3 Google Sheets API Failure

| Scenario | Detection | Fallback | User Impact |
|----------|-----------|----------|-------------|
| API outage | API error | PDF export remains available | Toast: "Sheets export failed. Export as PDF instead." |
| Client folder not configured | `google_sheet_folder_url` is null | Return 422 | Toast: "No Google Sheets folder configured for this client." |

---

## 12. Data Types Reference

### 12.0 Naming Convention: camelCase vs snake_case

**Edge Function request/response bodies:** Use `camelCase` for all field names (e.g., `clientId`, `reportType`, `transactionsCreated`). This matches TypeScript/JavaScript conventions and the Toolbox frontend's naming.

**PostgREST (Supabase SDK) responses:** Use `snake_case` matching PostgreSQL column names (e.g., `client_id`, `report_type`, `created_at`). The Supabase SDK returns column names as-is from the database.

**Frontend convention:** The Toolbox frontend transforms PostgREST `snake_case` responses to `camelCase` at the Supabase client layer using the generated TypeScript types from `supabase gen types`. Edge Function responses arrive pre-formatted in `camelCase` and require no transformation.

### 12.1 Monetary Values

All monetary amounts are `string` (not `number`) in API responses to prevent floating-point precision loss. Format: decimal with exactly 2 places (e.g., `"1250000.00"`, `"0.50"`). Currency is always PHP in v1.

### 12.2 Dates and Timestamps

| Format | Usage | Example |
|--------|-------|---------|
| ISO date (`YYYY-MM-DD`) | Transaction dates, period boundaries, due dates | `"2026-01-15"` |
| ISO timestamp (`YYYY-MM-DDTHH:mm:ssZ`) | Created/updated timestamps, sent_at, approved_at | `"2026-04-15T10:30:00Z"` |

All timestamps are UTC (timezone `Z`). The frontend converts to Philippine Standard Time (UTC+8) for display.

### 12.3 UUIDs

All entity IDs are UUID v4 strings. Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

### 12.4 Enums

| Enum | Values |
|------|--------|
| Lead stage | `lead`, `contacted`, `call_booked`, `proposal_sent`, `negotiation`, `closed_won`, `closed_lost` |
| Lead source | `website_form`, `cal_booking`, `referral`, `manual` |
| Client business type | `sole_prop`, `opc`, `corporation` |
| Client BIR registration | `vat`, `non_vat` |
| Client status | `active`, `inactive` |
| Revenue bracket | `below_250k`, `250k_500k`, `500k_1m`, `1m_3m`, `above_3m` |
| Transaction type | `credit`, `debit` |
| Transaction status | `pending`, `in_review`, `approved`, `rejected`, `manual_entry_required` |
| Email notification status | `unprocessed`, `processing`, `processed`, `failed`, `dismissed` |
| Document type guess | `receipt`, `bank_statement`, `invoice`, `credit_card_statement`, `expense_report`, `payroll_data`, `other` |
| Invoice status | `draft`, `sent`, `paid` |
| Task priority | `low`, `medium`, `high` |
| Task status | `todo`, `in_progress`, `done` |
| Deadline type | `monthly_bookkeeping`, `monthly_vat`, `quarterly_bir`, `quarterly_financials`, `annual_itr`, `annual_financials` |
| Deadline status | `upcoming`, `in_progress`, `completed` |
| Report type | `profit_and_loss`, `balance_sheet`, `cash_flow`, `bank_reconciliation`, `ar_ageing`, `ap_ageing`, `general_ledger`, `trial_balance` |
| BIR form record status | `draft`, `prefill_pending`, `prefill_complete`, `exported` |
| Account type | `asset`, `liability`, `equity`, `revenue`, `expense` |
| Normal balance | `debit`, `credit` |
| User role | `admin`, `accountant` |
| Gmail connection status | `active`, `token_expired`, `revoked`, `error` |
| BIR field mapping type | `sum_category`, `sum_account_type`, `computed`, `static`, `client_field` |

---

## 13. Input Validation

All Edge Functions validate input using Zod schemas before processing. Shared validation schemas live in `packages/db/src/schemas/`.

### 13.1 Validation Rules

| Field Pattern | Rule |
|---------------|------|
| UUID fields | Must match UUID v4 format |
| Email fields | RFC 5322 compliant |
| ISO date fields | Must parse as valid date; `periodEnd` must be ≥ `periodStart` |
| Amount strings | Must match `^\d{1,13}\.\d{2}$` (positive, 2 decimal places) |
| TIN | Must match `^\d{3}-\d{3}-\d{3}(-\d{3})?$` |
| Enum fields | Must be one of the defined values (see Section 12.4) |
| Text fields | Max length enforced per field (see table schemas in tech spec) |
| `message` (contact form) | 10–1000 characters |
| `subject` (send-email) | 1–255 characters |
| `body` (send-email) | 1–5000 characters |

### 13.2 Validation Error Response

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [
      { "field": "clientId", "issue": "Required" },
      { "field": "periodEnd", "issue": "Must be on or after periodStart" },
      { "field": "reportType", "issue": "Must be one of: profit_and_loss, balance_sheet, cash_flow, bank_reconciliation, ar_ageing, ap_ageing, general_ledger, trial_balance" }
    ],
    "request_id": "req_xyz789"
  }
}
```

---

## Decisions

Key decisions made in this API specification.

| # | Decision | Rationale | Rejected Alternative |
|---|----------|-----------|---------------------|
| A1 | **Per-function auth model: JWT for Toolbox functions, Pub/Sub signature for `gmail-webhook`, no auth for contact form, service role for internal/cron functions** | Each function has a different caller with different auth capabilities. Gmail Pub/Sub doesn't send JWTs — it authenticates via subscription identity. The contact form is public by design. Internal functions called server-to-server use the service role key. | Uniform JWT for all functions (impossible for Gmail webhook; would block public contact form). API key header for webhook (Google Pub/Sub doesn't support custom headers on push delivery). |
| A2 | **Contact form CORS locked to `https://numera.ph` — no wildcard** | The endpoint creates CRM lead records (a write operation with side effects). A wildcard origin would allow any website to inject leads into the CRM. The marketing site is the only legitimate caller. | `Access-Control-Allow-Origin: *` (exposes write endpoint to any origin, enables spam injection). No CORS headers (blocks legitimate cross-origin requests from the marketing site hosted on a different subdomain than the API). |
| A3 | **Two separate email-sending Edge Functions: `send-invoice` and `send-email`** | `send-invoice` has specialized logic: fetch invoice data, render PDF, format professional invoice email, attach PDF, update invoice status to `sent`. `send-email` is generic compose-and-send for follow-ups and reminders. Combining them into one function with a `type` discriminator would mix two different workflows (template-driven invoice delivery vs. freeform text email) behind one overloaded interface. | Single `send-email` function with a `type` parameter (`type: 'invoice' | 'general'`). This merges two distinct workflows into one function with conditional logic paths, making the function harder to test, harder to trace in logs, and harder to set individual timeouts. |
| A4 | **Date ranges as explicit `periodStart`/`periodEnd` ISO dates — frontend translates period aliases** | The API accepts unambiguous date boundaries. The frontend maps user-friendly selectors ("Q1 2026", "January 2026", "FY 2025") to concrete dates. This keeps the API contract simple and avoids the Edge Function needing to know fiscal year logic for alias resolution. The `prefill-bir-form` endpoint uses `filingPeriod` (e.g., `Q1-2026`) because BIR forms are inherently period-based and the Edge Function already loads client fiscal year data to resolve dates. | Accept period aliases (`Q1-2026`, `FY2025`) directly in `generate-report`. Requires the Edge Function to resolve aliases using client-specific fiscal year data, duplicating logic that the frontend already needs for its date picker UI. Creates ambiguity (is "Q1" calendar Q1 or fiscal Q1?). |
| A5 | **`suggest-category` as a separate client-facing Edge Function (distinct from internal `categorize-transaction`)** | The accountant needs to request category suggestions interactively for individual transactions — either during manual review (re-suggest) or during manual data entry. The internal `categorize-transaction` is batch-oriented (called during document processing) and uses the service role key. The client-facing version accepts either a `transactionId` (to re-suggest) or raw transaction data (for manual entry). | Expose `categorize-transaction` directly to the client. This would require changing its auth model (currently service-role internal) and adding input validation for two different use cases in one function. |
| A6 | **Monetary values as strings in API responses** | JavaScript `number` type uses IEEE 754 floating-point, which cannot precisely represent all decimal values (e.g., `0.1 + 0.2 !== 0.3`). Financial data must be exact. PostgreSQL `numeric(15,2)` stores exact decimals; transmitting as strings preserves precision through JSON serialization. The frontend uses string-based decimal libraries for display. | Numeric JSON values (`"amount": 1250000.00`). JSON numbers are IEEE 754 floats — precision loss is possible on large amounts. Rounding errors in financial data are unacceptable. |
| A7 | **Edge Function error envelope is distinct from PostgREST error format** | PostgREST errors follow Supabase SDK conventions (different shape). Edge Functions use a custom envelope with `error.code`, `error.message`, `error.details`, and `error.request_id`. Attempting to unify would fight the Supabase SDK's built-in error handling. Frontend code handles each surface's error shape in its respective API layer. | Unified error format across PostgREST and Edge Functions (would require a PostgREST wrapper or middleware to reshape Supabase SDK errors, adding complexity with no user benefit). |
| A8 | **`prefill-bir-form` accepts `filingPeriod` string (not `periodStart`/`periodEnd`)** | BIR forms are inherently period-specific (`Q1-2026`, `2026-01`, `2026`). The Edge Function already loads client fiscal year data and form templates — it can resolve the period to dates internally. Using a period identifier also matches the `bir_tax_form_records.filing_period` column directly. Consistency with the BIR domain model outweighs API uniformity with `generate-report`. | Same `periodStart`/`periodEnd` as `generate-report` (would lose the BIR period identifier, requiring an extra translation step when creating `bir_tax_form_records` rows). |
