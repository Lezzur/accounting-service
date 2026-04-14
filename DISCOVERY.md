# Discovery Brief — Accounting Service (Numera)

**Date:** 2026-04-14
**Participants:** Rick (business owner/developer), Tony Stark (architecture), Lisa Hayes (coordination), Ayanokoji (design system), Light (workflow design), Nami (business strategy)
**Status:** Approved
**Confidence:** High
All critical sections settled. Core architecture, stack, design system, and workflows are locked. Remaining open items are non-blocking for spec work.

---

## 1. Problem Space

- **The problem:** Small and medium businesses in the Philippines need reliable, affordable bookkeeping and tax prep services. Most small firms still rely on manual processes, scattered spreadsheets, and paper-based BIR compliance — leading to missed deadlines, errors, and wasted time for both the accountant and the client.

- **Who experiences it:** SMB owners who don't have in-house accounting staff and need external bookkeeping and tax filing handled for them. Also experienced by the accountant servicing these clients, who spends time on repetitive data entry, document collection, and form preparation that could be automated.

- **Current workarounds:** Clients manage their own spreadsheets or hand physical receipts to their accountant. Accountants manually key in transactions, manually prepare BIR forms, and chase clients for missing documents via text/email. No centralized system — everything is fragmented across email threads, Viber groups, and Excel files.

- **Why now:** AI capabilities (document parsing via vision models, transaction categorization, automated report generation) have matured to the point where a two-person team (1 accountant + 1 developer) can deliver the same throughput as a traditional firm with 5-10 staff. The automation layer is the competitive advantage.

- **Evidence quality:** Settled
Rick is building this for his own firm with a specific accountant partner. The problem is firsthand, not hypothetical.

## 2. Users and Context

### Primary User: The Accountant (Rick's Partner)
- **Who they are:** A practicing accountant who handles bookkeeping and tax prep for multiple SMB clients. Works with the Toolbox (CRM + Workdesk) daily.
- **Context of use:** Sits at a desktop, processes client documents, categorizes transactions, prepares financial reports and BIR forms. Receives client documents primarily via email.
- **What success looks like:** Spends less time on data entry and document chasing. AI handles the extraction; the accountant reviews, corrects, and approves. Monthly deliverables are generated from the system, not built from scratch each cycle.
- **What makes them leave:** If the system is slower than their current spreadsheet workflow. If data integrity is unreliable. If the UI is confusing or requires more clicks than a spreadsheet for routine tasks.

### Secondary User: Rick (Developer / System Operator)
- **Who they are:** The developer who builds and maintains the AI automation layer. Uses the Toolbox to monitor AI pipeline health, manage system configuration, and handle technical issues.
- **Context of use:** Builds and iterates on AI workflows, monitors email ingestion pipeline, troubleshoots failures, adds new automation capabilities over time.
- **What success looks like:** The system runs with minimal manual intervention. New workflows can be added modularly without rewriting existing ones.

### Secondary User: Prospective Clients (Website Visitors)
- **Who they are:** SMB owners in the Philippines looking for accounting services. They land on the marketing website.
- **Context of use:** Browsing on mobile (primarily), evaluating whether to engage. They want to understand services, pricing approach, and how to get started.
- **What success looks like:** They send a message or book a discovery call through the website.
- **What makes them leave:** Unclear service offerings. No easy way to reach out. Slow or broken mobile experience.

### Anti-Users
- **Who this is NOT for:** Large enterprises with complex multi-entity accounting, audit requirements, or payroll processing needs.
- **Why excluding them matters:** Designing for enterprise complexity would bloat the system and compromise the lean, focused architecture. v1 is bookkeeping + tax prep for SMBs only.

- **Evidence quality:** Settled

## 3. Proposed Solution Shape

Three components, one integrated system:

1. **Marketing Website** — Public-facing lead generation site. Communicates services, builds trust, captures leads via contact form and Cal.com call booking. Mobile-first, desktop-second.

2. **Toolbox** — Internal application with two modules:
   - **CRM** — Manages leads and clients through the sales pipeline and ongoing engagement lifecycle.
   - **Workdesk** — Where client work happens. Document processing, transaction management, report generation, invoice sending, deadline tracking, and AI automation workflows. Desktop-first, mobile-second.

- **Product type:** Web application (Next.js)
- **Core interaction model:** The CRM is pipeline/list management. The Workdesk is task-driven with a spreadsheet-like data grid for transaction review and approval.
- **Key differentiator:** AI automation layer that handles document ingestion, OCR/parsing, transaction categorization, and report generation — reducing the accountant's manual workload by automating the repetitive data entry and form preparation.
- **Delivery model:** Self-hosted SaaS-style (Vercel + Supabase). Single-tenant for the foreseeable future. Multi-tenant/SaaS is a far-future consideration.

- **Evidence quality:** Settled

## 4. Prior Art and Competitive Landscape

### Design References (Not Direct Competitors)
| Product | Strengths | Weaknesses | Relevance |
|---------|-----------|------------|-----------|
| [Doola](https://www.doola.com/) | Clean, modern, rounded UI. Generous whitespace. Warm and approachable. Strong CTA hierarchy. | US-focused, not PH-relevant for compliance | **Primary design reference.** Teal accent, Inter font, rounded cards, minimal shadows — all drawn from Doola's visual language. |
| [Milestone](https://milestone.inc/) | Professional, trustworthy. Traditional corporate feel. Clean typography. | Flatter, more serif-heavy, less modern | **Secondary design reference.** Used for professional tone calibration. Numera pulls the modern warmth of Doola over Milestone's corporate formality. |

### Adjacent Solutions
- **QuickBooks / Xero / FreshBooks** — Full accounting platforms. Overkill for a small PH firm's needs. Expensive. Not optimized for BIR compliance. Rick explicitly rejected integrating with these — this is custom dev.
- **JuanTax** — PH-specific tax filing tool. Handles BIR form generation but not full bookkeeping. Potential reference for BIR form templates but not a direct competitor to the full-service model.
- **Generic CRMs (HubSpot, Zoho)** — Too many bells and whistles. Rick explicitly rejected these as bloated for a focused accounting practice.

### Key Takeaways
- No existing tool combines CRM + bookkeeping workdesk + AI automation for PH-based accounting firms
- The gap is specifically: an integrated system where AI handles document ingestion and the accountant reviews/approves, with BIR compliance built in
- Existing tools are either too broad (generic CRMs), too narrow (tax-only), or not PH-localized

- **Evidence quality:** Leaning
Design references were studied in detail. Competitive landscape was discussed directionally but not deeply researched. No formal competitive analysis was conducted.

## 5. Technical Feasibility

### Architecture: Tony's Option C (Locked)

**Supabase is the source of truth. Workdesk presents data in a spreadsheet-like grid UI. Google Sheets is an output/delivery format only.**

- **Platform:** Web application (Next.js 14+ with App Router)
- **Database:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI Layer:** Claude API for document parsing, transaction categorization, and report drafts. Claude Vision or Google Cloud Vision for OCR (bank statement images, receipts).
- **Email Integration:** Gmail API + Supabase Edge Functions. AI agent classifies and filters inbound client emails. Workdesk receives notifications.
- **Hosting:** Vercel (Next.js frontend) + Supabase (managed backend)
- **Monorepo:** Turborepo — one developer, shared packages, single deploy pipeline. Polyrepo rejected because it creates unnecessary overhead for a solo dev maintaining shared components.
- **Call Booking:** Cal.com (open source, embeddable, connects to Google Calendar)

### Full Stack

```
Frontend:     Next.js 14+ (App Router) + TypeScript + Tailwind CSS + shadcn/ui
Backend/DB:   Supabase (PostgreSQL + Auth + Storage + Edge Functions)
AI Layer:     Claude API (document parsing, categorization, report drafts)
              Claude Vision / Google Cloud Vision (OCR for images)
              Gmail API (email scanning agent)
Email:        Gmail API + Supabase Edge Functions (webhook receiver)
Hosting:      Vercel (Next.js) + Supabase (managed)
Monorepo:     Turborepo
Booking:      Cal.com
```

### Repo Structure

```
accounting-service/
├── apps/
│   ├── web/              # Marketing website (mobile-first)
│   └── toolbox/          # CRM + Workdesk (desktop-first)
├── packages/
│   ├── ui/               # Shared component library (shadcn/ui based)
│   ├── db/               # Supabase client, types, migrations
│   └── ai/               # Document parsing, OCR, email scanning pipelines
├── supabase/
│   ├── migrations/       # PostgreSQL schema migrations
│   └── functions/        # Edge Functions (Gmail webhooks, AI triggers)
└── turbo.json
```

### Why Supabase Over Firebase
- Accounting data is inherently relational (transactions → accounts → line items → reports)
- PostgreSQL provides exact decimal precision (`numeric` type) — critical for financial data
- SQL enables complex reporting queries (P&L, balance sheet) natively
- Row-Level Security for future multi-tenant consideration
- Firebase's NoSQL model would fight the data structure at every step

### Why Custom Engine Over Google Sheets as Primary Store
- Google Sheets has no data integrity constraints — accountant can accidentally corrupt the ledger
- AI writes to structured database rows, not fragile cell coordinates
- Reporting is SQL queries, not spreadsheet formula gymnastics
- Sheets API has rate limits that would bottleneck batch processing
- No audit trail queryable from code
- Google Sheets remains as export/delivery format for client-facing reports

### Key Technical Constraints
- Single-tenant architecture (no multi-tenant complexity in v1)
- Gmail is the primary document intake channel (no client portal for document upload)
- All BIR-relevant forms must be supported — templates populated from Supabase data
- Workdesk must be modular/extensible — Rick will add workflows over time

### Known Hard Problems
- **OCR accuracy on Philippine bank statements and receipts** — variable quality, different bank formats. Vision AI accuracy will need iterative tuning per bank.
- **BIR form compliance** — forms change periodically. Template system must be maintainable.
- **Email classification accuracy** — AI agent must reliably distinguish client document emails from noise. False negatives (missed documents) are worse than false positives.

- **Evidence quality:** Settled

## 6. Scope and Boundaries

### In Scope (v1)

**Marketing Website:**
- Landing page with service descriptions
- Contact form (leads can send messages)
- Cal.com embed for booking discovery calls
- Mobile-first, desktop-second
- SEO-optimized (SSR via Next.js)

**CRM Module:**
- Lead management pipeline: Lead → Contacted → Call Booked → Proposal Sent → Negotiation → Closed Won / Closed Lost
- Client profiles with onboarding data:
  - Business name, type (sole prop / OPC / corporation), TIN
  - Registered address, industry
  - BIR registration type (VAT or non-VAT)
  - Fiscal year (calendar or otherwise)
  - Gmail address (for document intake)
  - Monthly revenue bracket (for retainer tier)
  - Assigned Google Sheet folder (for client deliverables)
- Task tracking for active client work
- Billing/invoicing module (invoice generation and sending via Gmail; actual money exchange is manual)
- Desktop-first, mobile-second

**Workdesk Module:**
- Email ingestion pipeline:
  1. Gmail agent classifies and filters inbound client emails
  2. Workdesk surfaces email notification
  3. Accountant manually triggers document processing
  4. Claude Vision reads document (receipt, bank statement, invoice)
  5. Extracted data writes to Supabase (transactions table)
  6. Workdesk displays transaction in spreadsheet-like data grid
  7. Accountant reviews, adjusts category if needed, approves
  8. Transaction is reconciled
- Document processing: OCR/parsing for bank statements, receipts, invoices, credit card statements, purchase invoices/bills, expense reports, payroll data
- Transaction categorization (AI-assisted)
- Financial report generation:
  - Profit & Loss statement
  - Balance sheet
  - Cash flow statement
  - Bank reconciliation report
  - Accounts receivable / payable aging
  - General ledger
  - Trial balance
- Tax prep:
  - All relevant BIR forms (2551Q, 2550M/Q, 1701, 1701Q, 1702, 1702Q, and related withholding/remittance forms)
  - Tax payment schedules
  - Prior-year comparison reports
  - Template-based, pre-filled from Supabase data
- Deadline tracking and reminders:
  - Monthly: Bank reconciliation + transaction categorization (by 15th of following month)
  - Quarterly: Financial statements + BIR filings (per BIR deadlines)
  - Annual: Full financial statements + ITR (by April 15)
- Invoice sending from Workdesk via Gmail
- Export to Google Sheets / PDF for client delivery
- Client onboarding automation (profile creation from CRM data)
- Follow-up email drafting (AI-assisted)
- Desktop-first, mobile-second

**AI Automation:**
- Document ingestion and OCR (Claude Vision / Google Cloud Vision)
- Transaction categorization
- Report generation from structured data
- Deadline reminder system
- Email classification and filtering (Gmail agent)
- Client profile creation assistance
- Follow-up email drafting

### Explicitly Out of Scope
- **Client portal / client login** — clients interact via email only. No self-service portal in v1.
- **Online payments** — invoices are sent, but money exchange is manual (bank transfer, GCash, etc.)
- **Payroll processing** — different regulatory domain, adds significant complexity
- **CFO advisory services** — requires different tooling (forecasting, scenario modeling)
- **Audit services** — different compliance requirements entirely
- **Multi-tenant / SaaS** — single-tenant only. No firm-to-firm isolation or subscription management.
- **Mobile app** — web only. Mobile-responsive, not native.
- **Custom spreadsheet engine** — no built-in spreadsheet renderer. Use TanStack Table / AG Grid for data grid UI. Google Sheets for exports.

### Deferred (v2+)
- **Additional service types** (payroll, advisory) — depends on partner discussion and client demand
- **Multi-tenant SaaS** — far-future consideration if the tool is sold to other firms
- **Client portal** — clients upload docs directly instead of via email
- **Online payment integration** — accept payments through the system
- **Additional Workdesk workflows** — Rick will define these as the practice matures

- **Evidence quality:** Settled

## 7. Constraints and Risks

### Hard Constraints
- **Team size:** 1 accountant + 1 developer. Architecture must be maintainable by a solo dev.
- **Budget:** Lean. Free/low-cost infrastructure tiers (Supabase free tier, Vercel free tier). No paid enterprise tools.
- **Jurisdiction:** Philippines only. BIR compliance is non-negotiable.
- **Email as intake:** Gmail is the document intake channel. System must work within Gmail API capabilities and rate limits.
- **Single tenant:** No multi-tenant architecture overhead.

### Key Risks

| Risk | Likelihood | Impact | Mitigation Discussed |
|------|-----------|--------|---------------------|
| OCR accuracy on PH bank statements varies by bank | High | Medium | Use Claude Vision with fallback to Google Cloud Vision. Iterative tuning per bank format. Accountant always reviews AI output before approval. |
| BIR form templates change without notice | Medium | High | Template system must be easily updatable. Monitor BIR announcements. Forms are data-driven, not hardcoded. |
| Gmail API rate limits on high-volume email processing | Low | Medium | Edge Functions batch processing. Most firms handle 10-50 clients — volume is manageable. |
| Solo developer bottleneck — Rick is the only person who can build/fix the system | High | High | Modular architecture (Turborepo + packages) keeps components independent. Clean code, typed schemas, documented APIs reduce bus factor risk. |
| Accountant adoption — partner may resist new tool if it's slower than spreadsheets | Medium | High | Spreadsheet-like grid UI preserves familiar muscle memory. AI handles grunt work, accountant only reviews. Net workflow must be faster than current process. |
| Scope creep — "scope may expand depending on partner discussion" | Medium | Medium | v1 is locked to bookkeeping + tax prep. Expansion requires explicit scoping before implementation. |

### Open Questions

1. **Specific BIR form enumeration** — All relevant forms must be covered, but the exact list needs validation with the accountant partner. Owner: Rick + accountant. Blocks: Tax prep module schema design.
2. **Additional Workdesk workflows** — Rick stated the Workdesk must be extensible and he will provide additional workflows. Owner: Rick. Blocks: Nothing in v1 (architecture is modular by design).
3. **Service scope expansion timeline** — Depends on partner discussion. Owner: Rick. Blocks: Nothing in v1.

## 8. Key Decisions Log

| # | Decision | Rationale | Made By | Date |
|---|----------|-----------|---------|------|
| 1 | Bookkeeping + tax prep only for v1 | Focused scope for a 2-person team. Payroll, advisory, and audit add regulatory complexity. | Rick | 2026-04-14 |
| 2 | Philippines only | BIR compliance is jurisdiction-specific. No international tax complexity in v1. | Rick | 2026-04-14 |
| 3 | Custom CRM over existing (HubSpot, Zoho) | Existing CRMs are bloated. Rick wants focused, efficient, unbloated tooling purpose-built for an accounting practice. | Rick | 2026-04-14 |
| 4 | Supabase over Firebase | Accounting data is relational. PostgreSQL provides exact decimal precision, SQL reporting, JOINs, and constraints. Firestore's NoSQL model fights accounting data structures. | Rick + Tony | 2026-04-14 |
| 5 | Option C: Supabase as source of truth + spreadsheet-like grid UI + Google Sheets as export only | Custom engine gives data integrity, AI writes to structured DB, reporting via SQL. Google Sheets is delivery format, not primary store. Avoids fragile cell-coordinate AI writes and Sheets API rate limits. | Rick + Tony + Lisa | 2026-04-14 |
| 6 | Monorepo (Turborepo) over polyrepo | One developer, shared packages (UI, DB, AI). Polyrepo creates unnecessary overhead — version bumps, cross-repo PRs, dependency drift. | Rick + Tony | 2026-04-14 |
| 7 | Next.js 14+ / TypeScript / Tailwind / shadcn/ui | SSR for marketing site SEO. SPA behavior for Toolbox. shadcn/ui is composable and unbloated. Tailwind enables shared design tokens. | Tony (recommended), Rick (approved) | 2026-04-14 |
| 8 | Cal.com over Calendly | Open source, embeddable, connects to Google Calendar, zero maintenance. | Rick | 2026-04-14 |
| 9 | Gmail as document intake channel | No client portal needed in v1. Clients already email documents. AI agent scans, classifies, and routes. Low friction for clients. | Rick + Lisa | 2026-04-14 |
| 10 | Manual money exchange (no payment integration in v1) | Invoices are generated and sent, but actual payment is handled outside the system (bank transfer, GCash). Reduces regulatory and integration complexity. | Rick | 2026-04-14 |
| 11 | Single tenant architecture | This is Rick's firm. SaaS/multi-tenant is a far-future consideration. No need for tenant isolation overhead now. | Rick | 2026-04-14 |
| 12 | Working brand: Numera | Derived from "numeral." Clean, professional, universal. Placeholder — can be changed later. | Ayanokoji (proposed), Rick (approved) | 2026-04-14 |
| 13 | Teal-600 (#0d9488) as primary accent | Trustworthy (blue family), modern (not corporate navy). Differentiates from typical accounting firms. AA contrast on white. Aligned with Doola reference. | Ayanokoji (proposed), Rick (approved) | 2026-04-14 |
| 14 | Inter as primary font | Tabular numerals built in (critical for accounting data). Doola uses it. shadcn/ui default. Free, variable, excellent multilingual support. | Ayanokoji (proposed), Rick (approved) | 2026-04-14 |
| 15 | Sidebar navigation for Toolbox | Left sidebar (240px expanded, 64px collapsed). Module switcher at top (CRM / Workdesk). No top nav. | Ayanokoji (proposed), Rick (approved) | 2026-04-14 |
| 16 | Sticky top nav for marketing website | Transparent → white on scroll. Max content width 1200px. Hamburger at 768px. | Ayanokoji (proposed), Rick (approved) | 2026-04-14 |
| 17 | CRM pipeline stages | Lead → Contacted → Call Booked → Proposal Sent → Negotiation → Closed Won / Closed Lost | Rick | 2026-04-14 |
| 18 | Monthly deliverable cadence | Monthly: bank reconciliation + categorization by 15th. Quarterly: financials + BIR filings. Annual: full statements + ITR by April 15. | Lisa (proposed), Rick (approved) | 2026-04-14 |
| 19 | Client onboarding data fields | Business name, type, TIN, address, industry, BIR registration type, fiscal year, Gmail address, revenue bracket, Google Sheet folder. | Lisa (proposed), Rick (approved) | 2026-04-14 |

## 9. Design System (Locked)

Proposed by Ayanokoji, approved by Rick. Full token specification below.

### Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `slate-950` | `#020617` | Darkest text |
| `slate-900` | `#0f172a` | Primary text |
| `slate-700` | `#334155` | Secondary text |
| `slate-500` | `#64748b` | Muted text, placeholders |
| `slate-300` | `#cbd5e1` | Borders (subtle) |
| `slate-200` | `#e2e8f0` | Borders, dividers |
| `slate-100` | `#f1f5f9` | Muted backgrounds |
| `slate-50` | `#f8fafc` | Page background (Toolbox) |
| `white` | `#ffffff` | Cards, page background (website) |
| `teal-700` | `#0f766e` | Primary pressed |
| `teal-600` | `#0d9488` | Primary — CTAs, active states |
| `teal-500` | `#14b8a6` | Primary hover |
| `teal-100` | `#ccfbf1` | Primary tint (tags, badges) |
| `red-500` | `#ef4444` | Destructive, overdue |
| `amber-500` | `#f59e0b` | Warning, approaching deadline |
| `green-500` | `#22c55e` | Success, on-track |

### Semantic Mapping (shadcn/ui CSS Variables)

| Variable | Toolbox | Website |
|---|---|---|
| `--primary` | teal-600 | teal-600 |
| `--background` | slate-50 | white |
| `--foreground` | slate-900 | slate-900 |
| `--card` | white | white |
| `--muted` | slate-100 | slate-100 |
| `--muted-foreground` | slate-500 | slate-500 |
| `--border` | slate-200 | slate-200 |
| `--destructive` | red-500 | red-500 |

### Typography

**Font:** Inter (variable)

| Token | Size | Line Height | Use |
|---|---|---|---|
| `text-xs` | 12px | 16px | Labels, captions, table metadata |
| `text-sm` | 14px | 20px | Toolbox base, secondary text |
| `text-base` | 16px | 24px | Website base, body copy |
| `text-lg` | 18px | 28px | Card titles, section labels |
| `text-xl` | 20px | 28px | Page titles (Toolbox) |
| `text-2xl` | 24px | 32px | Section headings |
| `text-3xl` | 30px | 36px | Page titles (website) |
| `text-4xl` | 36px | 40px | Hero subheading |
| `text-5xl` | 48px | 1 | Hero headline |

**Weights:** 400 (regular), 500 (medium — UI labels, buttons), 600 (semibold — headings), 700 (bold — emphasis only)

**Base size:** Toolbox = 14px, Website = 16px

### Spacing (4px base unit)

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Inline icon gaps |
| `space-2` | 8px | Tight padding |
| `space-3` | 12px | Input padding, small gaps |
| `space-4` | 16px | Card padding (Toolbox), component gaps |
| `space-6` | 24px | Card padding (website), section gaps |
| `space-8` | 32px | Section spacing (Toolbox) |
| `space-12` | 48px | Section spacing (website) |
| `space-16` | 64px | Page-level sections |
| `space-24` | 96px | Hero sections (website) |

### Border Radius

| Token | Toolbox | Website |
|---|---|---|
| `radius-sm` | 4px | 6px |
| `radius-md` | 6px | 8px |
| `radius-lg` | 8px | 12px |
| `radius-xl` | 12px | 24px |
| `radius-full` | 9999px | 9999px |

### Elevation

| Token | Value | Use |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Cards at rest |
| `shadow-sm` | `0 2px 4px rgba(0,0,0,0.06)` | Hover lift |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Dropdowns, popovers |
| `shadow-lg` | `0 12px 24px rgba(0,0,0,0.1)` | Modals, dialogs |

### Motion

| Token | Duration | Use |
|---|---|---|
| `duration-fast` | 100ms | Micro-interactions |
| `duration-normal` | 200ms | Hover states, button feedback |
| `duration-slow` | 300ms | Panel open/close, page transitions |
| `easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard ease |
| `easing-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations |
| `easing-out` | `cubic-bezier(0, 0, 0.2, 1)` | Enter animations |

## 10. Approved Workflows

### Email-to-Transaction Pipeline (Tony's Option C — Locked)

```
Receipt/document email arrives
    → Gmail agent classifies and filters it
    → Workdesk notification appears
    → Accountant clicks "Process"
    → Claude Vision reads the document (receipt, bank statement, invoice)
    → Extracted data writes to Supabase (transactions table)
    → Workdesk shows the transaction in a spreadsheet-like data grid
       (sortable columns, inline editing, bulk actions)
    → Accountant reviews, adjusts category if needed
    → Clicks "Approved" → transaction is reconciled
    → Monthly: one-click generates P&L from database
    → Export to PDF or Google Sheets for client delivery
```

### CRM Lead Pipeline

```
Lead → Contacted → Call Booked → Proposal Sent → Negotiation → Closed Won / Closed Lost
```

- Leads enter via website contact form or Cal.com booking
- On Closed Won: trigger client onboarding workflow
- On Closed Lost: archive with reason

### Client Onboarding (Post-Close)

```
Deal closes in CRM
    → CRM triggers onboarding checklist
    → Collect: business name, type, TIN, address, industry,
       BIR registration type, fiscal year, Gmail address,
       revenue bracket
    → Create client profile in Supabase
    → Set up Google Sheets folder for client deliverables
    → Configure Gmail agent to recognize client email address
    → Set deadline calendar (monthly, quarterly, annual)
    → Assign to accountant's active client list in Workdesk
```

### Bookkeeping I/O

**Inputs processed by AI:**
- Bank statements (PDF/CSV/images)
- Credit card statements
- Sales invoices
- Purchase invoices / vendor bills
- Receipts (digital or scanned)
- Payroll data
- Expense reports

**Outputs generated from Supabase data:**
- Profit & Loss statement
- Balance sheet
- Cash flow statement
- Bank reconciliation report
- Accounts receivable / payable aging
- General ledger
- Trial balance

### Tax Prep

**Outputs (template-based, pre-filled from Supabase):**
- All relevant BIR forms (2551Q, 2550M/Q, 1701, 1701Q, 1702, 1702Q, withholding/remittance forms)
- Tax payment schedules
- Prior-year comparison reports
- Exported as PDF for filing

### Invoicing

```
Accountant creates invoice in Workdesk
    → Invoice generated from template with client data
    → Sent via Gmail
    → Invoice status tracked in CRM (Sent → Viewed → Paid)
    → Actual payment confirmed manually
```

## 11. Recommendation

- **Proceed to specs?** Yes — no caveats. All critical decisions are locked.
- **Suggested spec focus:**
  - **PRD** — Define exact feature requirements for all three surfaces (website, CRM, Workdesk) with state specifications and acceptance criteria.
  - **Tech Spec** — Heavy focus on the AI pipeline (document parsing, email classification, transaction categorization), Supabase schema design (chart of accounts, transactions, clients, deadlines), and the Gmail integration architecture.
  - **API Spec** — Internal API contracts between frontend and Supabase Edge Functions, Gmail webhook handlers, and AI pipeline endpoints.
  - **UI Design** — Screens for all three surfaces. Toolbox data grid UX is critical — must feel as fast and familiar as a spreadsheet. Website is a standard marketing page. Design system tokens are locked and ready.
- **Suggested timeline pressure:** No external deadline mentioned. Quality over speed — get the specs right so Rick can build confidently as a solo developer.
