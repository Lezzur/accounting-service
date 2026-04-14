# Pipeline: Numera Accounting Service — Spec Production

### 1. Product Requirements Document
- room: numera-prd
- output: PRD-numera-accounting.md
- assigned: lisa
- agents: lisa, light, nami
- source: DISCOVERY.md
- reasoning: extended
- kickoff: |
  Produce the Product Requirements Document for the Numera Accounting Service.
  Use the **PRD skill** — follow its exact section structure, writing principles,
  and review checklist. The PRD must be a single self-contained file.

  The DISCOVERY.md file has been delivered to this room. It contains all settled
  decisions, approved workflows, design system tokens, and scope boundaries.
  Read it completely before writing anything.

  **Project summary:** Numera is an accounting service platform for a PH-based
  bookkeeping and tax prep firm. Three surfaces:
  1. **Marketing Website** — mobile-first lead gen site. Contact form + Cal.com
     booking. No client login. SSR via Next.js for SEO.
  2. **CRM Module** (inside the Toolbox) — desktop-first. Lead pipeline
     (Lead → Contacted → Call Booked → Proposal Sent → Negotiation →
     Closed Won / Closed Lost), client profiles with onboarding data,
     task tracking, billing/invoicing (manual payment).
  3. **Workdesk Module** (inside the Toolbox) — desktop-first. Email-to-transaction
     pipeline (Gmail agent → notification → manual trigger → Claude Vision OCR →
     Supabase → spreadsheet-like data grid → accountant review → approval),
     document processing, transaction categorization, financial report generation
     (P&L, balance sheet, cash flow, bank recon, AR/AP aging, GL, trial balance),
     BIR tax form preparation (all relevant forms: 2551Q, 2550M/Q, 1701, 1701Q,
     1702, 1702Q, withholding/remittance), deadline tracking, invoice sending
     via Gmail, export to Google Sheets/PDF.

  **Users:**
  - Primary: The accountant (daily Toolbox user)
  - Secondary: Rick (developer/operator)
  - Secondary: Prospective clients (website visitors)
  - Anti-users: Large enterprises

  **Hard constraints:**
  - Team: 1 accountant + 1 developer (solo dev maintains the codebase)
  - Budget: Free/low-cost tiers only (Supabase free, Vercel free)
  - Jurisdiction: Philippines only, BIR compliance mandatory
  - Single-tenant architecture
  - Gmail is the document intake channel — no client portal
  - Google Sheets is export/delivery format only, not primary data store

  **Requirements for the PRD:**
  - Every feature must have explicit state specifications: default, loading,
    error, empty, success, disabled. If a list can have zero items, specify
    what the user sees. If an API call fails, specify what the user sees.
  - Every requirement must be specific and testable. No "user-friendly",
    no "fast performance" without a number. No TBD.
  - Include the CRM pipeline stages exactly as defined in discovery.
  - Include the email-to-transaction workflow exactly as defined (Tony's Option C).
  - Include the client onboarding checklist fields exactly as defined.
  - Include the deliverable cadence (monthly/quarterly/annual) as defined.
  - Scope section must list v1 in-scope AND explicitly out-of-scope items
    with one-line reasons.
  - Write for the builder, not the stakeholder. This is not a pitch deck.

  After drafting, run the PRD skill's review checklist. Every item must pass.
  Upload the final document to the project repository at
  https://github.com/Lezzur/accounting-service.git on branch agent/lisa.

### 2. Technical Specification
- room: numera-tech-spec
- output: TECH-SPEC-numera-accounting.md
- assigned: tony-stark
- agents: tony-stark, lisa
- requires: PRD-numera-accounting.md
- source: DISCOVERY.md
- reasoning: extended
- kickoff: |
  Produce the Technical Specification for the Numera Accounting Service.
  Use the **tech-spec skill** — follow its exact template including architecture,
  data models, API contracts, failure modes, security, monitoring, and deployment.

  The DISCOVERY.md and PRD-numera-accounting.md have been delivered to this room.
  Read both completely. The discovery doc has the locked architecture decisions.
  The PRD has the exact feature requirements you're building to.

  **Architecture (locked decisions from discovery):**
  - Stack: Next.js 14+ (App Router) + TypeScript + Tailwind CSS + shadcn/ui
  - Backend: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
  - AI: Claude API (document parsing, categorization, report drafts) +
    Claude Vision / Google Cloud Vision (OCR)
  - Email: Gmail API + Supabase Edge Functions
  - Hosting: Vercel + Supabase (managed)
  - Monorepo: Turborepo
  - Booking: Cal.com (embed on marketing site)
  - Data architecture: Supabase is source of truth. Spreadsheet-like grid UI
    (TanStack Table or AG Grid) in the Workdesk. Google Sheets is export only.

  **Critical technical areas to spec in detail:**

  1. **Supabase schema design** — This is the backbone. Design the full schema:
     - Chart of accounts (standard PH chart of accounts for SMBs)
     - Transactions table (with debit/credit, account_id, category, date,
       source_document reference, reconciliation status, approval status)
     - Clients table (all onboarding fields from discovery: business name, type,
       TIN, address, industry, BIR reg type, fiscal year, Gmail, revenue bracket)
     - Leads table (pipeline stage, contact info, notes, activity log)
     - Invoices table (line items, status: draft/sent/viewed/paid, client_id)
     - Documents table (uploaded files, OCR status, parsed data reference)
     - Deadlines table (monthly/quarterly/annual, client_id, type, due_date, status)
     - Audit log table (every data mutation timestamped and attributed)
     Use PostgreSQL `numeric` type for all monetary values. Enforce referential
     integrity with foreign keys. Design RLS policies even though single-tenant
     (future-proofing for multi-tenant). Include exact column types, constraints,
     and indexes.

  2. **AI pipeline architecture** — Spec the full flow:
     - Gmail agent: how it polls/webhooks, how it classifies emails, how it
       distinguishes client document emails from noise, error handling for
       false positives/negatives
     - Document OCR: Claude Vision vs Google Cloud Vision decision tree,
       input formats (PDF, JPG, PNG, CSV), output schema, confidence scoring
     - Transaction categorization: how AI maps extracted data to chart of
       accounts, confidence thresholds, human review triggers
     - Report generation: how P&L / balance sheet / cash flow are computed
       from the transactions table (SQL queries), template rendering
     - BIR form generation: template system design, how forms pull from
       Supabase data, how template updates are handled when BIR changes forms

  3. **Gmail integration** — Edge Function design:
     - Webhook vs polling architecture
     - Email classification logic
     - Attachment download and storage (Supabase Storage)
     - Notification pipeline to Workdesk
     - Rate limit handling
     - OAuth flow for Gmail access

  4. **Monorepo structure** — Detail every package:
     - apps/web: Next.js marketing site (SSR, SEO)
     - apps/toolbox: Next.js Toolbox app (CRM + Workdesk)
     - packages/ui: shadcn/ui component library with design tokens
     - packages/db: Supabase client, generated types, migration scripts
     - packages/ai: AI pipeline modules (OCR, categorization, report gen)
     - supabase/migrations: schema versioning
     - supabase/functions: Edge Functions

  5. **Auth flow** — Supabase Auth for Toolbox access. No client auth.
     Email/password for the accountant and Rick. Define session management,
     token refresh, and protected route patterns.

  6. **Failure modes** — For every critical path (email ingestion, OCR,
     transaction write, report generation), define: what can fail, how the
     system detects failure, what the user sees, and how recovery works.

  Every technical decision must include rationale and rejected alternatives.
  Include Mermaid diagrams for: system architecture, data flow (email to
  transaction), database ER diagram, and deployment architecture.

  Upload the final document to the project repository at
  https://github.com/Lezzur/accounting-service.git on branch agent/tony-stark.

### 3. UI Design
- room: numera-ui-design
- output: UI-DESIGN-numera-accounting.md
- assigned: ayanokoji
- agents: ayanokoji, winry, levi
- requires: PRD-numera-accounting.md
- source: DISCOVERY.md
- reasoning: extended
- kickoff: |
  Produce the UI Design specification for the Numera Accounting Service.
  Use the **ui-design skill** to create screen designs via Google Stitch.

  The DISCOVERY.md and PRD-numera-accounting.md have been delivered to this room.
  Read both completely. The discovery doc contains the locked design system tokens
  (colors, typography, spacing, radius, elevation, motion) and navigation patterns.
  The PRD contains the exact feature requirements each screen must satisfy.

  **Design system (locked — from discovery):**
  - Primary: teal-600 (#0d9488)
  - Font: Inter (variable)
  - Toolbox base: 14px, Website base: 16px
  - Toolbox background: slate-50 (#f8fafc), Website background: white
  - Sidebar nav for Toolbox (240px expanded, 64px collapsed, module switcher)
  - Sticky top nav for Website (transparent → white on scroll, hamburger at 768px)
  - Working brand: Numera

  **Design references (from discovery):**
  - Primary: https://www.doola.com/ (modern, rounded, warm, generous whitespace)
  - Secondary: https://milestone.inc/ (professional tone, less rounded)

  **Three design contexts — produce screens for ALL of these:**

  **A. Marketing Website (mobile-first, desktop-second):**
  - Homepage / landing page: hero section, services overview, trust signals,
    CTA to contact/book call
  - Contact section: form (name, email, phone, business name, message) +
    Cal.com booking embed
  - Max content width: 1200px centered
  - Hamburger menu at 768px breakpoint
  - Design both mobile (375px) and desktop (1440px) versions

  **B. CRM Module (desktop-first):**
  - Dashboard: pipeline overview, lead counts by stage, upcoming tasks
  - Leads view: Kanban board (Lead → Contacted → Call Booked → Proposal Sent →
    Negotiation → Closed Won / Closed Lost) with card previews
  - Lead detail: contact info, activity timeline, notes, stage management
  - Clients list: table view with search/filter, status indicators
  - Client detail: profile data (all onboarding fields), engagement history,
    linked Workdesk projects, deadline calendar
  - Invoices: list view with status badges (Draft / Sent / Viewed / Paid),
    invoice creation/editing form
  - Left sidebar with module switcher (CRM ↔ Workdesk)

  **C. Workdesk Module (desktop-first):**
  - Dashboard: notifications (new emails from clients), upcoming deadlines,
    active client work summary
  - Transaction grid: THIS IS THE MOST CRITICAL SCREEN. Must feel like a
    spreadsheet. Columns: date, description, account, category, debit, credit,
    status (pending/approved/reconciled), source document link. Inline editing.
    Sortable columns. Bulk actions. Filter by client, date range, category,
    status. The accountant will spend 80% of their time here.
  - Document processing view: uploaded document preview (left panel) +
    extracted data preview (right panel) + approve/edit/reject actions
  - Report generation: select client, select report type, select date range,
    generate → preview → export (PDF / Google Sheets)
  - Deadline tracker: calendar or list view, color-coded by urgency
    (green = on track, amber = approaching, red = overdue)
  - Email notifications panel: list of flagged client emails, attachment
    previews, "Process" action button

  **For every screen, design ALL states:**
  - Default (with data)
  - Empty (zero items — what does the user see?)
  - Loading (skeleton, spinner, or shimmer — specify which)
  - Error (API failure — what message, what recovery action?)

  **Output format:** For each screen, include:
  1. Google Stitch screen ID and image
  2. Annotated description of every element, interaction, and state
  3. Responsive behavior notes (what changes at breakpoints)

  Upload the final document to the project repository at
  https://github.com/Lezzur/accounting-service.git on branch agent/ayanokoji.

### 4. API Specification
- room: numera-api-spec
- output: API-SPEC-numera-accounting.md
- assigned: tony-stark
- agents: tony-stark, light
- requires: TECH-SPEC-numera-accounting.md
- source: DISCOVERY.md
- reasoning: extended
- kickoff: |
  Produce the API Specification for the Numera Accounting Service.
  Use the **api-spec skill** — follow its format for REST endpoints (OpenAPI 3.1
  style) with full request/response schemas, error shapes, and examples.

  The DISCOVERY.md and TECH-SPEC-numera-accounting.md have been delivered to this
  room. Read both completely. The tech spec defines the architecture and data
  models — the API spec defines the contracts between frontend and backend.

  **Architecture context:**
  - Frontend: Next.js (App Router) calling Supabase
  - Backend: Supabase (PostgREST auto-generated APIs + custom Edge Functions)
  - Two apps consume the API: Marketing Website + Toolbox (CRM + Workdesk)

  **Spec these API surfaces:**

  1. **Supabase PostgREST (auto-generated)** — Document which tables are
     exposed, what RLS policies govern access, and any custom views or
     functions. The frontend calls these directly via @supabase/supabase-js.
     Spec the key query patterns:
     - Leads: CRUD, filter by pipeline stage, update stage
     - Clients: CRUD, search, filter by status/industry
     - Transactions: CRUD, bulk operations, filter by client/date/category/status,
       aggregations for reports
     - Invoices: CRUD, status transitions, line item management
     - Documents: upload, status tracking, link to transactions
     - Deadlines: CRUD, filter by client/date range/status

  2. **Custom Edge Functions** — These handle logic too complex for PostgREST:
     - `POST /functions/v1/process-document` — Receives a document ID, triggers
       Claude Vision OCR, writes parsed data to transactions. Input: document_id.
       Output: extracted transactions array with confidence scores.
     - `POST /functions/v1/generate-report` — Generates financial report for a
       client. Input: client_id, report_type (pnl | balance_sheet | cash_flow |
       bank_recon | ar_aging | ap_aging | gl | trial_balance), date_range.
       Output: report data object + export URLs (PDF, Google Sheets).
     - `POST /functions/v1/gmail-webhook` — Receives Gmail push notifications.
       Processes inbound emails, classifies them, downloads attachments to
       Supabase Storage, creates document records, triggers Workdesk notifications.
     - `POST /functions/v1/send-invoice` — Sends invoice via Gmail. Input:
       invoice_id. Output: sent status, message_id.
     - `POST /functions/v1/send-email` — Generic email sending (follow-ups,
       reminders). Input: to, subject, body, client_id. Output: sent status.
     - `POST /functions/v1/generate-bir-form` — Generates pre-filled BIR form.
       Input: client_id, form_type, period. Output: form data + PDF URL.
     - `POST /functions/v1/categorize-transaction` — AI categorization of a
       single transaction. Input: transaction_id or raw transaction data.
       Output: suggested account, category, confidence score.

  3. **Website contact form** — Public endpoint (no auth):
     - `POST /functions/v1/contact` — Receives contact form submission.
       Input: name, email, phone, business_name, message.
       Output: success confirmation. Side effect: creates lead in CRM.

  **For every endpoint, specify:**
  - HTTP method and path
  - Auth requirements (public, authenticated, role-based)
  - Request schema (with types, required/optional, validation rules)
  - Response schema (success and error shapes)
  - At least one realistic request/response example per endpoint
  - Error codes and messages (400, 401, 404, 422, 500 — what does each mean
    for this specific endpoint?)
  - Rate limits if applicable

  Upload the final document to the project repository at
  https://github.com/Lezzur/accounting-service.git on branch agent/tony-stark.

### 5. Spec Review and QA
- room: numera-spec-review
- output: SPEC-REVIEW-numera-accounting.md
- assigned: l-lawliet
- agents: l-lawliet, lisa, tony-stark
- requires: PRD-numera-accounting.md, TECH-SPEC-numera-accounting.md, API-SPEC-numera-accounting.md, UI-DESIGN-numera-accounting.md
- source: DISCOVERY.md
- reasoning: extended
- kickoff: |
  Perform a comprehensive QA review of all four specification documents produced
  for the Numera Accounting Service.

  Five documents have been delivered to this room:
  - DISCOVERY.md (the approved discovery brief — source of truth for decisions)
  - PRD-numera-accounting.md (product requirements)
  - TECH-SPEC-numera-accounting.md (technical specification)
  - API-SPEC-numera-accounting.md (API contracts)
  - UI-DESIGN-numera-accounting.md (UI design specification)

  Read ALL five documents completely before writing anything.

  **Review each document against these criteria:**

  1. **Completeness** — Every decision in DISCOVERY.md must be reflected in the
     specs. Check every one of the 19 decisions in the decisions log. Check every
     workflow in section 10. Check every in-scope item in section 6. If any
     decision or requirement is missing from the specs, flag it with the exact
     decision number and what's missing.

  2. **Consistency** — No contradictions between documents. If the PRD says one
     thing and the Tech Spec says another, flag it with exact quotes from both.
     Check: data models match between Tech Spec and API Spec. UI screens match
     PRD feature requirements. API endpoints cover every interaction the UI needs.
     Pipeline stages in PRD match CRM implementation in Tech Spec.

  3. **Specificity** — No vague language. No "should be fast", no "user-friendly",
     no "as needed", no TBD. Every requirement must be testable. Flag any
     sentence that a developer would need to ask a follow-up question about.

  4. **Feasibility** — Does the Tech Spec's architecture actually support every
     PRD requirement? Are there features in the PRD that have no corresponding
     technical implementation? Are there API endpoints that don't map to any
     UI interaction or feature?

  5. **State coverage** — For every feature in the PRD and every screen in the
     UI Design: are default, loading, error, empty, and success states defined?
     Flag any screen or feature missing state specifications.

  6. **Design system compliance** — Does the UI Design use the exact tokens
     locked in DISCOVERY.md section 9? Flag any deviation.

  7. **Scope adherence** — Do any specs include features listed as out-of-scope
     or deferred in DISCOVERY.md section 6? Flag any scope creep.

  **Output format:**

  Produce SPEC-REVIEW-numera-accounting.md with:
  - Executive summary: overall quality assessment (pass / pass with issues / fail)
  - Per-document review (PRD, Tech Spec, API Spec, UI Design) with:
    - Strengths (brief)
    - Issues found (numbered, categorized as Critical / Major / Minor)
    - Each issue: quote the problematic text, explain why it's an issue,
      suggest the fix
  - Cross-document consistency matrix: which documents align, which conflict
  - Final verdict: is this spec set ready for a developer to build from?

  Be ruthless. The purpose of this review is to catch every gap before a
  developer starts building. A missed requirement here becomes a rewrite later.

  Upload the final document to the project repository at
  https://github.com/Lezzur/accounting-service.git on branch agent/l-lawliet.
