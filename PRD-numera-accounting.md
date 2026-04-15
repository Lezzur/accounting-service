# Numera Accounting Service — Product Requirements Document

**Author:** Light Yagami (Project Manager)
**Reviewed by:** Lisa Hayes (Coordinator)
**Status:** Reviewed
**Last Updated:** 2026-04-15
**Reviewers:** Rick (Product Owner / Developer), Accountant Partner (TBC)
**Source:** DISCOVERY-accounting-service.md (2026-04-14, Approved, High Confidence)

---

## 1. Overview

Numera is a web-based accounting service platform built for a two-person Philippines-based bookkeeping and tax preparation firm. It consists of three surfaces: a public marketing website that captures leads and drives discovery call bookings; and an internal "Toolbox" application with two modules — a CRM that manages the lead pipeline and client lifecycle, and a Workdesk where client work is performed. The Workdesk's core capability is an AI-assisted document processing pipeline: client documents arrive via Gmail, Claude Vision extracts transaction data, and the accountant reviews and approves extracted transactions in a spreadsheet-like grid before generating financial reports and BIR tax forms. The competitive advantage is throughput — one accountant supported by AI automation handles the client volume of a traditional firm staffed with four to five people.

---

## 2. Target Users

### Primary Persona: The Accountant (Partner)
- **What they care about:** Accuracy and completeness. Every transaction categorized correctly, every BIR deadline met, every client deliverable on time. No surprises.
- **Context:** Sits at a desktop. Handles 5–20 active clients. Receives client documents via email throughout the month. Reviews and approves AI-extracted transactions. Generates monthly, quarterly, and annual financial reports and BIR forms.
- **Trigger:** Opens Toolbox at start of workday. Checks notification panel for new emails awaiting document processing. Works through pending transactions before each deadline.
- **Success looks like:** All transactions for the month categorized and approved by the 15th. Financial reports generated and sent to clients without manual data entry. BIR forms pre-filled and ready to review before each filing deadline.
- **What makes them leave:** AI extraction wrong often enough that reviewing AI output takes longer than entering it manually. Data grid too slow or awkward compared to Excel. System misses documents causing deadlines to slip.

### Secondary Persona: Rick (Developer / System Operator)
- **What they care about:** System reliability, pipeline extensibility, and minimal ops overhead. A system that runs without babysitting.
- **Context:** Builds and maintains the AI workflows. Monitors email ingestion health. Adds new automation capabilities over time. Operates as sole developer.
- **Trigger:** Investigates when accountant reports a problem or monitoring surfaces a pipeline failure. Adds new Workdesk workflows as firm capabilities expand.
- **Success looks like:** Email-to-transaction pipeline runs autonomously. New workflows added without touching existing ones. Zero unhandled failures in the AI pipeline.
- **What makes them leave:** N/A — internal product.

### Secondary Persona: SMB Prospect (Website Visitor)
- **What they care about:** Understanding what they get and how easy it is to start. Evaluating trust.
- **Context:** Browsing on mobile, likely referred by word of mouth. Has a problem (disorganized books, upcoming BIR deadline) and is considering outsourcing.
- **Trigger:** Search result, referral link, or social mention. Lands on homepage.
- **Success looks like:** Sends a contact form inquiry or books a discovery call.
- **What makes them leave:** Slow mobile load. Vague service descriptions. No clear next step. No visible trust signals.

### Anti-Persona: Large Enterprise / Multi-Entity Corporation
- **Who this is:** A company with multiple business units, complex consolidation, audit obligations, or payroll for 50+ employees.
- **Why they're excluded:** Designing for enterprise complexity — multi-entity chart of accounts, audit-grade field-level trails, multi-approver workflows — would bloat the Workdesk and compromise the lean, single-accountant UX that makes Numera effective for its actual users.

---

## 3. Problem Statement

- **The problem:** Small and medium businesses in the Philippines need reliable bookkeeping and BIR tax compliance, but most small firms still run on manual spreadsheets, physical receipts, and fragmented email threads — making it impossible to scale client volume without proportionally hiring more staff.
- **Who experiences it:** The accountant — daily, across every client. SMB owners — monthly when bills and deadlines pile up. Both parties lose time chasing documents and entering data that could be automated.
- **Current workaround:** Clients send receipts via Viber or physical envelope. Accountant manually keys transactions into Excel. BIR forms are manually prepared from spreadsheet totals. Invoices created in Word and emailed. Deadline tracking is a personal calendar.
- **Cost of inaction:** Without automation, the accountant can reliably serve 5–8 clients. Revenue ceiling is hard-capped by manual throughput. Missed BIR deadlines carry financial penalties. Lost receipts produce inaccurate books. One sick day causes cascading deadline failures.
- **Evidence:** Firsthand — Rick is building this for his own active practice. The problem is operational, not hypothetical.

---

## 4. Proposed Solution

- **Product type:** Web application. Two apps within a monorepo: public marketing website (SSR) and internal Toolbox (SPA behavior within Next.js App Router).
- **Architecture shape:** Marketing website is server-side rendered for SEO. Toolbox is client-heavy — the transaction data grid and real-time notification panel require client-side interactivity. AI pipeline runs in serverless edge functions triggered by Gmail webhooks and accountant actions. Data persists in managed PostgreSQL.
- **Core interaction model:**
  - Marketing website: Browse and convert (consume content → submit form or book call).
  - CRM: Pipeline management (advance leads through stages, maintain client records).
  - Workdesk: Task-driven review (receive notification → trigger processing → review in data grid → approve).
- **Key differentiator:** AI handles the mechanical work — document classification, OCR extraction, transaction categorization — so the accountant only performs judgment calls. One accountant operates at the throughput of four to five manual staff.

---

## 5. Feature Inventory

---

### MARKETING WEBSITE

---

#### Feature: Global Navigation Bar

- **Purpose:** Allow visitors to navigate the site and access the primary CTA from any page.
- **Behavior:** Sticky to top of viewport. Transparent background when scroll position = 0; transitions to solid white with `shadow-xs` when scroll > 0px (transition: 200ms ease). Contains: Numera wordmark left, navigation links center/right (Services, How It Works, Contact), "Book a Call" CTA button (teal-600) right. On mobile, nav links collapse to hamburger icon.
- **States:**
  - Default (scroll = 0): Transparent background.
  - Scrolled (scroll > 0): White background, `0 1px 2px rgba(0,0,0,0.05)` shadow.
  - Mobile menu closed: Hamburger icon visible, nav links hidden.
  - Mobile menu open: Full-width dropdown panel, links stacked vertically, × icon replaces hamburger. Body scroll locked (overflow: hidden).
  - Active link: teal-600 color, font-weight 600.
  - CTA button: teal-600 fill, white text, 200ms hover to teal-500.
- **Responsive behavior:**
  - Desktop (≥ 1024px): Full nav visible. Logo left, links and CTA right.
  - Tablet (768px–1023px): Same as desktop.
  - Mobile (< 768px): Logo left, hamburger right. Links hidden until tapped.
- **Edge cases:**
  - Mobile menu open: Tapping outside panel closes it.
  - "Book a Call" in mobile menu: Full-width button, teal-600.
  - Long nav link text: Truncates at 1 line with ellipsis.

---

#### Feature: Hero Section

- **Purpose:** Establish what Numera does and for whom within 5 seconds. Drive visitors to the primary CTA.
- **Behavior:** Full-viewport-height section. Contains: H1 headline (48px/700), subheading (text-xl/400), primary CTA "Book a Discovery Call" (teal-600 button, anchors to Cal.com section), secondary CTA "Send Us a Message" (teal-600 outline, anchors to contact form). Visual illustration or abstract graphic (not stock photos) on desktop right column.
- **States:**
  - Default: Fully rendered on SSR page load. No skeleton needed (server-rendered).
  - Error: N/A — static content.
  - `prefers-reduced-motion`: Any entrance animation (fade-in, slide-up) disabled; content renders immediately.
- **Responsive behavior:**
  - Desktop (≥ 1024px): Two-column — text left, visual right. Max content width 1200px centered.
  - Tablet (768px–1023px): Two-column, narrower visual.
  - Mobile (< 768px): Single column stacked. Text first, visual hidden if decorative. CTAs full-width.
- **Edge cases:** N/A — static content.

---

#### Feature: Services Section

- **Purpose:** Describe what Numera offers in plain language so visitors can evaluate fit.
- **Behavior:** Heading: "What We Handle For You." Grid of 3 service cards at launch: Bookkeeping (Monthly), Tax Compliance / BIR (Quarterly + Annual), Financial Reporting (Monthly/Quarterly/Annual). Additional cards for future services (e.g., Payroll, Advisory) may be added marked "Coming Soon" — maximum 5 total cards. Each card: Lucide icon (24px), service name (text-lg/600), 2-sentence description (text-base/400), frequency tag.
- **States:**
  - Default: Grid of cards with `shadow-xs` at rest.
  - Hover (desktop): `shadow-sm`, 200ms transition.
  - "Coming Soon" card: slate-300 text, amber badge "Coming Soon", no hover lift, cursor: default.
  - Error: N/A — static.
- **Responsive behavior:**
  - Desktop (≥ 1024px): 3-column grid.
  - Tablet (768px–1023px): 2-column grid.
  - Mobile (< 768px): 1-column stack.
- **Edge cases:** N/A — static.

---

#### Feature: How It Works Section

- **Purpose:** Reduce friction by showing prospects the engagement process is simple.
- **Behavior:** Numbered steps (4 steps): 1. Book a call, 2. We onboard your business, 3. We handle books and taxes, 4. You receive monthly reports. Each step: Lucide icon, bold title (text-lg/600), 1-sentence description.
- **States:** Default only — static content.
- **Responsive behavior:**
  - Desktop (≥ 1024px): Horizontal row with connecting line.
  - Mobile (< 768px): Vertical stack with left-side number indicator.
- **Edge cases:** N/A — static.

---

#### Feature: Contact Form

- **Purpose:** Allow prospects to send an inquiry without committing to a call.
- **Behavior:** Section heading "Send Us a Message." Fields: Name (text, required), Email (email, required), Phone (text, optional, max 20 chars), Business Name (text, optional), Message (textarea, required, min 10 chars, max 1000 chars). Submit: "Send Message" (teal-600). On submit: client-side validation → POST to Supabase Edge Function → lead record created in CRM at stage "Lead." Character counter shown at 800/1000 chars; turns red-500 at limit. Honeypot field `website` (hidden): if filled, submission silently discarded server-side.
- **States:**
  - Default: Empty form, all fields unfilled.
  - Focus: Field border transitions from slate-200 to teal-600 (2px), 100ms.
  - Error (field-level): red-500 border, red-700 error message below field (text-sm). `aria-describedby` links error to input.
  - Submitting: Submit button shows 16px teal-600 spinner, label → "Sending…", button disabled. No second submission possible.
  - Success: Form hidden; inline success message in teal-100 background box, teal-700 text, checkmark icon: "Your message was sent. We'll be in touch within one business day."
  - API Error: Form visible; banner above submit: "Something went wrong. Please try again or email us directly at [contact email]." red-50 background, red-700 text.
  - Disabled: Submit button disabled until all required fields pass validation.
- **Responsive behavior:**
  - Desktop: Inputs max-width 640px, centered.
  - Mobile: Full-width inputs, full-width submit button.
- **Edge cases:**
  - Network failure mid-submit: fetch catch → API Error state. No partial save.
  - Rapid resubmit: Button disabled from first click until terminal state reached.
  - Message at 1000 chars: textarea input blocked; counter text red-500.

---

#### Feature: Cal.com Booking Embed

- **Purpose:** Allow prospects to self-schedule a discovery call without email back-and-forth.
- **Behavior:** Section heading "Book a Discovery Call." Cal.com scheduling widget embedded inline (JavaScript embed for seamless appearance). Shows available slots in GMT+8 (Philippine Standard Time). Cal.com handles its own booking confirmation email.
- **States:**
  - Default: Cal.com widget loaded and showing available slots.
  - Loading: Skeleton placeholder (slate-100 fill, radius-lg, ~600px × 500px desktop) shown during widget init (~1–2s).
  - Success: Cal.com handles confirmation state within widget.
  - Error (Cal.com unavailable or script blocked): Widget area shows: "Booking is temporarily unavailable. Please use the contact form above to reach us." slate-700 text on slate-50 background. No broken iframe visible.
- **Responsive behavior:**
  - Desktop: Inline at max-width 700px, centered.
  - Mobile (< 768px): Full-width. Cal.com widget handles internal responsiveness.
- **Edge cases:**
  - No available slots: Cal.com shows future week navigation.
  - Timezone: Cal.com handles auto-detection.

---

#### Feature: Footer

- **Purpose:** Secondary navigation, contact info, and legal links.
- **Behavior:** Full-width, slate-900 background, white text. Contains: Numera wordmark, one-line tagline, nav links (Services, How It Works, Contact), contact email, "© 2026 Numera. All rights reserved.", Privacy Policy link.
- **States:**
  - Default: Static.
  - Link hover: Underline + teal-400, 200ms.
- **Responsive behavior:**
  - Desktop: 2–3 columns (brand / links / contact).
  - Mobile: Single column, stacked.
- **Edge cases:** N/A.

---

### CRM MODULE (TOOLBOX)

---

#### Feature: Toolbox Shell — Sidebar Navigation

- **Purpose:** Persistent navigation between CRM and Workdesk modules.
- **Behavior:** Fixed left sidebar. Width: 240px (expanded) / 64px (collapsed). Toggle button at sidebar bottom. At 240px: icon + label. At 64px: icon only + tooltip on hover. Module switcher at top: CRM tab, Workdesk tab. Below module switcher: module-specific nav items. User avatar/initials and sign-out at bottom. Collapsed state persists in localStorage. **Default state by module:** CRM defaults to 240px expanded (pipeline and client management benefit from labels). Workdesk defaults to 64px collapsed (maximizes grid/report area). User override persists per module in localStorage.
- **States:**
  - Default (expanded): 240px, all labels visible.
  - Collapsed: 64px, icons only. Label tooltip on hover (200ms delay).
  - Active nav item: teal-100 background, teal-600 text and icon, 2px teal-600 left border.
  - Hover (non-active): slate-100 background, 200ms.
  - Loading (navigating): Active state applied immediately; page content area shows skeleton.
- **Responsive behavior:**
  - Desktop (≥ 1280px): Always visible, default expanded (240px).
  - Tablet (768px–1279px): Visible, default collapsed (64px).
  - Mobile (< 768px): Sidebar hidden; replaced by bottom tab bar with icons for CRM, Workdesk, and Settings.
- **Edge cases:**
  - Clicking active module tab: Navigates to that module's default view (no infinite redirect).
  - Bottom nav (mobile): 44px minimum touch target per icon.

---

#### Feature: Lead Pipeline — Kanban Board

- **Purpose:** Visual overview of all leads and their stage in the sales process.
- **Behavior:** Kanban with 7 columns: Lead, Contacted, Call Booked, Proposal Sent, Negotiation, Closed Won, Closed Lost. Each column: name, lead count badge, vertical scroll when > viewport. Leads as draggable cards. Stage change via drag-and-drop or via Lead Detail dropdown. "Add Lead" button at top of Lead column (teal-600 outline). Closed Won and Closed Lost columns collapsed/dimmed by default; "Show closed" toggle reveals them.
- **States:**
  - Default: Board with leads in their current stages.
  - Loading: Each column shows 2–3 skeleton cards (slate-100 shimmer, 200ms loop).
  - Empty (single column): "No leads" in slate-500, text-sm, centered.
  - Empty (full board): "No leads yet. Add your first lead to get started." + Add Lead button.
  - Dragging: Card elevation to `shadow-md`, 2deg rotation, source slot shows dashed slate-300 border.
  - Error (load failed): Error banner: "Failed to load leads. Refresh to try again." with Retry button.
  - Error (move failed): Toast: "Failed to update lead stage. Please try again." Card snaps back to origin position.
- **Responsive behavior:**
  - Desktop (≥ 1280px): Full board, horizontal scroll if needed.
  - Tablet (768px–1279px): Horizontal scroll, column min-width 200px.
  - Mobile (< 768px): List view grouped by stage (accordion). Drag-and-drop disabled; stage change via select dropdown on lead row.
- **Edge cases:**
  - > 50 leads per column: Column scrolls vertically; column header stays fixed.
  - Long business name: Truncates to 1 line, ellipsis.
  - Moving to Closed Lost: Prompt dialog "Why was this lead lost?" (required text field, max 500 chars, dropdown suggestions: "Budget", "Timing", "Went with competitor", "No response", "Other"). Reason stored in `close_reason` field. Drop cancelled if dialog dismissed.
  - Moving backwards in pipeline (e.g., Closed Won → Lead): Not allowed. Drop on invalid target returns card to origin.

---

#### Feature: Lead Card

- **Purpose:** Represent a single lead with enough info for quick scanning.
- **Behavior:** Min-width 200px, auto height. Contents: business/lead name (text-sm/600), contact name (text-xs/slate-500), stage badge (color-coded), date added (text-xs/slate-400), calendar icon if stage = Call Booked (teal-600). Click opens Lead Detail drawer.
- **States:**
  - Default: `shadow-xs` at rest.
  - Hover: `shadow-sm`, 200ms.
  - Dragging: `shadow-md`, 2deg rotation, 100ms.
  - Active (detail open): 2px teal-600 left border.
- **Responsive behavior:** Inherits from Kanban Board.
- **Edge cases:**
  - Business name > 40 chars: Truncate with ellipsis.
  - Contact name absent: Field hidden.

---

#### Feature: Lead Detail View / Drawer

- **Purpose:** View and edit all lead information; advance it through the pipeline.
- **Behavior:** Right-side drawer (480px desktop). Fields: Business Name, Contact Name, Contact Email, Phone (optional), Lead Source (select: Website Form, Cal.com Booking, Referral, Manual), Pipeline Stage (select, all 7), Notes (markdown-light: bold, italic, bullets), Created At (read-only), Updated At (read-only). Activity log at bottom (timestamped stage changes and edits, newest first). Actions: Save, Delete Lead (destructive, confirmation modal), Convert to Client (only when stage = Closed Won).
- **States:**
  - Default: Populated, no unsaved changes.
  - Editing: Fields editable, "Unsaved changes" indicator, Save enabled.
  - Saving: Save button spinner, disabled.
  - Save success: Toast "Lead saved." Drawer remains open.
  - Save error: Toast "Failed to save. Please try again." Data preserved.
  - Delete confirm modal: "Delete this lead? This cannot be undone." Cancel + Delete (red-500) buttons.
  - Delete success: Drawer closes, lead removed from board. Toast: "Lead deleted."
  - Delete error: Toast "Failed to delete. Please try again."
  - Convert to Client: Confirmation modal → triggers onboarding → navigates to new Client Profile.
  - Empty notes: Placeholder "Add notes…" in slate-400.
  - Empty activity log: "No activity yet." slate-500.
  - Loading: Skeleton matching form layout.
  - Error (load failed): "Failed to load lead." with retry.
- **Responsive behavior:**
  - Desktop (≥ 1024px): 480px right-side drawer, overlays board.
  - Mobile (< 1024px): Full-screen bottom sheet.
- **Edge cases:**
  - Navigate away with unsaved changes: Browser confirm "Leave page? Unsaved changes will be lost."
  - Notes > 10,000 chars: Warning at 9,000. Blocked at 10,000.
  - Activity log > 50 entries: "Load more" button (loads 20 at a time).

---

#### Feature: Client List

- **Purpose:** Show all active clients and provide access to their profiles.
- **Behavior:** Table view. Columns: Business Name, Business Type, BIR Registration (VAT/Non-VAT), Next Deadline (nearest upcoming date), Status (Active/Inactive). Sortable by all columns. Search/filter bar: search by name, filter by business type, filter by BIR registration. Click row → Client Profile.
- **States:**
  - Default: Sorted by Business Name ascending.
  - Loading: 5 skeleton rows.
  - Empty: "No clients yet. Close a lead to add your first client." with illustration.
  - Search results: Matched rows shown; match text highlighted in teal-100.
  - Search no results: "No clients match your search." slate-500.
  - Error: "Failed to load clients. Refresh to try again." with Retry.
  - Sort asc/desc: ↑/↓ icon on active column header.
- **Responsive behavior:**
  - Desktop (≥ 1280px): Full table.
  - Tablet (768px–1279px): Horizontal scroll.
  - Mobile (< 768px): Card list with name, business type, next deadline.
- **Edge cases:**
  - 0 clients: Empty state.
  - > 200 clients: Pagination, 50 per page.
  - Long business name: Truncate 2 lines; full name on hover tooltip.

---

#### Feature: Client Profile

- **Purpose:** Store all onboarding and operational data for an active client.
- **Behavior:** Full-page view with sections: (1) Identity — Business Name, Business Type (Sole Prop / OPC / Corporation), TIN, Registered Address, Industry (predefined list: Retail, Food & Beverage, Professional Services, Construction, Transportation, Manufacturing, Real Estate, Healthcare, Education, Technology, Agriculture, Other), BIR Registration Type (VAT / Non-VAT), Fiscal Year Start Month; (2) Operational — Gmail Address for document intake, Monthly Revenue Bracket (select tiers), Assigned Google Sheet Folder URL; (3) Billing — current retainer plan, billing history summary; (4) Workdesk Link — "Open in Workdesk" button. View mode by default; "Edit Profile" button switches to edit mode.
- **States:**
  - Default: View mode (read-only).
  - Editing: Fields editable, Save / Cancel visible.
  - Saving: Save button spinner.
  - Save success: Toast "Client profile saved." Returns to view mode.
  - Save error: Toast "Failed to save. Please try again." Stays in edit.
  - Loading: Skeleton matching profile layout.
  - Error (load failed): "Failed to load client profile." with Retry.
  - Inactive client: Slate-100 banner at top: "This client is inactive."
  - Missing required field on save: Red border + error message per field.
- **Responsive behavior:**
  - Desktop: 2-column layout where space allows.
  - Tablet/Mobile: Single column.
- **Edge cases:**
  - TIN format: Validated on blur as `###-###-###` or `###-###-###-###`. Error if invalid.
  - Gmail address duplicate: Error on save: "This Gmail address is already registered to another client."
  - Changing Gmail address: Warning modal: "Changing the Gmail address will reconfigure the document intake filter for this client. Confirm?"

---

#### Feature: Task Tracker (CRM)

- **Purpose:** Track accountant to-dos attached to specific leads or clients.
- **Behavior:** Accessible from CRM sidebar and from individual Client/Lead profiles. Each task: Title, Due Date (date picker), Linked Entity (Lead or Client), Priority (Low / Medium / High), Status (To Do / In Progress / Done). Create, edit, complete, delete. Filter by status, due date range, linked entity. Default sort: due date ascending.
- **States:**
  - Default: Open tasks sorted by due date.
  - Loading: 5 skeleton rows.
  - Empty: "No tasks. You're all caught up." with checkmark illustration.
  - Overdue task: red-500 dot indicator, due date in red-500, row background red-50.
  - Due today: amber-500 dot, due date in amber-600.
  - Completed: Text strikethrough, slate-400, moved to bottom or hidden (toggle "Show completed").
  - Save new task success: Task in list. Toast: "Task created."
  - Save error: Toast: "Failed to save task. Please try again."
  - Delete: Inline confirm "Delete this task?" Yes/No — no modal.
- **Responsive behavior:**
  - Desktop: Full table.
  - Mobile: Card list per task.
- **Edge cases:**
  - 0 open tasks: Empty state.
  - > 100 tasks: Pagination (50 per page).
  - Past due date on new task: Warning shown, allowed (backdating).

---

#### Feature: Billing & Invoicing Module (CRM)

- **Purpose:** Generate and track client invoices; send via Gmail.
- **Behavior:** Accessible from CRM sidebar and Client Profile. Invoice list: Invoice #, Client, Amount, Issue Date, Due Date, Status badge. Create Invoice: select client → add line items (description, qty, unit price; auto-calculated line total and grand total) → set due date → preview → Send or Save Draft. VAT line (12%) shown automatically for VAT-registered clients. Invoice #: system-assigned, format `INV-YYYY-####`. Send: Gmail API attaches invoice PDF to email. "Mark as Paid": manual confirmation button on Sent invoices.
- **Invoice Statuses:** Draft (editable), Sent (read-only), Paid (read-only), Overdue (derived: Sent + dueDate < today, red badge).
- **States:**
  - List loading: 5 skeleton rows.
  - List empty: "No invoices yet. Create your first invoice."
  - List error: "Failed to load invoices." with Retry.
  - 0 line items on submit: Blocked. Error: "Add at least one line item."
  - Sending: Send button spinner, disabled.
  - Send success: Status → Sent. Toast: "Invoice sent to [client email]."
  - Send error: Toast: "Failed to send invoice. Check Gmail connection and try again."
  - Mark as Paid confirm: Dialog "Mark Invoice #[n] as paid?" Confirm button.
  - Mark as Paid success: Badge → green "Paid". Toast: "Invoice marked as paid."
  - Gmail disconnected on send: Error: "Gmail connection is not active. Reconnect Gmail in Settings before sending."
- **Responsive behavior:**
  - Desktop: Table + create form in side panel.
  - Mobile: Card list + create form as full-screen modal.
- **Edge cases:**
  - Amount = 0: Warning shown, allowed.
  - "Viewed" status: Not supported. Discovery Section 10 specifies Sent → Viewed → Paid, but Gmail API does not provide read receipt data and implementing a tracking pixel raises privacy concerns disproportionate to the value. **Deliberate deviation from Discovery:** Invoice statuses are Draft, Sent, Paid, Overdue only. Discovery Section 10 should be amended to reflect this decision.

---

### WORKDESK MODULE

---

#### Feature: Email Notification Panel

- **Purpose:** Alert the accountant to new client documents received via Gmail so they can trigger processing.
- **Behavior:** Left rail panel in Workdesk. Shows unprocessed email notifications classified by the Gmail agent as containing client documents. Each item: sender name, email subject (truncated at 60 chars, full on tooltip), date received, matched client name (or "Unknown sender"), AI-guessed document type, "Process" button. Grouped by client when multiple emails from same client. Badge count on Workdesk nav item updates in real-time (Supabase real-time subscription).
- **States:**
  - Default: Unprocessed notifications, most recent first.
  - Loading: 3 skeleton notification items.
  - Empty: "No new documents. You're up to date." with envelope illustration.
  - Gmail agent unavailable: Banner: "Email sync is unavailable. Contact your system administrator."
  - Processing (after "Process" click): Button → spinner, disabled. Label: "Processing…"
  - Processed: Item removed from panel (or moved to "Processed" section with checkmark). Toast: "Document processed and added to transactions."
  - Processing error: Toast: "Failed to process document. View details." Link opens error detail modal with raw email and AI error for Rick's inspection.
  - Unknown sender: "Unknown sender" label in slate-500 + warning icon. Accountant can still process; prompted to assign to client post-processing.
  - Already processing (duplicate click guard): "Process" button disabled after first click; server-side idempotency check on Gmail message ID.
- **Responsive behavior:**
  - Desktop (≥ 1280px): 280px left rail, always visible.
  - Tablet (768px–1279px): Collapsible panel with toggle button.
  - Mobile (< 768px): Bottom sheet opened via notification count button in bottom nav.
- **Edge cases:**
  - 0 unprocessed: Empty state.
  - > 50 unprocessed: "Load more" button (20 at a time).
  - Same email processed twice: Blocked server-side via Gmail message ID uniqueness constraint.

---

#### Feature: Transaction Data Grid

- **Purpose:** Spreadsheet-like interface for reviewing, editing, and approving AI-extracted transaction data.
- **Behavior:** Full-width virtualized data grid (TanStack Table v8 with virtual rows). Columns: Date (sortable, date picker on edit), Description (editable inline, max 255 chars), Amount (right-aligned, ₱ formatted with comma separators and 2 decimal places, numeric input on edit), Type (Credit/Debit — select, green/red indicator), Category (select from chart of accounts, grouped by account type), Client (read-only), Source Document (link icon → opens Document Preview Panel), Status (badge), Approved By (read-only). Row actions: Approve (✓), Reject (×), Edit. Bulk actions: checkbox select all, Approve Selected, Reject Selected. Filters: date range, category, status, client. Search: description text.
- **Status badge colors:** Pending = amber-100/amber-700 text. In Review = slate-100/slate-700. Approved = teal-100/teal-700. Rejected = red-100/red-700.
- **States:**
  - Default: Current client, current period transactions.
  - Loading: 8 skeleton rows, all columns.
  - Empty (no transactions): "No transactions for this period." + link: "Process documents from the inbox."
  - Row editing: Fields become inputs; other rows remain readable.
  - Saving edit: Row loading indicator.
  - Edit saved: Toast: "Transaction updated."
  - Edit error: Toast: "Failed to save. Please try again." Row reverts.
  - Approving (single row): Optimistic — badge → Approved immediately (100ms checkmark animation). Undo toast: "Transaction approved. Undo?" 5-second window.
  - Approval error: Toast: "Failed to approve transaction." Status reverts.
  - Rejecting: Rejection reason dialog (optional text field). On confirm, status → Rejected.
  - Bulk approve in progress: "Approving 12 of 15…" progress indicator.
  - Bulk approve complete: Toast: "15 transactions approved."
  - Bulk approve partial failure: "12 approved, 3 failed. See highlighted rows." Failed rows in red-50.
  - Filter active: Filter chips above grid, × to clear each.
  - Search no results: "No transactions match your search."
  - Error (load failed): "Failed to load transactions." with Retry.
  - Category unassigned (AI confidence < 0.85): Category cell shows amber "?" indicator. Clicking it invokes `suggest-category` Edge Function to request an AI re-suggestion with context from recent corrections. Suggestion shown as a highlighted option in the dropdown. Accountant can accept or choose manually.
  - Category changed after approval: Status reverts to In Review. Banner on row: "Edited after approval — requires re-approval."
- **Responsive behavior:**
  - Desktop (≥ 1280px): Full grid, all columns.
  - Tablet (768px–1279px): Horizontal scroll, all columns preserved.
  - Mobile (< 768px): Simplified card view (Date, Description, Amount, Status). Full grid via "Desktop view" toggle.
- **Edge cases:**
  - 0 transactions for active filter: Empty state.
  - > 1,000 rows: TanStack Table virtual rows (only visible rows rendered). Row count shown in header.
  - Amount with more than 2 decimal places: Displayed rounded to 2dp; stored at full precision in DB.
  - Long description (> 100 chars): Truncated to 1 line in grid (ellipsis); full text on hover tooltip and in edit mode.
  - All numeric amounts use Inter tabular-nums (`font-variant-numeric: tabular-nums`) for column alignment.

---

#### Feature: Document Preview Panel

- **Purpose:** Display the original source document alongside extracted transaction data for visual verification.
- **Behavior:** Right-side panel (400px) triggered by clicking source document icon in the transaction grid. Shows: email metadata (sender, subject, date received), inline preview of attachment (PDF via browser native renderer; image displayed directly). Panel slides in from right (300ms easing-out).
- **States:**
  - Closed: Panel not rendered; grid uses full width.
  - Opening: Slides in from right, 300ms cubic-bezier(0,0,0.2,1).
  - Loading (document): Skeleton rectangle fills preview area.
  - Loaded (PDF): Rendered inline.
  - Loaded (image): Scaled to panel width.
  - PDF multi-page: First page default. Previous / Next page navigation shown.
  - Error (document not found): "Document preview unavailable. The original file may no longer be accessible." slate-500.
  - Unsupported file type: "Preview not available for this file type." + Download link.
  - Closing: Slides out, 300ms cubic-bezier(0.4,0,1,1).
- **Responsive behavior:**
  - Desktop (≥ 1440px): Grid and panel side by side.
  - Desktop (1280px–1439px): Panel pushes grid to 50% width.
  - Tablet/Mobile: Panel opens as full-screen overlay.
- **Edge cases:**
  - PDF > 20 pages: Paginated navigation, first page default.

---

#### Feature: Financial Report Generator

- **Purpose:** Generate standard financial reports from approved transaction data with one action.
- **Behavior:** Reports section in Workdesk. Report types: Profit & Loss, Balance Sheet, Cash Flow, Bank Reconciliation, AR Ageing, AP Ageing, General Ledger, Trial Balance. User selects: Report type, Client, Period (preset: This Month, Last Month, This Quarter, Last Quarter, This Year, or Custom date range). "Generate" triggers SQL queries against approved transactions in Supabase. Report rendered inline with formatted tables. AI-generated narrative section (P&L and Balance Sheet only) labeled "AI Summary — Review before sending to client." Accountant must approve narrative (or edit it) before export is enabled. Export: PDF (browser download) or Google Sheets (new sheet in client's folder).
- **States:**
  - Default: Report selection form + list of previously generated reports (date, type, export links).
  - Generating (< 5s): Spinner: "Generating report…"
  - Generating (> 3s): Additional message: "This may take a moment."
  - Generated: Report rendered inline. Export buttons enabled.
  - AI narrative pending approval: "Approve Narrative" button shown; export disabled until clicked (or narrative edited and saved).
  - Error (insufficient data): "Not enough approved transactions to generate this report. Approve pending transactions first."
  - Error (empty period): "No transactions found for this period."
  - Error (generation failed): "Report generation failed. Please try again."
  - Export PDF: Browser download: `[ReportType]-[ClientName]-[Period].pdf`.
  - Export Sheets: New tab opens. Toast: "Report exported to Google Sheets."
  - Export error: Toast: "Export failed. Please try again."
  - No Google Sheet folder configured: Toast: "No Google Sheets folder configured for this client. Add it in the client profile."
  - Previous reports list empty: "No reports generated yet for this client."
- **Responsive behavior:**
  - Desktop: Full-width report with print-preview styling.
  - Tablet: Same, horizontal scroll for wide tables.
  - Mobile: Read-only view with export buttons.
- **Edge cases:**
  - Zero approved transactions: Error state.
  - Trial balance imbalance: Warning banner on report: "Trial balance is out of balance by ₱[X]. Review uncategorized transactions." Export not blocked.
  - Fiscal year boundary within period: Report handles revenue/expense reset correctly.
  - Concurrent report generation by same user: Each job independent; both proceed.

---

#### Feature: BIR Tax Form Preparation

- **Purpose:** Pre-fill BIR tax forms from approved transaction data to reduce manual entry and filing errors.
- **Behavior:** Tax Prep section in Workdesk. Forms supported: 2551Q, 2550M, 2550Q, 1701, 1701Q, 1702, 1702Q, 1601-C, 1601-EQ, 0619-E, 0619-F. User selects: Form type, Client, Filing Period. System validates applicability (e.g., VAT forms only for VAT-registered clients; 1702 only for Corporations). "Pre-fill from Data" populates fields from Supabase. Editable fields shown with teal-600 border; read-only fields with slate-100 background. Manually overridden fields shown with amber-100 background. Prior-year comparison in 320px right sidebar (when data available). Export as PDF.
- **States:**
  - Default: Form type selector, client selector, period selector.
  - Pre-filling: Spinner over form: "Loading data from your records…"
  - Pre-filled: Fields populated. Accountant reviews.
  - Manually edited field: amber-100 background on field.
  - Validation error (export attempt): Required fields highlighted red-500. Error summary above form.
  - Export PDF: Browser download: `[FormNumber]-[ClientTIN]-[Period].pdf`.
  - Exporting: Button spinner, disabled.
  - Export error: Toast: "Export failed. Please try again."
  - Prior-year data unavailable: "No prior-year data available." in sidebar.
  - Form not applicable to client type: "This form does not apply to this client's BIR registration type." Correct form suggested.
  - Missing client TIN: Pre-fill blocked. Error: "Client TIN is required. Update client profile before preparing tax forms."
  - Missing data for a field: Amber "?" indicator on field. Warning, not block.
  - Form template potentially outdated: Banner: "This form template may be outdated. Verify against the current BIR version." (Rick can update templates via admin.)
- **Responsive behavior:**
  - Desktop: Full form inline, prior-year sidebar 320px right.
  - Tablet: Full form, prior-year sidebar collapses.
  - Mobile: Read-only, export available. (BIR filing is a desktop task in practice.)
- **Edge cases:**
  - Quarterly period spanning two months: System aggregates correct month range.
  - BIR form number changes (BIR revision): Template system stores field mappings as data; Rick updates without redeployment.

---

#### Feature: Deadline Tracker

- **Purpose:** Prevent missed BIR filing and deliverable deadlines by surfacing them proactively.
- **Behavior:** Calendar view (monthly) and list view (chronological). Deadline types auto-generated on client onboarding: Monthly Bookkeeping (transaction categorization complete by 15th of following month), Monthly VAT — 2550M (for VAT clients, 20th of following month), Quarterly BIR Filings (per BIR schedule), Quarterly Financial Statements, Annual ITR + Financials (April 15). Each deadline: client name, type, due date, status indicator. "Mark as Completed" per deadline item. Auto-generation covers 12 months ahead; annual refresh via scheduled Edge Function on January 1.
- **Proactive reminders:** Deadlines approaching within 7 days trigger an in-app notification banner at the top of Workdesk: "[N] deadlines due this week" (amber-100 background, amber-700 text, dismissible per session). Additionally, the system uses the `draft-email` Edge Function with `templateType: 'deadline_reminder'` to auto-generate a follow-up email draft for the client when a deadline is ≤ 3 days away and the associated deliverable (e.g., bank statement) has not been received. The draft appears in the accountant's follow-up queue — not sent automatically.
- **Status colors:** Upcoming = slate-500 dot. In Progress = amber-500 dot. Completed = green-500 dot. Overdue = red-500 dot, red-50 row background.
- **States:**
  - Default: List view, all clients, sorted by nearest due date.
  - Loading: 5 skeleton rows.
  - Empty: "No deadlines scheduled. Onboard a client to generate their deadline calendar."
  - Overdue: red-50 row, red-500 dot.
  - Approaching (< 7 days): amber-500 dot.
  - Filter active: Filter chips above list.
  - Mark complete (optimistic): Status → Completed immediately. Undo toast: 5-second window.
  - Mark complete error: Toast: "Failed to update status." Reverts.
  - Calendar view: Colored dots on dates with deadlines. Click date → popover listing that day's deadlines.
  - Error: "Failed to load deadlines." with Retry.
- **Responsive behavior:**
  - Desktop: List and calendar side by side.
  - Tablet/Mobile: List only; calendar via tab toggle.
- **Edge cases:**
  - 0 deadlines: Empty state.
  - BIR deadline on weekend/holiday: Flag: "Note: This deadline falls on a weekend. Verify the official extended deadline with BIR."
  - Inactive client's deadlines: Shown greyed with "Inactive client" note.
  - Duplicate prevention: Idempotent generation — no duplicate entries per client per period type.

---

#### Feature: Invoice Sending from Workdesk

- **Purpose:** Allow the accountant to send billing invoices without switching to the CRM module.
- **Behavior:** "Send Invoice" quick action within Workdesk client view. Modal: client pre-filled, select from existing Draft invoices or create new inline. On send: PDF generated, sent via Gmail API, invoice status → Sent in CRM.
- **States:**
  - Modal closed: No UI.
  - Modal open: Invoice selection list. "Create New" option at top.
  - Invoice list loading: Skeleton items.
  - Invoice list empty: "No draft invoices for this client. Create one first."
  - Invoice selected: Preview thumbnail. Send button enabled.
  - Sending: Spinner on Send button.
  - Send success: Modal closes. Toast: "Invoice sent."
  - Send error: Toast: "Failed to send. Check Gmail connection."
  - Gmail disconnected: Error with reconnect instruction link.
- **Responsive:** Same as CRM invoicing.
- **Edge cases:** Gmail disconnected → blocked with error.

---

#### Feature: Google Sheets & PDF Export

- **Purpose:** Deliver client-ready reports and data in the formats clients expect.
- **Behavior:** Export controls available on: Transaction data grid (filtered view → Google Sheets), Financial Reports (PDF and Google Sheets), BIR Tax Forms (PDF only), Invoices (PDF). Google Sheets export: creates new sheet in client's assigned Google Sheets folder (or default folder if not configured). PDF export: server-side rendered via Supabase Edge Function with print-optimized HTML template.
- **States:**
  - Default: Export buttons/dropdown visible.
  - Exporting (PDF): Spinner on button, disabled.
  - Exported (PDF): Browser download dialog.
  - Exporting (Sheets): Spinner, disabled.
  - Exported (Sheets): New tab opens. Toast: "Exported to Google Sheets."
  - Error (Sheets API): Toast: "Google Sheets export failed. Check connection and try again."
  - Error (PDF): Toast: "PDF export failed. Please try again."
  - No Sheets folder configured: Toast: "No Google Sheets folder configured for this client. Add it in the client profile."
- **Edge cases:**
  - Filename conflict (sheet already exists): Timestamp appended: `ReportName-YYYY-MM-DD-HHmmss`.
  - Large export > 5,000 rows: Progress bar: "Exporting [n] of [total] rows…" Processing via Edge Function.

---

#### Feature: Follow-up Email Drafting (AI-Assisted)

- **Purpose:** Help the accountant draft professional client communications.
- **Behavior:** "Draft Email" button in Client Profile and Workdesk client view. Accountant selects template type: Document Request, Deadline Reminder, Report Delivery, Custom (free text intent). Claude API generates draft. Draft shown in text editor (full edit). Accountant reviews, edits, and sends via Gmail API — or copies to clipboard. Sends logged in client's activity log.
- **States:**
  - Default: Template selector + optional intent field.
  - Generating: Spinner in draft area: "Generating email draft…"
  - Generated: Draft in editable text editor. Edit, Send, Copy buttons.
  - Editing: Text editor active.
  - Sending: Spinner on Send, disabled.
  - Send success: Toast: "Email sent." Activity log updated.
  - Send error: Toast: "Failed to send email. Please try again."
  - Error (AI generation failed): Toast: "Draft generation failed. Write your email manually." Text editor shown blank (manual mode fallback).
  - Gmail disconnected: Send blocked; error message with reconnect instruction.
- **Responsive:** Desktop + tablet. Mobile: textarea instead of rich editor.
- **Edge cases:**
  - Draft > 2,000 chars: Allowed. Accountant's responsibility to trim.

---

## 6. User Flows

### Flow: Prospect Books a Discovery Call

- **Entry point:** Arrives at homepage via search, referral, or social link.
- **Steps:**
  1. Lands on hero. Sees headline and two CTAs.
  2. Scrolls through Services and How It Works.
  3. Clicks "Book a Discovery Call" (hero CTA or nav).
  4. Page smooth-scrolls to Cal.com booking section. Widget skeleton shown (~1–2s init).
  5. Prospect selects available date and time (GMT+8 displayed).
  6. Fills in name and email in Cal.com booking form.
  7. Cal.com confirms booking within widget.
  8. Prospect receives Cal.com confirmation email. Rick/accountant receives calendar notification.
- **Decision points:**
  - Step 4, Cal.com unavailable: Error state shown; prospect directed to contact form above.
  - Step 5, no slots available: Cal.com shows navigation to future weeks.
- **Terminal states:**
  - Success: Booking confirmed.
  - Error: Diverted to contact form.
  - Abandonment: No server state to clean up.

---

### Flow: Prospect Sends Contact Form Inquiry

- **Entry point:** "Send Us a Message" CTA or "Contact" nav link.
- **Steps:**
  1. Prospect views contact form section.
  2. Fills in Name (required), Email (required), Phone (optional), Business Name (optional), Message (required).
  3. Clicks "Send Message."
  4. Client-side validation runs. Errors shown inline if fields fail.
  5. Validation passes: button → "Sending…" + spinner.
  6. POST to Supabase Edge Function. Lead created in CRM at stage "Lead."
  7. Success: Form hidden, success message shown.
- **Decision points:**
  - Step 4 fails: Fields highlighted, submit blocked until corrected.
  - Step 6 API error: Error banner shown; form remains; fallback contact email shown.
- **Terminal states:**
  - Success: Lead in CRM. Prospect sees success message.
  - API Error: Prospect shown error with direct contact alternative.
  - Abandonment: No state to clean up.

---

### Flow: Lead Converted to Client

- **Entry point:** Lead Detail drawer, stage = Closed Won. "Convert to Client" button.
- **Steps:**
  1. Accountant opens lead with stage Closed Won.
  2. Clicks "Convert to Client." Confirmation modal.
  3. Confirms. System creates Client record from lead data (business name, contact email pre-filled).
  4. Client Profile opens in edit mode. Missing required fields highlighted.
  5. Accountant fills TIN, Business Type, BIR Registration Type, Fiscal Year Start, Gmail Address, Google Sheet Folder URL (for client deliverables).
  6. Saves.
  7. System configures Gmail agent to recognize client's Gmail address.
  8. System generates 12 months of deadline entries based on BIR registration type and fiscal year.
  9. Client appears in Client List. "Open in Workdesk" button navigates to client's Workdesk view.
- **Decision points:**
  - Step 6: TIN and BIR Registration Type are hard-required (save blocked without them). Gmail Address and Revenue Bracket are soft-required (warning shown, save allowed).
- **Terminal states:**
  - Success: Client created, deadlines generated, Gmail agent configured.
  - Error (save failed): Toast. Lead not converted. Retry available.
  - Abandonment: Cancel at confirmation modal — no action taken.

---

### Flow: Document Processed (Email-to-Transaction Pipeline)

- **Entry point:** Accountant opens Workdesk. Notification panel shows unprocessed email.
- **Steps:**
  1. Notification card: "[Client Name] — Bank statement — 3 days ago." "Process" button visible.
  2. Accountant clicks "Process." Button → spinner.
  3. Edge Function downloads attachment from Gmail. Sends to Claude Vision API.
  4. Claude Vision extracts: date, description, amount, type, vendor. Returns structured JSON.
  5. Extracted data written to `transactions` table (status: Pending). If category confidence ≥ 0.85: auto-assigned. If < 0.85: category left blank with "?" indicator.
  6. Notification removed from panel. Transaction grid row appears (status: Pending).
  7. Toast: "Document processed. 1 new transaction added."
  8. Accountant opens transaction grid. Sees new row. Clicks source document icon to view original in preview panel.
  9. If data correct: clicks ✓ Approve. Status → Approved. Undo toast (5s).
  10. If data incorrect: clicks cell to edit. Corrects. Saves. Clicks Approve.
- **Decision points:**
  - Step 3, Claude Vision unavailable: Falls back to Google Cloud Vision.
  - Step 3, both Vision APIs unavailable: Blank transaction created, status = Manual Entry Required. Toast: "Document could not be processed automatically. Enter transaction manually."
  - Step 5, category confidence < 0.85: Category field blank + "?" indicator. Accountant must select category before approving.
  - Step 8, extraction entirely wrong: Accountant rejects row. Row archived as Rejected; can be re-entered manually.
- **Terminal states:**
  - Success: Transaction Approved in Supabase. Available for reporting.
  - Manual required: Blank transaction in grid; accountant enters manually.
  - Rejected: Row archived. No data lost.
  - Abandonment: Transaction remains Pending in grid indefinitely. No data lost.

---

### Flow: Generate and Export Financial Report

- **Entry point:** Workdesk → Reports. Client selected.
- **Steps:**
  1. Accountant selects: Report type (e.g., Profit & Loss), Client, Period (e.g., Last Month).
  2. Clicks "Generate."
  3. Spinner: "Generating report…" SQL queries run against approved transactions.
  4. Report rendered inline: formatted tables + AI narrative section (labeled "AI Summary — Review before sending").
  5. Accountant reviews figures.
  6. Clicks "Approve Narrative" (or edits narrative via text editor then saves). Export buttons enabled.
  7. Clicks "Export as PDF." Browser downloads `P&L-[Client]-[Period].pdf`.
- **Decision points:**
  - Step 3, insufficient approved transactions: Error state. No report generated.
  - Step 7, export to Google Sheets instead: New sheet created in client folder; new tab opens.
  - Step 7, export fails: Toast error. Retry. Report still visible in browser.
- **Terminal states:**
  - Success: PDF downloaded or Google Sheet created.
  - Error: Toast + retry.
  - Abandonment: No action needed. Generated report is not persisted to Supabase unless exported.

---

### Flow: Prepare and Export BIR Tax Form

- **Entry point:** Workdesk → Tax Prep. Client selected.
- **Steps:**
  1. Accountant selects: Client, Form (e.g., 2550Q), Period (e.g., Q1 2026).
  2. System checks applicability. Client is VAT-registered → 2550Q is valid. Proceeds.
  3. Clicks "Pre-fill from Data." Spinner shown.
  4. Supabase transaction data mapped to BIR form fields. Form rendered.
  5. Accountant reviews each section. Fields with missing data show amber "?" indicator.
  6. Accountant adjusts incorrect fields (tracked as manual overrides, amber-100 background).
  7. Clicks "Export as PDF." Browser downloads `2550Q-[TIN]-Q1-2026.pdf`.
  8. PDF used for manual BIR filing via eBIRForms or in-person.
- **Decision points:**
  - Step 1, wrong form for client type: Suggestion shown. Accountant may proceed anyway or switch form.
  - Step 3, client TIN missing: Pre-fill blocked with error.
  - Step 5, required field has no data: Warning on field, not blocked.
  - Step 7, export fails: Toast error, retry.
- **Terminal states:**
  - Success: PDF exported.
  - Error: Retry available.
  - Abandonment: Form state not persisted on close (v1). Future: save form drafts.

---

## 7. Tech Stack

| Category | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| Language | TypeScript | 5.x | Type safety on financial data; compile-time error detection reduces runtime bugs |
| Monorepo | Turborepo | 2.x | Single developer, shared packages (UI, DB, AI); avoids polyrepo version-drift overhead |
| Frontend Framework | Next.js (App Router) | 14.x | SSR for marketing site SEO; SPA behavior for Toolbox; single framework for both apps |
| UI Components | shadcn/ui | Latest | Composable, unstyled, Tailwind-compatible; avoids locked-in component library bloat |
| Styling | Tailwind CSS | 3.x | Utility-first; design token enforcement via config; co-location of styles |
| Data Grid | TanStack Table | v8 | Headless, virtualized; handles 1,000+ row financial data; fully open source |
| Database | Supabase (PostgreSQL) | Managed latest | Relational model for financial data; `numeric` type for decimal precision; SQL reporting; RLS-ready |
| Auth | Supabase Auth | — | Bundled with Supabase; email/password for Toolbox access |
| Storage | Supabase Storage | — | Document attachments and generated PDFs; private bucket |
| Edge Functions | Supabase Edge Functions (Deno) | — | Serverless; triggered by Gmail webhooks and accountant actions; co-located with DB |
| AI — Text/Classification | Claude API (Haiku) | claude-3-5-haiku | Email classification, transaction categorization; low latency (< 2s), low cost |
| AI — OCR/Extraction | Claude API (Sonnet Vision) | claude-3-5-sonnet | Multimodal document parsing; structured output from financial document images |
| AI — Reports/Drafts | Claude API (Sonnet) | claude-3-5-sonnet | Report narrative generation, email drafting; higher quality prose output |
| AI — Vision Fallback | Google Cloud Vision | v1 | Fallback when Claude Vision is unavailable; pure OCR on low-quality images |
| Email Integration | Gmail API | v1 | Document intake (push notifications); invoice and draft sending |
| Call Booking | Cal.com | Latest | Open source, embeddable, connects to Google Calendar; zero subscription cost |
| PDF Generation | @react-pdf/renderer or Puppeteer | Latest | Server-side PDF for consistent cross-browser output on reports, BIR forms, invoices |
| Sheets Export | Google Sheets API | v4 | Client report delivery in spreadsheet format; writes to client's designated folder |
| Hosting — Frontend | Vercel | — | Native Next.js deployment; free tier viable at launch volume |
| Hosting — Backend | Supabase | Managed | Managed PostgreSQL + Auth + Storage + Edge Functions |

**Rejected alternatives:**
- **Firebase/Firestore:** NoSQL model fights relational accounting data; no decimal precision; SQL required for P&L and balance sheet queries.
- **HubSpot / Zoho CRM:** Bloated for a 2-person accounting practice; purpose-built CRM is faster and leaner.
- **QuickBooks / Xero / FreshBooks:** Not PH-BIR-compliant without heavy customization; overkill; Rick requires full system ownership.
- **Google Sheets as primary data store:** No data integrity constraints; AI writes to fragile cell coordinates; no queryable audit trail; Sheets API rate limits bottleneck batch processing.
- **Polyrepo:** Single developer with shared packages incurs unnecessary version-bump and cross-repo PR overhead.
- **AG Grid:** Community license lacks advanced features (row grouping, column menus) required for accountant-grade grid UX; enterprise license cost unjustified; TanStack Table v8 with virtualization is sufficient.

---

## 8. Data Structures

### Lead

```typescript
interface Lead {
  id: string;                        // UUID
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  source: LeadSource;
  stage: LeadStage;
  notes?: string;
  createdAt: string;                 // ISO 8601
  updatedAt: string;
}

enum LeadSource {
  WebsiteForm = "website_form",
  CalBooking = "cal_booking",
  Referral = "referral",
  Manual = "manual",
}

enum LeadStage {
  Lead = "lead",
  Contacted = "contacted",
  CallBooked = "call_booked",
  ProposalSent = "proposal_sent",
  Negotiation = "negotiation",
  ClosedWon = "closed_won",
  ClosedLost = "closed_lost",
}
```

### Client

```typescript
interface Client {
  id: string;
  businessName: string;
  businessType: BusinessType;
  tin: string;                       // Format: ###-###-###[-###]
  registeredAddress: string;
  industry: string;
  birRegistrationType: BIRRegistrationType;
  fiscalYearStartMonth: number;      // 1–12
  gmailAddress: string;
  monthlyRevenueBracket: RevenueBracket;
  googleSheetFolderUrl?: string;
  status: ClientStatus;
  convertedFromLeadId?: string;
  createdAt: string;
  updatedAt: string;
}

enum BusinessType {
  SoleProprietorship = "sole_prop",
  OPC = "opc",
  Corporation = "corporation",
}

enum BIRRegistrationType {
  VAT = "vat",
  NonVAT = "non_vat",
}

enum RevenueBracket {
  Below250K = "below_250k",
  Between250KAnd500K = "250k_500k",
  Between500KAnd1M = "500k_1m",
  Between1MAnd3M = "1m_3m",
  Above3M = "above_3m",
}

enum ClientStatus {
  Active = "active",
  Inactive = "inactive",
}
```

### Transaction

```typescript
interface Transaction {
  id: string;
  clientId: string;
  date: string;                      // YYYY-MM-DD
  description: string;               // Max 255 chars
  amount: string;                    // Decimal string — preserves precision
  currency: string;                  // Default: "PHP"
  type: TransactionType;
  categoryCode: string;              // ChartOfAccountsCategory.code
  categoryConfidence?: number;       // 0–1; null if manually assigned
  sourceEmailNotificationId?: string;
  sourceDocumentAttachmentId?: string; // UUID FK → document_attachments (Storage URL resolved via join)
  status: TransactionStatus;
  approvedBy?: string;               // User ID
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

enum TransactionType {
  Credit = "credit",
  Debit = "debit",
}

enum TransactionStatus {
  Pending = "pending",
  InReview = "in_review",
  Approved = "approved",
  Rejected = "rejected",
  ManualEntryRequired = "manual_entry_required",
}
```

### EmailNotification

```typescript
interface EmailNotification {
  id: string;
  gmailMessageId: string;            // Idempotency key — unique constraint
  clientId?: string;                 // Null if sender unmatched
  senderEmail: string;
  subject: string;
  receivedAt: string;
  documentTypeGuess?: DocumentTypeGuess;
  classificationConfidence?: number;
  status: NotificationStatus;
  processingError?: string;
  createdAt: string;
  updatedAt: string;
}

enum DocumentTypeGuess {
  Receipt = "receipt",
  BankStatement = "bank_statement",
  Invoice = "invoice",
  CreditCardStatement = "credit_card_statement",
  ExpenseReport = "expense_report",
  PayrollData = "payroll_data",
  Other = "other",
}

enum NotificationStatus {
  Unprocessed = "unprocessed",
  Processing = "processing",
  Processed = "processed",
  Failed = "failed",
  Dismissed = "dismissed",
}
```

### Invoice

```typescript
interface Invoice {
  id: string;
  invoiceNumber: string;             // System-assigned: INV-YYYY-####
  clientId: string;
  lineItems: InvoiceLineItem[];
  subtotal: string;                  // Decimal string
  vatAmount?: string;                // Decimal string; only if client is VAT-registered
  totalAmount: string;               // Decimal string
  issueDate: string;                 // YYYY-MM-DD
  dueDate: string;
  status: InvoiceStatus;             // Overdue is derived, not stored
  sentAt?: string;
  paidAt?: string;
  gmailMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;                 // Decimal string
  lineTotal: string;                 // quantity × unitPrice, decimal string
}

enum InvoiceStatus {
  Draft = "draft",
  Sent = "sent",
  Paid = "paid",
  // Overdue = derived at read time: status=sent AND dueDate < today
}
```

### Task

```typescript
interface Task {
  id: string;
  title: string;
  dueDate: string;                   // YYYY-MM-DD
  linkedEntityType?: "lead" | "client";
  linkedEntityId?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

enum TaskPriority { Low = "low", Medium = "medium", High = "high" }
enum TaskStatus { Todo = "todo", InProgress = "in_progress", Done = "done" }
```

### Deadline

```typescript
interface Deadline {
  id: string;
  clientId: string;
  deadlineType: DeadlineType;
  dueDate: string;                   // YYYY-MM-DD
  period: string;                    // Human label: "January 2026", "Q1 2026"
  status: DeadlineStatus;            // Overdue derived at read time
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

enum DeadlineType {
  MonthlyBookkeeping = "monthly_bookkeeping",
  MonthlyVAT = "monthly_vat",
  QuarterlyBIR = "quarterly_bir",
  QuarterlyFinancials = "quarterly_financials",
  AnnualITR = "annual_itr",
  AnnualFinancials = "annual_financials",
}

enum DeadlineStatus {
  Upcoming = "upcoming",
  InProgress = "in_progress",
  Completed = "completed",
  // Overdue = derived: status != completed AND dueDate < today
}
```

### ChartOfAccountsCategory

```typescript
interface ChartOfAccountsCategory {
  code: string;                      // e.g., "4000"
  name: string;                      // e.g., "Revenue"
  type: AccountType;
  parentCode?: string;
  isActive: boolean;
}

enum AccountType {
  Asset = "asset",
  Liability = "liability",
  Equity = "equity",
  Revenue = "revenue",
  Expense = "expense",
}
```

### FinancialReport

```typescript
interface FinancialReport {
  id: string;
  clientId: string;
  reportType: ReportType;
  periodStart: string;               // YYYY-MM-DD
  periodEnd: string;
  generatedAt: string;
  generatedBy: string;               // User ID
  aiNarrative?: string;              // AI-generated narrative text (null if not yet generated)
  aiNarrativeApproved: boolean;
  exportedPdfPath?: string;           // Supabase Storage path (signed URL resolved on access)
  createdAt: string;
}

enum ReportType {
  ProfitAndLoss = "profit_and_loss",
  BalanceSheet = "balance_sheet",
  CashFlow = "cash_flow",
  BankReconciliation = "bank_reconciliation",
  ARAgeing = "ar_ageing",
  APAgeing = "ap_ageing",
  GeneralLedger = "general_ledger",
  TrialBalance = "trial_balance",
}
```

### BIRTaxFormRecord

```typescript
interface BIRTaxFormRecord {
  id: string;
  clientId: string;
  formNumber: BIRFormNumber;
  filingPeriod: string;              // e.g., "Q1-2026", "2026-01"
  status: TaxFormStatus;
  prefillData: Record<string, string>;      // BIR field codes → values
  manualOverrides: Record<string, string>;  // Fields edited by accountant
  exportedPdfPath?: string;
  createdAt: string;
  updatedAt: string;
}

enum BIRFormNumber {
  Form2551Q = "2551Q",
  Form2550M = "2550M",
  Form2550Q = "2550Q",
  Form1701 = "1701",
  Form1701Q = "1701Q",
  Form1702 = "1702",
  Form1702Q = "1702Q",
  Form1601C = "1601-C",
  Form1601EQ = "1601-EQ",
  Form0619E = "0619-E",
  Form0619F = "0619-F",
}

enum TaxFormStatus {
  Draft = "draft",
  PrefillPending = "prefill_pending",
  PrefillComplete = "prefill_complete",
  Exported = "exported",
}
```

---

## 9. Design Requirements

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#0d9488` | CTAs, active nav, approve buttons, teal accents |
| Primary Hover | `#14b8a6` | Button hover, link hover |
| Primary Pressed | `#0f766e` | Button active/pressed |
| Primary Tint | `#ccfbf1` | Badges, approved transaction row tint |
| Background (Toolbox) | `#f8fafc` | Toolbox main page background |
| Background (Website) | `#ffffff` | Marketing website background |
| Surface | `#ffffff` | Cards, modals, elevated elements |
| Text Primary | `#0f172a` | Headings, body text |
| Text Secondary | `#334155` | Labels, secondary text |
| Text Muted | `#64748b` | Captions, placeholders |
| Border | `#e2e8f0` | Input borders, dividers |
| Border Subtle | `#cbd5e1` | Subtle dividers |
| Muted Background | `#f1f5f9` | Disabled states, muted backgrounds |
| Darkest Text | `#020617` | High emphasis only |
| Error / Destructive | `#ef4444` | Error decorative icons; error text uses `#b91c1c` (7.1:1 on white) |
| Warning | `#f59e0b` | Approaching deadlines, low-confidence AI categories |
| Success | `#22c55e` | Paid invoices, completed deadlines |

### Typography

**Font Family:** Inter (variable font, Google Fonts)
**Numeric rendering:** All financial amounts use `font-variant-numeric: tabular-nums` (column alignment).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Hero Headline (Website H1) | 48px | 700 | 48px (1) |
| Hero Subheading (Website) | 36px | 600 | 40px |
| Section Heading (Website H2) | 30px | 600 | 36px |
| Card/Sub Heading (Website H3) | 24px | 600 | 32px |
| Page Title (Toolbox) | 20px | 600 | 28px |
| Section Label (Toolbox) | 18px | 600 | 28px |
| Body (Website) | 16px | 400 | 24px |
| Body / Base (Toolbox) | 14px | 400 | 20px |
| Button Label | 14px | 500 | 20px |
| Input Text (Toolbox) | 14px | 400 | 20px |
| Input Text (Website) | 16px | 400 | 24px |
| Caption / Metadata | 12px | 400 | 16px |

**Weights used:** 400 (regular), 500 (medium — buttons, UI labels), 600 (semibold — headings), 700 (bold — hero headline, emphasis).

### Spacing System

| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Inline icon-to-text gaps |
| space-2 | 8px | Tight padding, compact list items |
| space-3 | 12px | Input internal padding, small gaps |
| space-4 | 16px | Card padding (Toolbox), standard component gaps |
| space-6 | 24px | Card padding (Website), section gaps (Toolbox) |
| space-8 | 32px | Section spacing (Toolbox) |
| space-12 | 48px | Section spacing (Website) |
| space-16 | 64px | Page-level section separation (Website) |
| space-24 | 96px | Hero sections (Website) |

### Breakpoints

| Name | Width | Behavior |
|------|-------|----------|
| Mobile | < 768px | Single column; hamburger nav (Website); bottom tab nav (Toolbox); card views replace tables |
| Tablet | 768px–1279px | Two-column grids; sidebar collapsed to 64px; horizontal scroll on data tables |
| Desktop | ≥ 1280px | Full layout; sidebar 240px expanded; full kanban; full data grid |
| Wide | ≥ 1440px | Document preview always visible (Toolbox); max-content 1200px (Website) |

### Border Radius

| Token | Toolbox | Website |
|-------|---------|---------|
| radius-sm | 4px | 6px |
| radius-md | 6px | 8px |
| radius-lg | 8px | 12px |
| radius-xl | 12px | 24px |
| radius-full | 9999px | 9999px |

Buttons: `radius-md`. Inputs: `radius-md`. Cards: `radius-lg`. Tags/badges: `radius-full`.

### Elevation / Depth

| Level | Usage | Shadow |
|-------|-------|--------|
| 0 | Page backgrounds, table rows | none |
| 1 | Cards at rest | `0 1px 2px rgba(0,0,0,0.05)` |
| 2 | Card hover, focused inputs | `0 2px 4px rgba(0,0,0,0.06)` |
| 3 | Dropdowns, popovers, tooltips | `0 4px 12px rgba(0,0,0,0.08)` |
| 4 | Modals, drawers, dialogs | `0 12px 24px rgba(0,0,0,0.10)` |

**Z-index:** Base 0 / Sticky nav + sidebar 100 / Dropdowns + popovers 200 / Modals + drawers 300 / Toasts 400 / Tooltips 500

### Animation

| Element | Trigger | Duration | Easing | prefers-reduced-motion |
|---------|---------|----------|--------|----------------------|
| Button background | Hover | 200ms | cubic-bezier(0.4,0,0.2,1) | Instant (no animation) |
| Nav transparent → white | Scroll | 200ms | cubic-bezier(0.4,0,0.2,1) | Instant |
| Mobile menu open | Tap hamburger | 300ms | cubic-bezier(0,0,0.2,1) | Instant |
| Sidebar expand/collapse | Toggle | 300ms | cubic-bezier(0.4,0,0.2,1) | Instant |
| Drawer/sheet open | Navigation | 300ms | cubic-bezier(0,0,0.2,1) | Instant |
| Drawer/sheet close | Close action | 300ms | cubic-bezier(0.4,0,1,1) | Instant |
| Toast appear | Action | 200ms | cubic-bezier(0,0,0.2,1) | Instant |
| Toast dismiss | Auto (4s) / manual | 200ms | cubic-bezier(0.4,0,1,1) | Instant |
| Card drag lift | Drag start | 100ms | cubic-bezier(0.4,0,0.2,1) | No animation |
| Row approve checkmark | Click approve | 100ms | cubic-bezier(0.4,0,0.2,1) | Instant |
| Skeleton shimmer | Data loading | 1500ms loop | ease-in-out | Static flat slate-100 (no shimmer) |

### Iconography

- **Style:** Outlined (2px stroke)
- **Source:** Lucide React
- **Default size:** 16px (Toolbox inline), 20px (Toolbox nav + buttons), 24px (Website accents)
- **Touch-target size:** 44px × 44px minimum (icon centered within target padding)

---

## 10. Performance Requirements

### Marketing Website

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP | < 2.5s on 4G LTE | Google Lighthouse CI on deploy |
| INP | < 200ms | Google Lighthouse |
| CLS | < 0.10 | Google Lighthouse |

| Bundle Scope | Budget |
|--------------|--------|
| Total JS initial load | < 150KB gzipped |
| Total CSS initial load | < 30KB gzipped |
| Per-route JS (code-split) | < 50KB gzipped |
| Above-fold images | < 200KB (WebP) |

| Lighthouse Category | Target |
|--------------------|--------|
| Performance | ≥ 90 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 95 |

### Toolbox (CRM + Workdesk)

| Metric | Target | Notes |
|--------|--------|-------|
| LCP | < 3.0s on broadband | Internal app; 4G target not required |
| INP | < 200ms | All clicks and keystrokes |
| CLS | < 0.10 | Especially during data grid skeleton-to-data |
| Data grid render (1,000 rows) | < 100ms to first painted row | TanStack Table virtual rows |

| Lighthouse Category | Target |
|--------------------|--------|
| Performance | ≥ 75 |
| Accessibility | ≥ 90 |
| Best Practices | ≥ 90 |

### AI Pipeline Latency

| Operation | Target |
|-----------|--------|
| Email classification (notification appears) | < 10s after email lands in Gmail |
| Document processing — 1-page receipt | < 30s after "Process" click |
| Document processing — multi-page bank statement (up to 10 pages) | < 60s |
| Report generation — P&L, 1 month, < 500 transactions | < 5s |
| Report generation — General Ledger, annual, < 5,000 transactions | < 30s |
| BIR form pre-fill | < 5s |

### Runtime

- **Frame rate:** 60fps during animations and scroll
- **Animation jank threshold:** No frame drop below 30fps during page transitions
- **Idle JS long tasks:** < 50ms on main thread

### Network Assumptions

- **Marketing website:** 4G LTE (12 Mbps) minimum — Philippine mobile users.
- **Toolbox:** Broadband (≥ 10 Mbps) — desktop, Wi-Fi assumed.
- **Offline behavior:** No offline support. Both apps require network. Offline state: full-page message "You appear to be offline. Please check your connection."
- **Slow connection (Toolbox):** Skeleton screens shown immediately. Requests timeout at 30s; error state with Retry.

---

## 11. Accessibility Requirements

### Compliance

- **WCAG level:** WCAG 2.1 AA
- **Regulatory:** No Philippine legal accessibility mandate for v1, but AA is the quality baseline.

### Color and Contrast

| Context | Minimum Ratio |
|---------|--------------|
| Body text (≥ 14px regular) | 4.5:1 |
| Large text (≥ 18px regular or ≥ 14px bold) | 3.0:1 |
| Interactive elements (buttons, links) | 4.5:1 |
| Informational icons | 3.0:1 |
| Focus indicators | 3.0:1 against adjacent colors |
| Placeholder text | 3.0:1 |

Verified pairs: teal-600 on white = 4.55:1 ✓ / slate-900 on white = 17.7:1 ✓ / slate-500 on white = 4.6:1 ✓ / Error text uses red-700 (`#b91c1c`) on white = 7.1:1 ✓

### Touch and Click Targets

- **Minimum:** 44px × 44px (touch) / 32px × 32px (desktop click)
- **Minimum spacing between targets:** 8px

### Keyboard Navigation

- All interactive elements reachable via Tab in visual order (left-to-right, top-to-bottom)
- Enter / Space activates buttons
- Escape: closes modals, drawers, dropdowns, popovers, cancels grid row edit mode
- Arrow keys: navigate dropdown menus (↑↓), data grid rows (↑↓), kanban columns in keyboard mode (←→)
- Data grid shortcuts: `A` = Approve focused row, `R` = Reject focused row (when grid has focus)

### Screen Reader

- Semantic heading hierarchy: h1 on page/hero title, h2 on sections, h3 on cards — no skipped levels
- All images: meaningful `alt` text, or `alt=""` for decorative
- Icon-only buttons: explicit `aria-label`
- `aria-live="polite"` for: toast notifications, status badge changes, notification count badge
- `aria-live="assertive"` for immediate error messages
- All form inputs paired with `<label>` elements
- Error messages linked to inputs via `aria-describedby`
- Data grid: `role="grid"`, `role="row"`, `role="gridcell"` per TanStack Table semantic config
- Sidebar nav: `role="navigation"`, `aria-current="page"` on active link
- Loading containers: `aria-busy="true"` + `aria-label="Loading…"` on skeleton wrappers

### Motion Sensitivity

- `prefers-reduced-motion: reduce`: All CSS transitions and JS animations replaced with instant state changes
- No auto-playing animations or looping GIFs in base state
- Skeleton shimmer disabled under reduced-motion; static slate-100 placeholder shown
- Drag-and-drop under reduced-motion: Immediate reorder with toast confirmation; no animation

### Focus Management

- Visible focus ring: 2px solid teal-600, 2px offset, on all interactive elements (explicit CSS `outline`, not browser default)
- Focus trapped within open modals and drawers: Tab cycles only within overlay
- Focus returns to trigger element on modal/drawer close
- Route change: Focus moves to page `h1`
- Skip-to-content link: First focusable element on every page; visually hidden, appears on focus

---

## 12. Scope Boundaries

### In Scope (v1)

**Marketing Website:**
- Landing page: hero, services, how it works, contact form, Cal.com booking embed, footer
- SSR via Next.js for SEO (meta tags, structured data for local PH business)
- Mobile-first responsive (< 768px primary breakpoint)
- Contact form submissions auto-create Lead in CRM at stage "Lead"

**CRM Module:**
- Lead pipeline with 7 stages (Lead → Closed Won / Closed Lost)
- Lead cards, lead detail drawer with activity log
- Client list, client profile with all onboarding fields
- Task tracker linked to leads and clients
- Billing and invoicing: generate, send via Gmail, mark as paid manually
- Lead-to-client conversion triggering onboarding workflow

**Workdesk Module:**
- Email notification panel (Gmail agent-classified documents)
- Manual document processing trigger (accountant-initiated)
- Claude Vision OCR and data extraction (Google Cloud Vision fallback)
- Transaction data grid: review, edit, approve, reject, bulk approve
- Document preview panel (source document alongside grid)
- Financial report generation: P&L, Balance Sheet, Cash Flow, Bank Reconciliation, AR Ageing, AP Ageing, General Ledger, Trial Balance
- BIR tax form preparation: 2551Q, 2550M, 2550Q, 1701, 1701Q, 1702, 1702Q, 1601-C, 1601-EQ, 0619-E, 0619-F
- Deadline tracker with auto-generated deadlines on client onboarding
- Invoice sending from Workdesk (CRM integration)
- PDF export: reports, BIR forms, invoices
- Google Sheets export: transaction data, financial reports
- AI follow-up email drafting

**AI Pipeline:**
- Gmail push notification webhook → email classification (Claude Haiku)
- Document OCR and structured data extraction (Claude Vision / Google Cloud Vision)
- Transaction categorization with confidence scoring (Claude Haiku)
- Report narrative generation (Claude Sonnet, mandatory accountant review gate)
- Follow-up email draft generation (Claude Sonnet)

**Infrastructure:**
- Supabase Auth (email/password for Toolbox)
- Supabase Storage (document attachments, generated PDFs)
- Gmail API integration (read + send, accountant's connected Gmail account)
- Google Sheets API (export to client's assigned folder)

### Out of Scope (v1)

- **Client portal / client login:** Clients interact via email only. Self-service UI requires auth isolation, client-facing UX, and upload flows not scoped for a 2-person firm in v1.
- **Online payment processing:** Invoices sent, but payment is bank transfer / GCash / cash confirmed manually. Payment gateway integration requires PCI compliance and gateway contracts.
- **Payroll processing:** Separate Philippine regulatory domain (SSS, PhilHealth, Pag-IBIG). Requires partner discussion not yet completed.
- **CFO advisory / financial forecasting:** Requires scenario modeling, projections, and a different user workflow outside the firm's current services.
- **Audit services:** Different compliance obligations and documentation standards; not in the firm's current offering.
- **Multi-tenant / SaaS:** Single-tenant only. Tenant isolation and subscription management are far-future.
- **Native mobile app:** Web-responsive only. No React Native or Capacitor.
- **Custom spreadsheet engine:** Workdesk uses TanStack Table for grid UI, Google Sheets for export — no built-in formula engine.
- **SSO / social login:** Email/password auth only. Google OAuth and SAML deferred.
- **Automated BIR e-filing (eBIRForms API submission):** BIR does not offer a public submission API. Tax forms exported as PDFs for manual filing. Not a system limitation — a BIR infrastructure reality.
- **Multi-currency:** Philippines only, PHP only.
- **Real-time collaborative editing:** Single-tenant, typically one active Toolbox user.

---

## 13. Success Metrics

### Measurable at Launch

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Marketing site LCP | < 2.5s on 4G | Lighthouse CI on deploy |
| Marketing site Lighthouse SEO | ≥ 95 | Lighthouse CI |
| Toolbox initial LCP | < 3.0s on broadband | Lighthouse CI |
| Contact form API success rate | ≥ 98% (error rate < 2%) | Supabase Edge Function error logs |
| Document processing success rate (OCR) | ≥ 90% of triggered documents | `email_notifications` table: processed ÷ total |
| Document processing time — 1-page receipt | < 30s | Edge Function execution time in Supabase logs |
| Transaction grid render — 1,000 rows | < 100ms first painted row | Browser performance mark in TanStack Table config |
| BIR form pre-fill time | < 5s | Edge Function execution time |
| Report generation — P&L under 500 transactions | < 5s | Edge Function execution time |

### Requires Post-Launch Data

| Metric | Target | Measurement | Data Available By |
|--------|--------|-------------|-------------------|
| AI category auto-assignment acceptance rate | ≥ 85% | Approved transactions where category was AI-assigned and not edited ÷ total AI-assigned | 30 days (~100 transactions) |
| Accountant correction rate on extracted fields | < 20% of fields | Edits to AI-extracted fields ÷ total fields extracted | 30 days |
| Deadline miss rate | 0% in first 3 months | Deadlines marked complete after due date ÷ total deadlines | 3 months |
| Monthly transactions processed per active client | ≥ 50 | Supabase transaction count by client and month | 60 days |
| Website lead-to-call-booked conversion | ≥ 15% of form submissions | CRM leads in "Call Booked" ÷ total website leads | 90 days (traffic-dependent) |

---

## 14. Risks and Assumptions

### Critical Assumption

**AI OCR accuracy is sufficient to make the review workflow faster than manual entry.**

This is the foundational assumption of the entire product. If Claude Vision extracts transaction data at an accuracy level where the accountant spends more time correcting AI errors than entering data manually, the Workdesk's value proposition fails. Philippine bank statements and receipts vary enormously in format and quality — BDO, BPI, Metrobank, Landbank, and UnionBank each have different statement layouts; some receipts are handwritten; some PDFs are scanned images at low DPI.

**What breaks if wrong:** The accountant reverts to spreadsheet entry. The Workdesk becomes a friction layer, not an accelerator.

**Early detection:** Correction rate tracked from day 1. If correction rate exceeds 40% in the first month, OCR pipeline requires prompt engineering iteration before additional clients are onboarded.

**Fallback:** The Workdesk is designed for fast manual entry as a parallel capability — keyboard shortcuts, tab navigation, CSV import. The grid is useful even without AI extraction. "Manual Entry Required" status exists in the data model. The AI pipeline is optional per document.

### Other Assumptions

| Assumption | What Breaks if Wrong | Fallback |
|-----------|---------------------|----------|
| Gmail is primary document intake for all clients | Documents arrive via WhatsApp, USB, physical receipt — missed by system | Add manual file upload directly to Workdesk (file picker → triggers OCR pipeline). Spec for v1.1. |
| One accountant is the sole Toolbox user in v1 | Second accountant hired; task ownership unclear; no per-user assignment | Supabase RLS is designed for multi-user; per-user task assignment can be added without schema change |
| BIR form templates match current BIR requirements at launch | Forms revised; exported PDFs non-compliant | Template fields stored as editable structured data; Rick can update field mappings without redeployment |
| Supabase free tier sufficient at launch (< 20 clients, < 10k rows) | Free tier limits hit | Supabase Pro ($25/month) — planned upgrade, not a risk |
| Cal.com embed works within Next.js SSR context | Script blocked or CORS error | Fallback: Cal.com booking link opens in new tab (specified in Cal.com Embed feature error state) |
| Rick remains sole developer through v1 | Unavailability; system breaks with no one to fix it | Turborepo + TypeScript + documented Edge Function contracts; system runs without code changes once deployed |

### Dependencies

| Dependency | Owner | Status | Impact if Unavailable |
|-----------|-------|--------|-----------------------|
| Anthropic Claude API | Anthropic | Active (paid) | OCR, categorization, narratives, drafts all fail; manual entry fallback only |
| Google Cloud Vision | Google | Active (paid) | Secondary OCR fallback unavailable; manual entry only |
| Gmail API | Google | Active (OAuth) | Email ingestion and document sending completely unavailable |
| Google Sheets API | Google | Active (OAuth) | Sheets export fails; PDF export unaffected |
| Supabase | Supabase | Managed | Full system down — database, auth, storage, edge functions |
| Vercel | Vercel | Managed | Marketing website and Toolbox frontend unavailable |
| Cal.com | Cal.com | Pending setup | Booking embed fails; fallback to contact form |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OCR accuracy varies significantly across Philippine bank formats | High | High | Iterative prompt engineering per bank; confidence scoring routes low-confidence to manual review; correction rate tracked from day 1 |
| BIR form templates become outdated without notice | Medium | High | Templates stored as structured data; Rick updates field mappings via admin; stale template banner in UI |
| Claude API latency exceeds 30s for large bank statements | Medium | Medium | Async processing with progress indicator; 60s timeout with retry; accountant not blocked during processing |
| Accountant rejects Workdesk as slower than spreadsheets | Medium | High | Keyboard shortcuts (A/R), bulk approve, virtualized grid; onboarding training to demonstrate speed |
| Gmail API rate limits on high-volume processing | Low | Medium | Edge Function batch processing; typical volume (10–20 clients × 10–20 emails/month) is well within Gmail API quotas |
| Solo developer bottleneck | High | High | Modular Turborepo architecture; TypeScript; documented contracts; system runs autonomously once deployed |
| Scope creep as accountant partner requests new features | Medium | Medium | v1 scope locked in this PRD; additions require explicit PRD revision before implementation |

---

## AI/ML Sections

### AI Solution Approach

| Feature | Approach | Rationale |
|---------|----------|-----------|
| Email classification | Prompt Engineering | Binary classification with structured output; Claude Haiku provides < 2s latency at minimal cost |
| Document OCR / Extraction | Prompt Engineering + Vision Model | Claude Vision (multimodal); output schema defined by prompt; no training data required |
| Transaction Categorization | Prompt Engineering | Closed-set classification (chart of accounts); few-shot examples in prompt; Haiku sufficient |
| Report Narrative Generation | Prompt Engineering | Standard financial commentary; structured data → prose; Sonnet for quality |
| Follow-up Email Drafting | Prompt Engineering | Template-guided generation; accountant always reviews before send |

No fine-tuning, no RAG in v1.

### Model Requirements

| Feature | Model | Input | Output | Latency Target | Est. Cost/Request |
|---------|-------|-------|--------|---------------|-------------------|
| Email classification | claude-3-5-haiku | Subject + sender + snippet (< 500 tokens) | JSON `{isDocument, documentType, confidence}` | < 2s | ~$0.0004 |
| Document OCR | claude-3-5-sonnet (vision) | Document image/PDF (≤ 3 pages per call) | JSON `{date, description, amount, currency, type, vendor}` | < 15s per call | ~$0.005–0.015 |
| Transaction categorization | claude-3-5-haiku | Description + amount + client industry (< 200 tokens) | JSON `{category, confidence}` | < 2s | ~$0.0003 |
| Report narrative | claude-3-5-sonnet | Report data (< 2,000 tokens) | Prose (< 300 tokens) | < 5s | ~$0.006 |
| Email drafting | claude-3-5-sonnet | Template type + context (< 500 tokens) | Email body (< 400 tokens) | < 5s | ~$0.005 |

**Context window:** All requests estimated < 4,096 tokens. Multi-page documents processed page-by-page (separate Vision calls, max 3 pages each).

**Monthly cost ceiling:** $30/month at 20 active clients. Alert triggered at $25 (monitored via Anthropic usage dashboard).

### Quality and Evaluation

| Feature | Metric | Target |
|---------|--------|--------|
| Email classification | Precision (documents correctly flagged) | ≥ 90% |
| Email classification | Recall (no missed documents) | ≥ 95% (false negatives worse than false positives) |
| Document OCR — amount extraction | Field accuracy (no correction needed) | ≥ 90% |
| Document OCR — date extraction | Field accuracy | ≥ 95% |
| Transaction categorization (confidence ≥ 0.85) | Accountant acceptance rate (no category change) | ≥ 85% |

**Hallucination tolerance:**

| Output | Tolerance | Reason |
|--------|-----------|--------|
| Extracted transaction amounts | Zero — reviewed before approval | Direct monetary impact |
| Extracted transaction dates | Zero — reviewed before approval | Affects period accuracy |
| AI-assigned categories | Low — confidence gate at 0.85; all overrideable | Miscategorization affects report accuracy |
| Report narrative prose | Low — mandatory approval gate before export | Narrative goes to clients; factual errors damage credibility |
| BIR form pre-filled values | Zero — all fields reviewed by accountant | Tax filing errors carry financial penalties |
| Email drafts | Acceptable — accountant reads and edits before send | Tone errors are recoverable |

**Evaluation methodology:** No separate eval pipeline in v1. Correction rate and acceptance rate computed automatically from production data in Supabase and surfaced in a simple admin view for Rick. Prompt updates triggered when targets are missed for 2 consecutive weeks.

### Human-in-the-Loop Requirements

| AI Output | Review Required | Reviewer | Gate |
|-----------|----------------|----------|------|
| Email classification | Never — surfaces a notification only | — | Accountant dismisses false positives |
| Extracted transaction data | Always — before marking Approved | Accountant | Approve action |
| AI-assigned category (confidence ≥ 0.85) | Spot-check — overrideable at any time | Accountant | Optional |
| AI-assigned category (confidence < 0.85) | Always — field blank, must select manually | Accountant | Required before Approve |
| Report narrative | Always — must click "Approve Narrative" | Accountant | Gate before export |
| BIR form pre-filled values | Always — review all fields | Accountant | Before export |
| Email draft | Always — review and send manually | Accountant | Before send |

**Override mechanism:** All AI-generated values are editable. Original AI value and corrected value both stored in audit log. Rick reviews edit logs for prompt improvement.

### Feedback Loops

- **Explicit feedback:** None in v1 (no thumbs up/down UI; too much friction for a 2-person team).
- **Implicit feedback — correction rate:** When accountant edits an AI-extracted field, original and corrected values stored in `ai_corrections` audit table. Rick reviews periodically.
- **Category feedback:** Accountant's category overrides logged. Over time, these corrections inform few-shot examples in categorization prompts for specific client industries.
- **Prompt refinement cadence:** Ad hoc in v1. Triggered when correction rate exceeds 20% for a specific document type or bank format.

### Content Safety and Guardrails

- **Input guardrails:** All Claude API calls are system-prompted to act exclusively as a financial document processor. No free-form user input passed directly to AI — all inputs are structured (envelope metadata for classification, document image + schema prompt for OCR, transaction data for categorization).
- **Output guardrails:** OCR JSON output validated against expected schema server-side. Malformed responses treated as extraction failures (Manual Entry Required status created).
- **Data retention:** Claude API zero-data-retention option should be enabled in the Anthropic console — client financial documents are sensitive personal information under the Philippine Data Privacy Act.
- **PII:** Document attachments stored in Supabase Storage private bucket. Not logged to external services beyond the Claude API call.
- **No toxicity risk:** Inputs are financial documents; outputs are structured data and standard business prose. Content moderation not required.
- **Philippine DPA compliance:** Client financial data is sensitive personal information. Data stored in Supabase (set to an appropriate region). Clients consent to data handling through the firm's engagement agreement.

### Failure Modes and Fallbacks

| Failure Mode | Detection | Fallback | User Experience |
|-------------|-----------|----------|-----------------|
| Claude API timeout (> 30s) | Edge Function timeout | Create blank transaction, status: Manual Entry Required | Toast: "Processing timed out. Please enter this transaction manually." |
| Claude API rate limit (429) | 429 response | Exponential backoff: 3 retries at 2/4/8s. If all fail: Manual Entry Required | Toast: "Service temporarily busy. Click to retry in 30 seconds." |
| Claude API unavailable (5xx) | Health check / 5xx | Fallback to Google Cloud Vision for OCR | Toast: "AI processing unavailable. Trying backup service…" |
| Both Vision APIs unavailable | Both fail | Manual Entry Required transaction created | Toast: "Document could not be processed. Please enter manually." |
| Low confidence OCR (< 0.80 on amount) | Confidence score in response | Flag field with amber "?" indicator | Amber border on field; tooltip: "Low confidence — please verify." |
| Malformed JSON from AI | Schema validation failure | Manual Entry Required; raw AI response logged for Rick | Toast: "Document could not be parsed. Please enter manually." |
| Gmail API unavailable | 5xx or network error | Notifications delayed; no data lost | Banner: "Email sync delayed. Documents will appear when service recovers." |
| Email classification false positive | Accountant dismisses notification | Logged as "dismissed" | Dismiss button on each notification card |

### Cost Modeling

**Monthly projection at 5 clients (launch):**
- Email classification: ~100 emails × $0.0004 = $0.04
- OCR: ~50 documents × $0.010 avg = $0.50
- Categorization: ~200 transactions × $0.0003 = $0.06
- Report narratives: ~15 × $0.006 = $0.09
- Email drafts: ~20 × $0.005 = $0.10
- **Total: ~$0.79/month**

**At 20 active clients (12-month projection):** ~$3.15/month base; ~$8/month with retry and edge case buffer.

**Cost ceiling:** $30/month. Alert at $25 (Anthropic usage dashboard, monitored by Rick).

**Cost optimization:** Haiku for classification and categorization (10× cheaper than Sonnet). Sonnet only where output quality matters (OCR, narratives, drafts). Multi-page documents processed page-by-page to control per-call cost. Narrative generation cached if same client + same report type + same period is requested again before export.

---

## Decisions

Key decisions made during PRD authoring beyond those recorded in DISCOVERY-accounting-service.md. These propagate to downstream Tech Spec, API Spec, and UI Design stages.

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | BIR forms in scope: 2551Q, 2550M, 2550Q, 1701, 1701Q, 1702, 1702Q, 1601-C, 1601-EQ, 0619-E, 0619-F | Covers percentage tax, VAT (monthly + quarterly), income tax (individuals + corporations, quarterly + annual), and the most common withholding and remittance forms. Final list to be validated with accountant partner before Tech Spec (per Discovery open question #1). |
| D2 | Invoice "Viewed" status excluded | Gmail API does not provide read receipt functionality without tracking pixel implementation. Invoice statuses are Draft, Sent, Paid (manually confirmed), and Overdue (derived). Added complexity for marginal value; excluded from v1. |
| D3 | Transaction amounts stored as decimal strings | PHP float precision is insufficient for financial calculations. All monetary amounts stored as PostgreSQL `numeric` type and transmitted as strings to avoid JavaScript floating-point errors. |
| D4 | Claude Vision processes documents page-by-page, max 3 pages per API call | Avoids context window overflow on multi-page bank statements. Keeps per-call cost predictable. Transaction records from multi-page documents are linked by shared `sourceEmailNotificationId`. |
| D5 | AI report narratives have a mandatory approval gate before export | Narrative goes to clients. Inaccurate prose damages professional credibility. Accountant must explicitly approve (or edit) before PDF or Sheets export is enabled. |
| D6 | Automated BIR e-filing excluded from scope | BIR does not offer a public API for programmatic eBIRForms submission. Forms exported as PDFs for manual filing. This is a BIR infrastructure limitation, not a system limitation. |
| D7 | TanStack Table over AG Grid | AG Grid Community lacks features required for accountant-grade grid UX (row grouping, advanced filtering) without AG Grid Enterprise license. TanStack Table v8 is fully open source with virtualization adequate for Numera's scale. |
| D8 | Supabase Auth email/password only in v1 | Single-tenant, 2-person team. Google OAuth adds OAuth app registration complexity with no user benefit in a private internal tool. SSO deferred to v1.1. |
| D9 | PDF generation server-side | Client-side PDF generation (jsPDF) produces inconsistent formatting across browsers. Server-side rendering via Supabase Edge Function ensures uniform BIR form and report layouts regardless of the accountant's browser. |
| D10 | Overdue is a derived status for Invoice and Deadline | Not stored in the database. Computed at read time (dueDate < today AND status ≠ paid/completed). Prevents stale overdue states from background job failures. |
| D11 | Deadline auto-generation covers 12 months on onboarding | 12 months provides sufficient forward planning. Annual refresh runs as a scheduled Edge Function on January 1. |
| D12 | Marketing website is a single landing page in v1 | No separate /about, /pricing, or /blog pages. All content lives on the homepage. Additional pages deferred until content strategy is defined. |
| D13 | Follow-up email drafting uses template types, not open-ended chat | Constrains AI prompt surface to well-defined contexts (Document Request, Deadline Reminder, Report Delivery, Custom). Reduces prompt injection risk and produces more consistently professional output. |
| D14 | Category auto-assignment confidence threshold: 0.85 | Below this threshold, incorrect auto-assignments reduce accountant trust. Above it, common transaction types (utilities, sales, bank fees) are reliably categorized. Threshold configurable by Rick in system settings without redeployment. |
| D15 | "Overdue" invoice detection is read-time derived, not a stored status enum value | Prevents `InvoiceStatus.Overdue` from appearing in the enum to avoid confusion — overdue is a display state computed from `status === 'sent' && dueDate < today`, not a state the system transitions to. |
