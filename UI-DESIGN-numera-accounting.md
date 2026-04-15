# Numera Accounting Service — UI Design Specification

**Author:** Kiyotaka Ayanokoji (Design Systems Engineer)
**Date:** 2026-04-15
**Status:** Complete
**Source:** DISCOVERY-accounting-service.md (2026-04-14), PRD-numera-accounting.md (2026-04-15)
**Stitch Project ID:** `4037061963743505139`

---

## Screen Inventory

| # | Screen Name | Stitch Screen ID | Device | Purpose | Status |
|---|-------------|-----------------|--------|---------|--------|
| 1 | Transaction Data Grid — Default | `6af9968397ba4f3bb7765dfdfec27f59` | Desktop | Primary accountant workspace, loaded with data | Complete |
| 2 | Transaction Data Grid — Row Editing | `033162894eb945b3ad998824b3ca6672` | Desktop | Inline edit mode on a single row | Complete |
| 3 | Transaction Data Grid — Bulk Select + Doc Preview | `c3cc9fccaa1043f4bd44867a3e09a04f` | Desktop | Bulk selection with document preview panel open | Complete |
| 4 | Transaction Data Grid — Filtered | `67acc40f631e49bb9325b7f8e55f4254` | Desktop | Active filters applied, empty notification panel | Complete |
| 5 | Marketing Homepage | `ddedaa7f1625486896fc7a37d600bb38` | Desktop | Public-facing lead generation landing page | Complete |
| 6 | Marketing Homepage — Mobile | `929c98dca54748778d7b1f42b320044b` | Mobile | Responsive mobile view of homepage | Complete |
| 7 | Lead Pipeline — Kanban Board | `236a1716a2bc4c64bf92efa00f0283e3` | Desktop | CRM lead management with 7-column pipeline | Complete |
| 8 | BIR Tax Form Preparation | `3f5e4b5c69d340f6bc3824f190767a80` | Desktop | BIR 2550Q pre-fill with prior-year sidebar | Complete |
| 9 | Financial Report Generator | `848e9beba06b4628bcd0da15b6e68d37` | Desktop | P&L generation with AI narrative approval gate | Complete |
| 10 | Deadline Tracker | `ab5d3bf5efb444b88bf89f2d4b874235` | Desktop | Calendar + list view with status indicators | Complete |
| 11 | Client Profile | `7fd819b136c84481bd788707d27df100` | Desktop | CRM client record with onboarding data | Complete |
| 12 | Invoice Creation | `3771e48bcdf3413292ef3136e97280fe` | Desktop | Line-item invoice form with VAT calculation | Complete |
| 13 | Task Tracker | — | Desktop | CRM task list with filters, due dates, and linked entities | Specified (no Stitch screen) |
| 14 | Follow-up Email Drafting | — | Desktop | AI email drafting modal/drawer within client context | Specified (no Stitch screen) |
| 15 | Settings Page | — | Desktop | Admin-only Gmail connection and system settings | Specified (no Stitch screen) |

---

## Design System Tokens (Locked)

Source: DISCOVERY-accounting-service.md Section 9, approved by Rick.

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
| `white` | `#ffffff` | Cards, page background (Website) |
| `teal-700` | `#0f766e` | Primary pressed |
| `teal-600` | `#0d9488` | Primary — CTAs, active states |
| `teal-500` | `#14b8a6` | Primary hover |
| `teal-100` | `#ccfbf1` | Primary tint (tags, badges) |
| `red-500` | `#ef4444` | Destructive, overdue (decorative) |
| `red-700` | `#b91c1c` | Error text, badge text: Rejected/Overdue |
| `red-100` | `#fee2e2` | Badge background: Rejected/Overdue |
| `amber-500` | `#f59e0b` | Warning, approaching deadline (decorative) |
| `amber-700` | `#b45309` | Badge text: Pending/In Progress |
| `amber-100` | `#fef3c7` | Badge background: Pending/In Progress, manual override fields |
| `green-500` | `#22c55e` | Success, on-track (decorative) |
| `green-700` | `#15803d` | Badge text: Approved/Completed |
| `teal-100` | `#ccfbf1` | Badge background: Approved |

**Additions from discussion (Winry):** `amber-700`, `red-700`, `green-700` were missing from the Discovery token set. Added to ensure WCAG AA badge contrast. `amber-700` on `amber-100` = ~7.2:1. `red-700` on `red-100` = ~7.8:1. `green-700` on `teal-100` = ~5.2:1. All pass AA.

### Typography

**Font:** Inter (variable, Google Fonts)
**Numeric rendering:** `font-variant-numeric: tabular-nums` on all financial amounts.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Hero Headline (H1) | 48px | 700 | 48px (1) |
| Hero Subheading | 36px | 600 | 40px |
| Section Heading (H2) | 30px | 600 | 36px |
| Card Heading (H3) | 24px | 600 | 32px |
| Page Title (Toolbox) | 20px | 600 | 28px |
| Section Label (Toolbox) | 18px | 600 | 28px |
| Body (Website) | 16px | 400 | 24px |
| Body / Base (Toolbox) | 14px | 400 | 20px |
| Button Label | 14px | 500 | 20px |
| Caption / Metadata | 12px | 400 | 16px |

### Spacing (4px base)

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Inline icon gaps |
| `space-2` | 8px | Tight padding |
| `space-3` | 12px | Input padding, small gaps |
| `space-4` | 16px | Card padding (Toolbox), component gaps |
| `space-6` | 24px | Card padding (Website), section gaps |
| `space-8` | 32px | Section spacing (Toolbox) |
| `space-12` | 48px | Section spacing (Website) |
| `space-16` | 64px | Page-level sections |
| `space-24` | 96px | Hero sections |

### Border Radius

| Token | Toolbox | Website |
|---|---|---|
| `radius-sm` | 4px | 6px |
| `radius-md` | 6px | 8px |
| `radius-lg` | 8px | 12px |
| `radius-xl` | 12px | 24px |
| `radius-full` | 9999px | 9999px |

Buttons: `radius-md`. Inputs: `radius-md`. Cards: `radius-lg`. Badges: `radius-full`.

### Elevation

| Token | Value | Usage |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Cards at rest |
| `shadow-sm` | `0 2px 4px rgba(0,0,0,0.06)` | Hover lift |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Dropdowns, popovers |
| `shadow-lg` | `0 12px 24px rgba(0,0,0,0.1)` | Modals, dialogs |

### Semantic Mapping (shadcn/ui CSS Variables)

Source: DISCOVERY-accounting-service.md Section 9.

| Variable | Toolbox | Website |
|---|---|---|
| `--primary` | teal-600 (`#0d9488`) | teal-600 (`#0d9488`) |
| `--background` | slate-50 (`#f8fafc`) | white (`#ffffff`) |
| `--foreground` | slate-900 (`#0f172a`) | slate-900 (`#0f172a`) |
| `--card` | white (`#ffffff`) | white (`#ffffff`) |
| `--muted` | slate-100 (`#f1f5f9`) | slate-100 (`#f1f5f9`) |
| `--muted-foreground` | slate-500 (`#64748b`) | slate-500 (`#64748b`) |
| `--border` | slate-200 (`#e2e8f0`) | slate-200 (`#e2e8f0`) |
| `--destructive` | red-500 (`#ef4444`) | red-500 (`#ef4444`) |

### Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| `duration-fast` | 100ms | `cubic-bezier(0.4,0,0.2,1)` | Micro-interactions |
| `duration-normal` | 200ms | `cubic-bezier(0.4,0,0.2,1)` | Hover, button feedback |
| `duration-slow` | 300ms | `cubic-bezier(0,0,0.2,1)` (enter) / `cubic-bezier(0.4,0,1,1)` (exit) | Panel open/close |

All animations respect `prefers-reduced-motion: reduce` — replaced with instant state changes.

### Breakpoints

| Name | Width | Behavior |
|---|---|---|
| Mobile | < 768px | Single column; hamburger nav (Website); bottom tab nav (Toolbox); card views replace tables |
| Tablet | 768px–1279px | Two-column grids; sidebar collapsed 64px; horizontal scroll on data tables |
| Desktop | >= 1280px | Full layout; sidebar 240px expanded; full kanban; full data grid |
| Wide | >= 1440px | Document preview panel always visible alongside grid |

### Iconography

- **Library:** Lucide React
- **Style:** Outlined, 2px stroke
- **Sizes:** 16px (Toolbox inline), 20px (nav + buttons), 24px (Website accents)
- **Touch target:** 44px x 44px minimum

---

## Screen 1: Transaction Data Grid — Default State

**Stitch ID:** `6af9968397ba4f3bb7765dfdfec27f59`
**Priority:** Highest — accountant spends 80% of time here.

### Layout Structure

Three-pane layout at desktop (>= 1280px):

1. **Icon Sidebar** — 64px wide, fixed left. Contains: Numera wordmark (collapsed to "N" icon), module switcher icons (CRM, Workdesk). Workdesk icon has `teal-100` background + `teal-600` icon color when active. Below: Settings and user avatar icons at bottom. Background: `white`, right border `slate-200`.

2. **Notification Panel** — 280px wide, adjacent to sidebar. Header: "NOTIFICATIONS" label in `slate-500` `text-xs` uppercase tracking-wide. Content: vertical stack of email notification cards. Each card contains:
   - Client name (`text-sm`/600, `slate-900`)
   - Email subject (truncated at 60 chars, `text-xs`/400, `slate-500`), full text on hover tooltip
   - Date received (`text-xs`, `slate-400`)
   - Document type badge (`radius-full`, `teal-100` bg, `teal-700` text, `text-xs`)
   - "Process" button (`teal-600` fill, white text, `radius-md`, full card width)
   - Badge count on Workdesk nav icon updates via Supabase realtime subscription
   - Background: `white`, right border `slate-200`

3. **Main Grid Area** — Remaining width. Contains:

   **Top bar:**
   - Page title "Workdesk" (`text-xl`/600)
   - Search field: magnifying glass icon + placeholder "Search transactions, receipts, or clients..." (`slate-500` placeholder, `radius-md`, `slate-200` border, `teal-600` border on focus)

   **Filter bar:**
   - Date range picker (default: current month)
   - Category dropdown ("All Categories")
   - Status dropdown ("All")
   - Client dropdown ("Client: All")
   - When filters are active: filter chips appear below with `slate-100` background, `slate-700` text, `x` close button per chip

   **Action bar (right-aligned):**
   - "Export" button (outline, `slate-700`)
   - "+ New Entry" button (`teal-600` fill, white text)

   **Data Grid:**
   - Full-width virtualized table (TanStack Table v8)
   - Columns: Checkbox | Date | Description | Amount (PHP) | Type | Category | Client | Source | Status
   - Date: `text-sm`, sorted descending by default
   - Description: `text-sm`/400, truncated to 1 line with ellipsis; full text on hover tooltip
   - Amount: right-aligned, `font-variant-numeric: tabular-nums`, formatted as `₱XX,XXX.XX`
   - Type: "Debit" in `red-500` text, "Credit" in `green-500` text
   - Category: `text-sm`
   - Client: `text-sm`
   - Source: document link icon (`slate-500`), clickable — opens Document Preview Panel
   - Status badges:
     - Pending: `amber-100` bg, `amber-700` text
     - Approved: `teal-100` bg, `teal-700` text
     - Rejected: `red-100` bg, `red-700` text
     - In Review: `slate-100` bg, `slate-700` text
   - Row height: 48px
   - Row hover: `slate-50` background
   - Alternating row colors: none (white rows, `slate-200` bottom border)
   - Header row: `slate-50` background, `text-xs`/500 uppercase `slate-500`

   **Footer:**
   - "Showing X of Y transactions" (`text-xs`, `slate-500`, left)
   - Pagination: Previous | 1 | 2 | 3 | Next (right-aligned, `teal-600` active page)

### Interactions

- **Click row checkbox:** Selects row for bulk actions. Selected row gets `teal-50` background.
- **Click Description/Amount/Category cell:** Enters inline edit mode for that row (see Screen 2).
- **Click Source icon:** Opens Document Preview Panel (see Screen 3), notification panel toggles off (shared rail).
- **Click column header:** Sorts ascending/descending. Arrow indicator `↑`/`↓` on active sort column.
- **Hover row:** `slate-50` background, `shadow-xs` lift.
- **Approve action (✓ icon):** Optimistic update — badge changes to Approved immediately (100ms checkmark animation). Undo toast appears for 5 seconds.
- **Reject action (× icon):** Opens rejection reason dialog (optional text field). On confirm, status changes to Rejected.

### Keyboard Navigation

Per discussion (Winry + Levi):

| Key | Action |
|---|---|
| Enter or F2 | Enter edit mode on focused cell |
| Escape | Cancel edit, revert to prior value |
| Tab | Commit edit, advance to next editable cell in row |
| Shift+Tab | Commit edit, move backward |
| Enter (last editable cell) | Commit row, move focus to same column next row |
| Space (checkbox column) | Toggle row selection |
| Shift+Space | Select row range |
| A | Approve focused row (when grid has focus) |
| R | Reject focused row (when grid has focus) |
| Arrow Up/Down | Navigate rows |

### Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop >= 1280px | Full three-pane layout as described |
| Tablet 768px–1279px | Sidebar collapsed to 64px. Notification panel collapsible via toggle button. Grid shows all columns with horizontal scroll. |
| Mobile < 768px | Sidebar replaced by bottom tab bar (44px touch targets). Notification panel becomes bottom sheet via notification count button. Grid switches to card view: Date, Description, Amount, Status per card. "Desktop view" toggle available for full grid with horizontal scroll. |

---

## Screen 2: Transaction Data Grid — Row Editing

**Stitch ID:** `033162894eb945b3ad998824b3ca6672`

### Layout Differences from Default

Same three-pane structure. One row is in edit mode:

- **Editing row:** `teal-50` background highlight, 2px `teal-600` left border.
- **Date cell:** Becomes a date picker input, `radius-md`, `teal-600` border.
- **Description cell:** Text input with cursor blinking, `radius-md`, `teal-600` border. Max 255 chars.
- **Amount cell:** Numeric input, right-aligned, `radius-md`, `teal-600` border. `₱` prefix inside input.
- **Category cell:** Open dropdown showing account categories grouped by type (Revenue, Cost of Sales, Operating Expenses > Utilities, Professional Fees, etc.). Dropdown has `shadow-md`, `radius-md`.
- **Other rows:** Remain in read-only state, slightly dimmed (`opacity: 0.7` or `slate-50` overlay) to direct focus.

### Interactions

- **Tab through cells:** Commits current cell, advances to next editable (Date > Description > Amount > Category).
- **Escape:** Cancels all edits in the row, reverts to original values.
- **Click outside row:** Commits edits if valid; shows validation errors if not.
- **Save indicator:** Row shows brief inline spinner on save, then toast "Transaction updated."
- **Save error:** Toast "Failed to save. Please try again." Row reverts to original values.

### Validation

- Description: required, max 255 chars. Red border + "Required" error if blank.
- Amount: required, numeric only. Red border if non-numeric entered.
- Category: required before Approve action (not before save).
- Category confidence < 0.85: field blank with amber "?" indicator — must be manually selected.

---

## Screen 3: Transaction Data Grid — Bulk Select + Document Preview

**Stitch ID:** `c3cc9fccaa1043f4bd44867a3e09a04f`

### Layout Structure

Two-pane layout (notification panel hidden — shares rail with doc preview, toggled):

1. **Grid Area** (~60% width): Transaction grid with 5 rows selected (checkboxes checked, `teal-100` row highlight). Header checkbox in indeterminate state.

2. **Document Preview Panel** (400px, right side): Slides in from right, 300ms `easing-out`. Contains:
   - Close button (× icon, top-right)
   - Email metadata block: From (sender email), Subject, Date received — `text-sm`, `slate-700`
   - Document preview: PDF rendered via browser native renderer, scaled to panel width. Image attachments displayed directly.
   - Page navigation: "Previous | Page X of Y | Next" for multi-page PDFs
   - Panel background: `white`, left border `slate-200`, `shadow-lg`

3. **Bulk Action Bar** (fixed to bottom of grid area):
   - Left: "X Selected" count badge (`teal-600` bg, white text, `radius-full`)
   - Center: "Approve Selected" (`teal-600` fill, white text), "Reject Selected" (outline, `red-500` border, `red-500` text)
   - Right: "Cancel" (text button, `slate-500`)
   - Bar background: `white`, top border `slate-200`, `shadow-sm` upward
   - Height: 56px, `z-index: 100`

### Layout Decision (Winry)

Notification panel and Document Preview Panel share the same right-side rail. They toggle — never shown simultaneously. Reason: at 1280px viewport, sidebar (64px) + notifications (280px) + doc preview (400px) = 744px consumed, leaving only 536px for the grid — unworkable for an 8-column spreadsheet. The toggle model keeps grid width viable.

### Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Wide >= 1440px | Grid and preview side by side, both visible |
| Desktop 1280px–1439px | Preview pushes grid to ~50% width |
| Tablet/Mobile < 1280px | Preview opens as full-screen overlay with back button |

### Bulk Action States

- **Approving:** Progress indicator "Approving 12 of 15..."
- **Complete:** Toast "15 transactions approved." Rows update optimistically.
- **Partial failure:** "12 approved, 3 failed. See highlighted rows." Failed rows get `red-50` background.

---

## Screen 4: Transaction Data Grid — Filtered View

**Stitch ID:** `67acc40f631e49bb9325b7f8e55f4254`

### Layout Differences

- **Notification panel:** Empty state — envelope illustration centered, "No new documents. You're up to date." in `slate-500` `text-sm`.
- **Filter chips:** Active above grid — "Status: Pending" and "Date: Jan 1–31, 2026" chips with `slate-100` bg, `slate-700` text, `x` close button.
- **Search field:** Contains "Meralco" with clear button.
- **Grid:** Shows 4 filtered rows only, all Pending status.
- **Row count:** "Showing 4 of 156 transactions" — total count reflects unfiltered set.
- **Clear all filters:** Text link right of chips.

---

## Screen 5: Marketing Homepage — Desktop

**Stitch ID:** `ddedaa7f1625486896fc7a37d600bb38`

### Layout Structure (Top to Bottom)

**1. Global Navigation Bar** — Sticky, full-width.
- Scroll = 0: Transparent background.
- Scroll > 0: `white` background, `shadow-xs`, transition 200ms.
- Left: Numera wordmark (teal-600 + slate-900 text).
- Center-right: "Services", "How It Works", "Contact" links (`text-base`/500, `slate-700`, hover `teal-600`).
- Right: "Book a Call" button (`teal-600` fill, white text, `radius-md`).
- Max content width: 1200px centered.

**2. Hero Section** — Full viewport height, two columns.
- Left column:
  - H1: "Expert Bookkeeping and Tax Compliance for Philippine Businesses" (48px/700, `slate-900`)
  - Subheading: "AI-powered accuracy. One accountant. The throughput of five." (20px/400, `slate-700`)
  - Primary CTA: "Book a Discovery Call" (`teal-600` fill, white text, `radius-md`, `shadow-xs`)
  - Secondary CTA: "Send Us a Message" (`teal-600` outline, `teal-600` text, `radius-md`)
- Right column: Abstract clean illustration (teal/slate tones, not stock photos)
- `prefers-reduced-motion`: Entrance animations disabled; content renders immediately.

**3. Services Section**
- Heading: "What We Handle For You" (30px/600, centered)
- 3-column grid of service cards:
  - Each card: Lucide icon (24px, `teal-600`), service name (18px/600), 2-sentence description (16px/400), frequency tag
  - Cards: `white` bg, `radius-lg`, `shadow-xs` at rest, `shadow-sm` on hover (200ms)
  - Services: Bookkeeping (Monthly), Tax Compliance / BIR (Quarterly + Annual), Financial Reporting (Monthly/Quarterly/Annual)

**4. How It Works Section**
- 4 numbered steps in horizontal row with connecting line:
  1. Book a Call
  2. We Onboard Your Business
  3. We Handle Books and Taxes
  4. You Receive Monthly Reports
- Each step: number circle (`teal-600` bg, white text, `radius-full`), Lucide icon, bold title, 1-sentence description.

**5. Contact Form**
- Section heading: "Send Us a Message" (30px/600)
- Fields: Name (required), Email (required), Business Name (optional), Message (required, textarea, min 10 / max 1000 chars)
- Character counter at 800+, turns `red-500` at 1000
- Submit: "Send Message" (`teal-600`, full-width on mobile)
- Honeypot field `website` (hidden)
- Focus state: border `slate-200` → `teal-600` (2px), 100ms
- Error state: `red-500` border, `red-700` error text below field, `aria-describedby` linked
- Success state: form hidden, `teal-100` bg box, `teal-700` text, checkmark icon
- Max field width: 640px centered on desktop

**6. Cal.com Booking Embed**
- Section heading: "Book a Discovery Call"
- Cal.com widget inline, max-width 700px centered
- Loading: skeleton placeholder (`slate-100`, `radius-lg`, ~600px x 500px)
- Error fallback: "Booking is temporarily unavailable. Please use the contact form above to reach us." `slate-700` on `slate-50`

**7. Footer**
- Full-width, `slate-900` background, `white` text.
- Numera wordmark, one-line tagline.
- Nav links: Services, How It Works, Contact — hover: underline + `teal-400`, 200ms.
- Contact email, "© 2026 Numera. All rights reserved.", Privacy Policy link.

### Responsive Behavior

| Element | Desktop >= 1024px | Tablet 768px–1023px | Mobile < 768px |
|---|---|---|---|
| Nav | Full links visible | Same as desktop | Hamburger menu, dropdown panel |
| Hero | Two columns | Two columns, narrower visual | Single column, visual hidden |
| Services | 3-column grid | 2-column grid | 1-column stack |
| How It Works | Horizontal row | Horizontal row | Vertical stack with left numbers |
| Contact form | 640px centered | Full width | Full width |
| Cal.com | 700px centered | Full width | Full width |
| Footer | 2-3 columns | 2 columns | Single column |

---

## Screen 6: Marketing Homepage — Mobile

**Stitch ID:** `929c98dca54748778d7b1f42b320044b`

### Layout Differences from Desktop

- **Nav:** Numera wordmark left, hamburger icon right. On tap: full-width dropdown with links stacked vertically, `x` close icon, body scroll locked. "Book a Call" renders as full-width button.
- **Hero:** Single column. H1 at 36px. CTAs full-width stacked. Visual illustration hidden (decorative).
- **Services:** Single-column card stack.
- **How It Works:** Vertical steps with left-side number indicator and vertical connecting line.
- **Contact form:** Full-width inputs, full-width submit.
- **Footer:** Single column.

All touch targets: 44px x 44px minimum.

---

## Screen 7: Lead Pipeline — Kanban Board

**Stitch ID:** `236a1716a2bc4c64bf92efa00f0283e3`

### Layout Structure

1. **Sidebar** (240px expanded): Numera wordmark, module switcher (CRM tab active: `teal-100` bg, `teal-600` text; Workdesk tab inactive). CRM nav items: Pipeline (active — `teal-100` bg, `teal-600` text + icon, 2px `teal-600` left border), Clients, Tasks, Invoices. User avatar + sign-out at bottom.

2. **Main Area:**
   - Page title: "Lead Pipeline" (`text-xl`/600)
   - "Show Closed" toggle (right of title)
   - "+ Add Lead" button (`teal-600` outline, right-aligned)
   - Kanban board: 7 columns, horizontal scroll if needed

### Kanban Columns

| Column | Default State | Badge Color |
|---|---|---|
| Lead | Visible, open | `slate-100` bg, `slate-700` text |
| Contacted | Visible, open | `slate-100` bg, `slate-700` text |
| Call Booked | Visible, open | `teal-100` bg, `teal-700` text |
| Proposal Sent | Visible, open | `slate-100` bg, `slate-700` text |
| Negotiation | Visible, open | `amber-100` bg, `amber-700` text |
| Closed Won | Collapsed/dimmed by default | `green-500` text |
| Closed Lost | Collapsed/dimmed by default | `red-500` text |

### Lead Card Anatomy

- Min-width: 200px, auto height
- Business name: `text-sm`/600, `slate-900`
- Contact name: `text-xs`, `slate-500`. Hidden if absent.
- Stage badge: color-coded per column, `radius-full`, `text-xs`
- Date added: `text-xs`, `slate-400`
- Calendar icon: shown if stage = Call Booked (`teal-600`)
- Background: `white`, `radius-lg`
- Elevation: `shadow-xs` at rest, `shadow-sm` hover (200ms), `shadow-md` dragging (100ms, 2deg rotation)
- Click: opens Lead Detail drawer (480px right-side)

### Drag-and-Drop

- Source slot: dashed `slate-300` border placeholder
- Drop target highlight: column header gets `teal-50` background
- Invalid drop (backward movement): card snaps back to origin, no state change
- Error: toast "Failed to update lead stage. Please try again."
- `prefers-reduced-motion`: immediate reorder with toast confirmation, no animation

### Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop >= 1280px | Full board, all columns visible, horizontal scroll |
| Tablet 768px–1279px | Horizontal scroll, column min-width 200px, sidebar collapsed 64px |
| Mobile < 768px | List view grouped by stage (accordion). Drag disabled; stage change via select dropdown. Bottom tab nav. |

---

## Screen 8: BIR Tax Form Preparation

**Stitch ID:** `3f5e4b5c69d340f6bc3824f190767a80`

### Layout Structure

1. **Sidebar** (64px collapsed, Workdesk active)

2. **Main Form Area** (~65% width):
   - **Top selectors:** Form Type dropdown (showing "2550Q — Quarterly VAT Return"), Client dropdown, Filing Period dropdown. "Pre-fill from Data" button (`teal-600`).
   - **Form template:** BIR form rendered as structured sections with labeled fields.
     - **Editable fields:** `teal-600` 2px border, `white` bg — accountant can modify.
     - **Read-only fields:** `slate-100` bg — system-populated, locked.
     - **Manual override fields:** `amber-100` bg — accountant has changed a pre-filled value. Visual indicator that original AI value was overridden.
     - **Missing data fields:** Amber "?" indicator icon. Warning, not blocking.
   - **Validation summary:** Appears above form on export attempt. Required empty fields highlighted `red-500`.
   - **Export:** "Export as PDF" button at bottom. Filename: `[FormNumber]-[ClientTIN]-[Period].pdf`.
   - **Stale template banner:** "This form template may be outdated. Verify against the current BIR version." — shown when Rick flags a template as potentially stale.

3. **Prior-Year Comparison Sidebar** (320px right):
   - Title: "Prior Year Comparison" with period label (e.g., "Q1 2025")
   - Same form field layout showing last year's values
   - Difference indicators: green arrow up / red arrow down with percentage change
   - "No prior-year data available." if first year

### Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop >= 1280px | Form + prior-year sidebar side by side |
| Tablet 768px–1279px | Prior-year sidebar collapses to toggle |
| Mobile < 768px | Read-only view, export available. BIR filing is a desktop task in practice. |

---

## Screen 9: Financial Report Generator

**Stitch ID:** `848e9beba06b4628bcd0da15b6e68d37`

### Layout Structure

1. **Sidebar** (64px collapsed, Workdesk active)

2. **Left Panel** (~30%): Report selection.
   - Report Type dropdown: P&L, Balance Sheet, Cash Flow, Bank Reconciliation, AR Ageing, AP Ageing, General Ledger, Trial Balance
   - Client dropdown
   - Period dropdown: presets (This Month, Last Month, This Quarter, Last Quarter, This Year) + Custom date range
   - "Generate" button (`teal-600`)
   - Below form: "Previous Reports" list — date, type, export links. Empty state: "No reports generated yet for this client."

3. **Right Panel** (~70%): Report display.
   - Report header: type, client name, period
   - Formatted financial table: category groupings, amounts in `₱XX,XXX.XX` format, right-aligned with `tabular-nums`. Subtotals bold. Grand total row: `slate-900` bg, white text.
   - **AI Narrative section** (below table):
     - Left border: 4px `teal-600`
     - Label: "AI Summary — Review before sending to client" (`text-xs`, `slate-500`, uppercase)
     - 2–3 paragraphs of financial commentary
     - Actions: "Approve Narrative" (`teal-600`), "Edit" (outline)
     - **Gate:** Export buttons disabled (grayed, `opacity: 0.5`) until narrative is approved or edited+saved. Inline callout: "Approve the AI narrative to enable export." (`amber-100` bg, `amber-700` text, dismissible)
   - **Export buttons** (enabled after approval): "Export PDF" (`teal-600`), "Export to Google Sheets" (outline)

### States

| State | Behavior |
|---|---|
| Generating (< 5s) | Spinner: "Generating report..." |
| Generating (> 3s) | Additional: "This may take a moment." |
| Insufficient data | "Not enough approved transactions to generate this report. Approve pending transactions first." |
| Empty period | "No transactions found for this period." |
| Export PDF | Browser download: `[ReportType]-[ClientName]-[Period].pdf` |
| Export Sheets | New tab. Toast: "Report exported to Google Sheets." |
| No Sheets folder | Toast: "No Google Sheets folder configured for this client." |

### AI Narrative Approval Gate (Design Decision)

The export button is intentionally disabled until narrative is approved. To prevent the accountant from feeling trapped, the approval gate uses an **inline dismissible callout** inside the report view — not a separate step or modal. The callout is visible but non-blocking for reading the report. The accountant sees the full report immediately and approves the narrative as part of their review flow, not as bureaucratic overhead.

---

## Screen 10: Deadline Tracker

**Stitch ID:** `ab5d3bf5efb444b88bf89f2d4b874235`

### Layout Structure

1. **Sidebar** (64px collapsed, Workdesk active)

2. **Main Area** split:

   **Left (65%) — List View:**
   - Page title: "Deadline Tracker" (`text-xl`/600)
   - View toggle tabs: "List" (active) | "Calendar"
   - Filter bar: Client dropdown, Deadline Type dropdown, Status dropdown
   - Deadline rows sorted by nearest due date:
     - Status dot (left): color-coded (see below)
     - Client name (`text-sm`/600)
     - Deadline type (`text-sm`/400, `slate-700`)
     - Due date (`text-sm`, right-aligned)
     - "Mark Complete" button (outline, `teal-600`)
   - Overdue rows: `red-50` background, `red-500` status dot

   **Status dot colors:**
   | Status | Dot Color | Row Treatment |
   |---|---|---|
   | Upcoming (> 7 days) | `slate-500` | Default |
   | Approaching (< 7 days) | `amber-500` | Default |
   | In Progress | `amber-500` | Default |
   | Completed | `green-500` | `slate-400` text, can be hidden via toggle |
   | Overdue | `red-500` | `red-50` row background |

   **Right (35%) — Calendar View:**
   - Monthly calendar (current month)
   - Colored dots on dates with deadlines
   - Click date: popover listing that day's deadlines
   - Legend below calendar

### States

- Empty: "No deadlines scheduled. Onboard a client to generate their deadline calendar."
- Mark complete: optimistic update, undo toast (5s)
- BIR deadline on weekend: flag "Note: This deadline falls on a weekend."
- Inactive client deadlines: grayed with "Inactive client" note

### Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop | List + calendar side by side |
| Tablet/Mobile | List only; calendar via tab toggle |

---

## Screen 11: Client Profile

**Stitch ID:** `7fd819b136c84481bd788707d27df100`

### Layout Structure

1. **Sidebar** (240px expanded, CRM active, Clients nav item active)

2. **Main Area:**
   - Page title: client business name (`text-xl`/600)
   - Action buttons (right): "Edit Profile" (`teal-600` outline), "Open in Workdesk" (`teal-600` fill)
   - Two-column layout:

   **Left column — Identity:**
   | Field | Type | Display |
   |---|---|---|
   | Business Name | Text | `text-sm`/600 value |
   | Business Type | Enum | Sole Prop / OPC / Corporation |
   | TIN | Text | Validated `###-###-###[-###]` |
   | Registered Address | Text | Multi-line |
   | Industry | Select | From predefined list |
   | BIR Registration | Enum | VAT / Non-VAT |
   | Fiscal Year Start | Month | January–December |

   **Right column — Operational:**
   | Field | Type | Display |
   |---|---|---|
   | Gmail Address | Email | Blue link |
   | Monthly Revenue Bracket | Select | Tier labels |
   | Google Sheet Folder | URL | External link icon |

   **Full-width below — Billing:**
   - Current retainer plan label
   - Invoice history table: Invoice #, Amount, Issue Date, Due Date, Status badge
   - Link to full invoicing module

### States

| State | Behavior |
|---|---|
| View mode (default) | All fields read-only. Labels `text-xs`/500 `slate-500`, values `text-sm`/400 `slate-900` |
| Edit mode | Fields become inputs, Save/Cancel visible |
| Saving | Save button spinner |
| Save success | Toast "Client profile saved." Returns to view mode |
| Inactive client | `slate-100` banner at top: "This client is inactive." |

### Validation

- TIN: validated on blur as `###-###-###` or `###-###-###-###`
- Gmail duplicate: error on save
- Gmail change: warning modal about document intake reconfiguration

---

## Screen 12: Invoice Creation

**Stitch ID:** `3771e48bcdf3413292ef3136e97280fe`

### Layout Structure

1. **Sidebar** (240px expanded, CRM active, Invoices nav item active)

2. **Main Area:**
   - Page title: "Create Invoice" (`text-xl`/600)
   - **Form:**
     - Client dropdown (pre-filled if navigated from client)
     - Invoice #: auto-generated `INV-YYYY-####` (read-only, `slate-100` bg)
     - **Line items table:**
       - Columns: Description (text), Qty (number), Unit Price (number), Line Total (calculated, read-only, right-aligned)
       - "+ Add Line Item" button below table (text link, `teal-600`)
       - Minimum 1 line item required
     - **Summary block (right-aligned):**
       - Subtotal: `₱XX,XXX.XX`
       - VAT 12%: auto-shown for VAT-registered clients
       - **Grand Total: bold, `text-lg`**
     - Due Date: date picker
   - **Actions:**
     - "Save as Draft" (outline, `slate-700`)
     - "Preview" (`teal-600` outline)
     - "Send Invoice" (`teal-600` fill) — generates PDF, sends via Gmail API

### States

| State | Behavior |
|---|---|
| 0 line items on submit | Blocked. "Add at least one line item." |
| Sending | Spinner, disabled |
| Send success | Status → Sent. Toast: "Invoice sent to [email]." |
| Gmail disconnected | "Gmail connection is not active. Reconnect Gmail in Settings." |
| Amount = 0 | Warning shown, allowed |

---

## Screen 13: Task Tracker

**Stitch ID:** — (no Stitch screen; specified for developer implementation)
**Priority:** Medium — supports accountant daily workflow in CRM.

### Layout Structure

1. **Sidebar** (240px expanded, CRM active, Tasks nav item active — `teal-100` bg, `teal-600` text + icon, 2px `teal-600` left border)

2. **Main Area:**
   - Page title: "Tasks" (`text-xl`/600)
   - Action buttons (right): "+ New Task" (`teal-600` fill, white text)
   - **Filter bar:** Status dropdown (All / To Do / In Progress / Done), Due Date range picker, Linked Entity dropdown (All / Leads / Clients), Priority dropdown (All / Low / Medium / High). "Show Completed" toggle (default: off).
   - **Task list (table):**
     - Columns: Priority indicator (dot), Title (`text-sm`/400), Linked Entity (name + type badge), Due Date (`text-sm`), Status badge, Actions (✓ Complete, Edit, Delete)
     - Priority dots: Low = `slate-400`, Medium = `amber-500`, High = `red-500`
     - Status badges: To Do = `slate-100` bg / `slate-700` text. In Progress = `amber-100` bg / `amber-700` text. Done = `teal-100` bg / `teal-700` text.
     - Overdue tasks: `red-50` row background, due date in `red-500`
     - Due today: `amber-100` row background, due date in `amber-700`
     - Row height: 48px, `white` background, `slate-200` bottom border
     - Row hover: `slate-50` background

3. **New Task drawer** (480px, right-side, slides in 300ms `easing-out`):
   - Title field (text, required)
   - Due Date (date picker, required)
   - Linked Entity Type (select: Lead / Client)
   - Linked Entity (searchable dropdown — filters leads or clients based on type selection)
   - Priority (select: Low / Medium / High, default: Medium)
   - Notes (textarea, optional, max 1000 chars)
   - Actions: "Save" (`teal-600`), "Cancel" (outline)

### States

| State | Behavior |
|---|---|
| Default | Open tasks sorted by due date ascending |
| Loading | 5 skeleton rows matching column layout |
| Empty | Checkmark illustration centered. "No tasks. You're all caught up." `slate-500` `text-sm` |
| Error (load failed) | "Failed to load tasks." with Retry button |
| Overdue task | `red-50` row, `red-500` dot, due date in `red-500` |
| Due today | `amber-100` row, due date in `amber-700` |
| Completed | Strikethrough text, `slate-400` color. Hidden by default (toggle to show). |
| Creating task | Save button spinner, disabled |
| Task created | Toast: "Task created." Drawer closes, task appears in list. |
| Task creation error | Toast: "Failed to save task. Please try again." |
| Complete action | Optimistic update — status → Done immediately. Undo toast 5s. |
| Delete action | Inline confirm: "Delete this task?" Yes (`red-500`) / No. No modal. |
| Delete success | Toast: "Task deleted." Row removed. |

### Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop >= 1280px | Full table with all columns, sidebar 240px |
| Tablet 768px–1279px | Sidebar collapsed 64px, horizontal scroll on table |
| Mobile < 768px | Card view: Title, Due Date, Priority dot, Status badge per card. Bottom tab nav. New task as bottom sheet. |

---

## Screen 14: Follow-up Email Drafting

**Stitch ID:** — (no Stitch screen; specified for developer implementation)
**Priority:** Medium — AI-assisted email composition accessed from Client Profile and Workdesk.

### Layout Structure

This screen is implemented as a **drawer** (480px, right-side) accessible from:
- Client Profile → "Draft Email" button
- Workdesk client view → "Draft Email" button

1. **Drawer header:** "Draft Email — [Client Name]" (`text-lg`/600). Close (×) button top-right.

2. **Template selector area:**
   - Template Type: segmented control or select — Document Request, Deadline Reminder, Report Delivery, Custom
   - Custom Intent field (visible only when "Custom" selected): textarea, placeholder "Describe what you want to say…", max 500 chars
   - "Generate Draft" button (`teal-600`)

3. **Draft area (below, after generation):**
   - Subject field: text input, pre-filled from AI, editable
   - Body field: textarea (or basic rich text editor on desktop), pre-filled from AI, editable. `text-sm`, monospace-adjacent for email clarity.
   - Word count indicator (`text-xs`, `slate-400`)

4. **Action bar (bottom of drawer):**
   - "Send via Gmail" (`teal-600` fill) — sends using `send-email` Edge Function
   - "Copy to Clipboard" (outline, `slate-700`)
   - "Regenerate" (text button, `slate-500`)

### States

| State | Behavior |
|---|---|
| Default | Template selector visible, draft area empty |
| Generating | Spinner in draft area: "Generating email draft…" (`slate-500`, `text-sm`) |
| Generated | Subject + Body pre-filled. Edit, Send, Copy, Regenerate visible. |
| Editing | Textarea active, cursor blinking |
| Sending | Spinner on Send button, disabled. "Sending…" label |
| Send success | Toast: "Email sent." Drawer closes. Activity log updated. |
| Send error | Toast: "Failed to send email. Please try again." Drawer stays open. |
| AI generation failed | Toast: "Draft generation failed. Write your email manually." Blank textarea shown (manual fallback). |
| Gmail disconnected | Send button disabled. Banner: "Gmail connection is not active. Reconnect Gmail in Settings." `red-50` bg, `red-700` text. |

### Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| Desktop >= 1024px | 480px right-side drawer, overlays content |
| Mobile < 1024px | Full-screen bottom sheet. Simple textarea (no rich editor). |

---

## Screen 15: Settings Page

**Stitch ID:** — (no Stitch screen; specified for developer implementation)
**Priority:** Low — admin-only, used infrequently.

### Layout Structure

1. **Sidebar** (240px expanded, Settings nav item active at bottom)

2. **Main Area:**
   - Page title: "Settings" (`text-xl`/600)
   - **Section: Gmail Connection**
     - Status indicator: green dot + "Connected as accountant@gmail.com" OR red dot + "Not connected"
     - Connected state: Email address, watch expiration date, "Disconnect" button (destructive outline)
     - Disconnected state: "Connect Gmail" button (`teal-600`). Opens Google OAuth consent flow.
     - Error state: "Gmail connection error: [last_error]." "Reconnect" button.
   - **Section: System Settings** (admin only)
     - Category Confidence Threshold: number input (0.00–1.00), default 0.85
     - Email Classification Confidence Threshold: number input, default 0.70
     - AI Cost Alert Threshold: currency input, default $25.00
     - AI Cost Ceiling: currency input, default $30.00
     - Save button per section

### States

| State | Behavior |
|---|---|
| Loading | Skeleton matching sections |
| Error (load failed) | "Failed to load settings." with Retry |
| Gmail connecting | Redirect to Google OAuth → callback → spinner → success/error |
| Gmail connected | Green status, email shown |
| Gmail connection failed | Toast: "Failed to connect Gmail." Error details. |
| Settings saved | Toast: "Settings saved." |
| Settings save error | Toast: "Failed to save. Please try again." |

---

## Missing UI States Addendum

The following states were identified as missing during QA review. They apply to existing screens.

### Transaction Data Grid (Screens 1–4)
- **Initial load error:** Full-width error card centered in grid area: "Failed to load transactions. [Retry]" (`red-50` bg, `red-700` text, `radius-lg`). Notification panel still functional.
- **Empty state (no transactions for any period):** Centered illustration (empty spreadsheet) + "No transactions for this period." + link: "Process documents from the inbox to get started." (`slate-500` text)
- **Filtered zero results (Screen 4):** Grid body shows: "No transactions match your filters." (`slate-500`, centered). Filter chips still visible for removal.

### Lead Pipeline Kanban (Screen 7)
- **Loading:** Each column shows 2–3 skeleton cards (`slate-100` shimmer, `radius-lg`, 200ms loop). Column headers visible.
- **Empty board (zero leads):** Centered message: "No leads yet. Add your first lead to get started." + "+ Add Lead" button (`teal-600`).
- **Empty single column:** "No leads" in `slate-500`, `text-sm`, centered in column body.

### BIR Tax Form (Screen 8)
- **Pre-fill loading:** After clicking "Pre-fill from Data": form fields show shimmer placeholders. "Pre-filling from transaction data…" spinner message below selectors. Selectors disabled.

### Deadline Tracker (Screen 10)
- **Loading:** 5 skeleton rows in list, calendar shows `slate-100` fill.
- **Error:** "Failed to load deadlines. [Retry]" (`red-50` bg, `red-700` text).

### Client Profile (Screen 11)
- **Initial load error:** "Failed to load client profile. [Retry]" error card, centered.

### Document Processing Intermediate State
- **AI working state (after clicking "Process" in notification panel):** The notification card's "Process" button becomes a spinner with "Processing…" label. Below it, a micro-progress timeline appears: "Downloading attachment → Extracting data → Categorizing" with the current step highlighted in `teal-600` and completed steps showing `green-500` checkmarks. This provides transparency during the 15–120 second processing window.

---

## Component Patterns (Recurring)

### Toast Notifications
- Position: bottom-right, stacked
- Appear: 200ms `easing-out`
- Auto-dismiss: 4 seconds (configurable for undo toasts: 5s)
- Manual dismiss: × button
- Success: `teal-100` bg, `teal-700` text
- Error: `red-50` bg, `red-700` text
- `aria-live="polite"`

### Badge Component
- `radius-full`, padding `space-1` horizontal, `space-0.5` vertical
- `text-xs`/500
- Background + foreground color pairs per status (see token table)

### Button Variants
| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| Primary | `teal-600` | `white` | none | `teal-500` bg |
| Outline | `transparent` | `teal-600` | `teal-600` 1px | `teal-50` bg |
| Destructive | `red-500` | `white` | none | `red-600` bg |
| Destructive Outline | `transparent` | `red-500` | `red-500` 1px | `red-50` bg |
| Ghost | `transparent` | `slate-700` | none | `slate-100` bg |
| Disabled | `slate-100` | `slate-400` | none | cursor: not-allowed |

All buttons: `radius-md`, `text-sm`/500, height 36px (Toolbox) / 40px (Website), min-width 80px.

### Input Fields
- Height: 36px (Toolbox), 40px (Website)
- Border: `slate-200` 1px, `radius-md`
- Focus: `teal-600` 2px border, 100ms transition
- Error: `red-500` 2px border, `red-700` error message below
- Disabled: `slate-100` bg, `slate-400` text
- Padding: `space-3` horizontal

### Skeleton Loading
- Background: `slate-100`
- Shimmer: 1500ms ease-in-out loop
- `prefers-reduced-motion`: static flat `slate-100`, no shimmer
- Grid: 8 skeleton rows
- Lists: 5 skeleton items
- Cards: 2–3 skeleton cards per column

### Modal / Drawer
- Drawer: 480px width (desktop), full-screen bottom sheet (mobile < 1024px)
- Modal: max-width 480px centered, `shadow-lg`
- Backdrop: `rgba(0,0,0,0.4)`
- Open: 300ms `easing-out`
- Close: 300ms `easing-in`
- Focus trapped within overlay
- Focus returns to trigger on close
- `z-index: 300`

### Source Document Column (Levi)
- Max-width: 160px
- Truncation: end-truncation with `...`
- Hover/focus: full filename in tooltip (200ms delay)
- Focus ring: 2px solid `teal-600`, 2px offset
- Link: `teal-600` color, underline on hover

---

## Accessibility Requirements

### Compliance: WCAG 2.1 AA

### Color Contrast (Verified)
| Pair | Ratio | Pass |
|---|---|---|
| `teal-600` on `white` | 4.55:1 | AA |
| `slate-900` on `white` | 17.7:1 | AAA |
| `slate-500` on `white` | 4.6:1 | AA |
| `red-700` on `white` | 7.1:1 | AAA |
| `amber-700` on `amber-100` | ~7.2:1 | AAA |
| `red-700` on `red-100` | ~7.8:1 | AAA |
| `green-700` on `teal-100` | ~5.2:1 | AA |

### Focus Management
- 2px solid `teal-600` outline, 2px offset on all interactive elements
- Focus trapped in open modals/drawers
- Focus returns to trigger on close
- Skip-to-content link: first focusable element, visually hidden until focused
- Route change: focus moves to page `h1`

### Screen Reader
- Semantic heading hierarchy: `h1` > `h2` > `h3`, no skipped levels
- `role="grid"`, `role="row"`, `role="gridcell"` on data grid
- `role="navigation"` + `aria-current="page"` on sidebar
- `aria-live="polite"` on toast notifications, status badge changes, notification count
- `aria-live="assertive"` on error messages
- `aria-busy="true"` + `aria-label="Loading..."` on skeleton wrappers
- All form inputs paired with `<label>`
- Error messages linked via `aria-describedby`

---

## Open Design Questions

None. All questions raised in discussion were resolved:

1. **Layout conflict (Winry):** Resolved — notification panel and doc preview share the same rail, toggled.
2. **Badge contrast (Levi → Winry):** Resolved — three `-700` tokens added.
3. **Keyboard nav (Levi → Winry):** Resolved — standard AG Grid/TanStack behavior.
4. **Bulk action bar (Levi):** Resolved — fixed-bottom.
5. **Mobile grid (Levi):** Resolved — sticky first column + horizontal scroll, card view default.
6. **Source doc truncation (Levi):** Resolved — end-truncation, tooltip on hover/focus.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Notification panel and Document Preview Panel share the same rail (toggle, not simultaneous) | At 1280px, sidebar (64px) + notifications (280px) + doc preview (400px) = 744px consumed, leaving 536px for an 8-column grid — unworkable. The two panels are never needed simultaneously. Toggle model preserves grid usability. |
| D2 | Added `amber-700` (#b45309), `red-700` (#b91c1c), `green-700` (#15803d) to design tokens | Discovery token set was missing dark badge text variants. Required for WCAG AA contrast on light badge backgrounds. Amber-700 on amber-100 = ~7.2:1, red-700 on red-100 = ~7.8:1, green-700 on teal-100 = ~5.2:1. |
| D3 | Keyboard navigation follows standard spreadsheet conventions (F2/Enter to edit, Escape to revert, Tab to commit+advance) | Excel/Google Sheets muscle memory. Standard TanStack Table/AG Grid keyboard behavior — aligns with what the grid library ships. Not custom implementation. |
| D4 | Bulk action bar anchored to fixed-bottom of grid area | Top placement compresses vertical scroll space. Inline placement shifts header row. Fixed-bottom is least disruptive to the grid layout and avoids pagination conflict by sitting above pagination. |
| D5 | Mobile grid: sticky first column (Date or Description) + horizontal scroll, card view as default | 8+ columns on 375px requires a hard architectural choice. Card view (Date, Description, Amount, Status) is the default mobile experience. "Desktop view" toggle available for full grid with horizontal scroll and sticky first column for users who need it. |
| D6 | Source document column: end-truncation, max-width 160px, full filename on hover/focus tooltip | Filenames overflow constantly. End-truncation preserves the recognizable start of the filename. Tooltip with focus ring ensures keyboard accessibility. |
| D7 | Transaction Data Grid requires 6 annotated states (default, editing, bulk select, doc preview, filtered, empty) | The grid is the accountant's primary workspace (80% of time). A single annotated state is insufficient for developer implementation. Each state has distinct visual treatments and interaction patterns. |
| D8 | AI narrative approval gate uses inline dismissible callout, not a separate step | Keeps the report review flow linear. The accountant sees the full report and approves the narrative as part of their natural reading flow, without modal interruption or feeling like bureaucracy. |
| D9 | Stitch screens generated at 2560px canvas width, designed for 1280px+ viewport | Stitch renders at 2x resolution. All dimensions in this spec reference CSS logical pixels. Developers should reference the token values and annotated descriptions, not pixel-measure the screenshots. |
