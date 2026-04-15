# Barker Build Plan — Numera Accounting Service

```yaml
# ============================================================
# BARKER BUILD PLAN — Numera Accounting Service
# ============================================================

project:
  name: "numera-accounting"
  description: "Web-based accounting platform with marketing site, CRM, and AI-powered Workdesk for a PH bookkeeping firm"
  working_directory: "."

# ------------------------------------------------------------
# INPUT FILES
# ------------------------------------------------------------
input_files:
  - path: "PRD-numera-accounting.md"
    alias: "prd"
    description: "Product requirements — features, user personas, state specs, acceptance criteria"
  - path: "TECH-SPEC-numera-accounting.md"
    alias: "tech-spec"
    description: "Technical specification — architecture, Supabase schema, AI pipeline, Gmail integration, monorepo structure"
  - path: "API-SPEC-numera-accounting.md"
    alias: "api-spec"
    description: "API contracts — PostgREST patterns, Edge Function endpoints, request/response schemas, error shapes"
  - path: "UI-DESIGN-numera-accounting.md"
    alias: "ui-design"
    description: "UI design — 15 screens, design tokens, component inventory, Stitch screen IDs"
  - path: "DISCOVERY.md"
    alias: "discovery"
    description: "Discovery brief — locked decisions, workflows, design system tokens"

# ============================================================
# PHASE 1 — FOUNDATION
# Scaffold monorepo, design tokens, shared UI, accessibility
# ============================================================
phases:
  - id: "phase-1"
    name: "Foundation"
    description: "Monorepo scaffolding, design tokens, shared UI components, accessibility primitives"
    phase_check: "pnpm run type-check"

    tasks:
      # --------------------------------------------------------
      - id: "p1-monorepo-scaffold"
        name: "Turborepo monorepo scaffolding"
        model: "sonnet"
        depends_on: []
        estimated_minutes: 10
        context_sources:
          - alias: "tech-spec"
            sections: ["4.3"]
          - alias: "discovery"
            sections: ["5"]
        prompt: |
          Initialize a Turborepo monorepo for the Numera accounting service.

          Create the following directory structure:
          ```
          accounting-service/
          ├── apps/
          │   ├── web/           # Marketing website (Next.js 14+ App Router)
          │   └── toolbox/       # CRM + Workdesk (Next.js 14+ App Router)
          ├── packages/
          │   ├── ui/            # Shared component library
          │   ├── db/            # Supabase client, types, schemas
          │   └── ai/            # AI pipeline library
          ├── supabase/
          │   ├── migrations/
          │   └── functions/
          ├── package.json
          ├── pnpm-workspace.yaml
          ├── turbo.json
          └── tsconfig.base.json
          ```

          Root package.json scripts: `"type-check": "turbo type-check"`, `"build": "turbo build"`, `"lint": "turbo lint"`, `"dev": "turbo dev"`.

          For each app (apps/web, apps/toolbox): initialize Next.js 14+ with App Router, TypeScript strict mode, Tailwind CSS, ESLint. Add `@numera/ui`, `@numera/db`, `@numera/ai` as workspace dependencies.

          For each package (packages/ui, packages/db, packages/ai): create package.json with `"name": "@numera/<name>"`, tsconfig.json extending the base, and a src/index.ts barrel export.

          turbo.json: define `build`, `type-check`, `lint`, `dev` pipelines. `build` depends on `^build`. `type-check` depends on `^type-check`.

          Use pnpm as package manager. TypeScript strict mode everywhere. Target ES2022.

          Create .env.example at root with placeholder keys: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
        expected_files:
          - "package.json"
          - "turbo.json"
          - "pnpm-workspace.yaml"
          - "tsconfig.base.json"
        done_check: "test -f package.json && test -f turbo.json && test -f pnpm-workspace.yaml"

      # --------------------------------------------------------
      - id: "p1-shared-tokens"
        name: "Shared Tailwind design tokens"
        model: "sonnet"
        depends_on: ["p1-monorepo-scaffold"]
        estimated_minutes: 10
        context_sources:
          - alias: "discovery"
            sections: ["9"]
          - alias: "ui-design"
            sections: ["Design System Tokens"]
        prompt: |
          Create the shared Tailwind CSS configuration at `packages/ui/tailwind.config.ts` with Numera's locked design tokens.

          Read the context for the complete token specification. Implement:

          **Colors:** Extend Tailwind's default palette with Numera-specific values:
          - slate: 50 (#f8fafc), 100 (#f1f5f9), 200 (#e2e8f0), 300 (#cbd5e1), 500 (#64748b), 700 (#334155), 900 (#0f172a), 950 (#020617)
          - teal: 100 (#ccfbf1), 500 (#14b8a6), 600 (#0d9488), 700 (#0f766e)
          - red: 50 (#fee2e2 — badge bg), 100 (#fee2e2), 500 (#ef4444), 700 (#b91c1c)
          - amber: 100 (#fef3c7), 500 (#f59e0b), 700 (#b45309)
          - green: 100 (#dcfce7), 500 (#22c55e), 700 (#15803d)

          **Typography:** Font family `Inter` (variable). Configure font weights 400, 500, 600, 700.

          **Spacing:** 4px base unit — space-1 (4px) through space-24 (96px).

          **Border radius:** Configure radius-sm, radius-md, radius-lg, radius-xl, radius-full as CSS custom properties (values differ per app — apps override via CSS variables).

          **Elevation:** shadow-xs, shadow-sm, shadow-md, shadow-lg with exact rgba values from the design tokens.

          **Motion:** duration-fast (100ms), duration-normal (200ms), duration-slow (300ms) with easing functions.

          **Breakpoints:** Add custom `3xl: '1440px'` breakpoint for wide layout.

          Export the config as the shared base. Both apps will extend this config.
        expected_files:
          - "packages/ui/tailwind.config.ts"
        done_check: "test -f packages/ui/tailwind.config.ts"

      # --------------------------------------------------------
      - id: "p1-web-tokens"
        name: "Website app token overrides"
        model: "sonnet"
        depends_on: ["p1-shared-tokens"]
        estimated_minutes: 5
        context_sources:
          - alias: "discovery"
            sections: ["9"]
        prompt: |
          Configure the marketing website app's Tailwind and CSS variable overrides.

          Read `packages/ui/tailwind.config.ts` for the shared base config.

          Create `apps/web/tailwind.config.ts` that extends the shared config. Add content paths for both `apps/web` and `packages/ui`.

          Create `apps/web/app/globals.css` with:
          - `@tailwind base; @tailwind components; @tailwind utilities;`
          - CSS custom properties for the Website variant:
            - `--background: #ffffff` (white, not slate-50)
            - `--foreground: #0f172a`
            - `--primary: #0d9488`
            - `--card: #ffffff`
            - `--muted: #f1f5f9`
            - `--muted-foreground: #64748b`
            - `--border: #e2e8f0`
            - `--destructive: #ef4444`
            - `--radius-sm: 6px` (website uses larger radii)
            - `--radius-md: 8px`
            - `--radius-lg: 12px`
            - `--radius-xl: 24px`
          - Base font size: 16px
          - Import Inter from Google Fonts via `@import` or `next/font`
        expected_files:
          - "apps/web/tailwind.config.ts"
          - "apps/web/app/globals.css"
        done_check: "test -f apps/web/tailwind.config.ts && test -f apps/web/app/globals.css"

      # --------------------------------------------------------
      - id: "p1-toolbox-tokens"
        name: "Toolbox app token overrides"
        model: "sonnet"
        depends_on: ["p1-shared-tokens"]
        estimated_minutes: 5
        context_sources:
          - alias: "discovery"
            sections: ["9"]
        prompt: |
          Configure the Toolbox app's Tailwind and CSS variable overrides.

          Read `packages/ui/tailwind.config.ts` for the shared base config.

          Create `apps/toolbox/tailwind.config.ts` that extends the shared config. Add content paths for both `apps/toolbox` and `packages/ui`.

          Create `apps/toolbox/app/globals.css` with:
          - `@tailwind base; @tailwind components; @tailwind utilities;`
          - CSS custom properties for the Toolbox variant:
            - `--background: #f8fafc` (slate-50)
            - `--foreground: #0f172a`
            - `--primary: #0d9488`
            - `--card: #ffffff`
            - `--muted: #f1f5f9`
            - `--muted-foreground: #64748b`
            - `--border: #e2e8f0`
            - `--destructive: #ef4444`
            - `--radius-sm: 4px` (toolbox uses tighter radii)
            - `--radius-md: 6px`
            - `--radius-lg: 8px`
            - `--radius-xl: 12px`
          - Base font size: 14px
          - Import Inter from Google Fonts
        expected_files:
          - "apps/toolbox/tailwind.config.ts"
          - "apps/toolbox/app/globals.css"
        done_check: "test -f apps/toolbox/tailwind.config.ts && test -f apps/toolbox/app/globals.css"

      # --------------------------------------------------------
      - id: "p1-a11y-primitives"
        name: "Accessibility primitives and utilities"
        model: "sonnet"
        depends_on: ["p1-shared-tokens"]
        estimated_minutes: 8
        context_sources:
          - alias: "ui-design"
            sections: ["Accessibility Requirements"]
          - alias: "prd"
            sections: ["11"]
        prompt: |
          Create foundational accessibility primitives in `packages/ui/` that all screen components will consume. These must exist before any screen-level task runs.

          Read the context for WCAG 2.1 AA requirements.

          Create `packages/ui/src/styles/accessibility.css`:
          - Focus ring utility class `.focus-ring`: `outline: 2px solid #0d9488; outline-offset: 2px;`
          - Tailwind plugin or utility: `focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2`
          - `prefers-reduced-motion: reduce` global reset: disable all transitions and animations
          - Skeleton shimmer: under reduced-motion, show static flat slate-100 (no animation)
          - `font-variant-numeric: tabular-nums` utility class `.tabular-nums`

          Create `packages/ui/src/components/skip-to-content.tsx`:
          - Visually hidden link that appears on focus
          - Text: "Skip to content"
          - Links to `#main-content`
          - Styled: `sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-teal-600`

          Create `packages/ui/src/lib/focus-trap.ts`:
          - Utility hook `useFocusTrap(ref)` for trapping focus within modals/drawers
          - Tab cycles within container; Escape calls onClose callback
          - Returns focus to trigger element on unmount

          Export all from `packages/ui/src/index.ts`.
        expected_files:
          - "packages/ui/src/styles/accessibility.css"
          - "packages/ui/src/components/skip-to-content.tsx"
          - "packages/ui/src/lib/focus-trap.ts"
        done_check: "test -f packages/ui/src/styles/accessibility.css && test -f packages/ui/src/components/skip-to-content.tsx"

      # --------------------------------------------------------
      - id: "p1-shared-ui-core"
        name: "Shared shadcn/ui component library"
        model: "sonnet"
        depends_on: ["p1-shared-tokens"]
        estimated_minutes: 15
        context_sources:
          - alias: "ui-design"
            sections: ["Component Patterns"]
        prompt: |
          Initialize shadcn/ui in `packages/ui/` and customize core components with Numera design tokens.

          Read `packages/ui/tailwind.config.ts` for the token configuration.

          Set up shadcn/ui with the following components in `packages/ui/src/components/`:
          - `button.tsx` — Variants: Primary (teal-600), Outline (teal-600 border), Destructive (red-500), Destructive Outline, Ghost (slate-700). All use `radius-md`. Height 36px (default, Toolbox) with a `size="lg"` variant at 40px (Website). Min-width 80px. Disabled: slate-100 bg, slate-400 text, cursor not-allowed.
          - `input.tsx` — Height 36px default. Border slate-200, focus: teal-600 2px, 100ms transition. Error: red-500 border. Disabled: slate-100 bg. Padding space-3 horizontal.
          - `badge.tsx` — radius-full, text-xs/500. Color pairs: Pending (amber-100/amber-700), Approved (teal-100/teal-700), Rejected (red-100/red-700), In Review (slate-100/slate-700), Completed (green-100/green-700).
          - `card.tsx` — White bg, radius-lg, shadow-xs at rest, shadow-sm on hover (200ms).
          - `toast.tsx` — Bottom-right positioned, stacked. Success: teal-100/teal-700. Error: red-50/red-700. Auto-dismiss 4s. aria-live="polite".
          - `dialog.tsx` — Max-width 480px centered, shadow-lg, backdrop rgba(0,0,0,0.4). Focus trapped.
          - `drawer.tsx` — 480px width desktop, full-screen bottom sheet mobile (<1024px). 300ms easing-out open, 300ms easing-in close. z-index 300.
          - `select.tsx` — Standard shadcn/ui select with Numera tokens.
          - `dropdown-menu.tsx` — Standard with shadow-md, radius-md.

          Export all components from `packages/ui/src/index.ts`.
        expected_files:
          - "packages/ui/src/components/button.tsx"
          - "packages/ui/src/components/badge.tsx"
          - "packages/ui/src/components/toast.tsx"
          - "packages/ui/src/components/drawer.tsx"
        done_check: "test -f packages/ui/src/components/button.tsx && test -f packages/ui/src/components/badge.tsx"

      # --------------------------------------------------------
      - id: "p1-data-table"
        name: "DataTable component — TanStack Table with virtual rows"
        model: "opus"
        depends_on: ["p1-shared-ui-core"]
        estimated_minutes: 25
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 1", "Screen 2", "Keyboard Navigation"]
          - alias: "prd"
            sections: ["Feature: Transaction Data Grid"]
        prompt: |
          Build a reusable DataTable component at `packages/ui/src/components/data-table.tsx` using TanStack Table v8 with `@tanstack/react-virtual` for row virtualization.

          Read `packages/ui/src/components/button.tsx` and `packages/ui/src/components/badge.tsx` for existing component patterns.

          Requirements:
          - Generic `<DataTable<T>>` component accepting column definitions and data
          - Virtual rows via `@tanstack/react-virtual` (render only visible rows)
          - `role="grid"`, `role="row"`, `role="gridcell"` semantic markup
          - Row height: 48px. Header: slate-50 bg, text-xs/500 uppercase slate-500
          - Row hover: slate-50 bg. Row border: slate-200 bottom
          - Column sorting: click header to toggle asc/desc, arrow indicator
          - Checkbox column for row selection (indeterminate header state)
          - Inline editing: click cell enters edit mode (teal-50 row bg, 2px teal-600 left border)
          - Keyboard navigation: Enter/F2 to edit, Escape to cancel, Tab to commit+advance, Shift+Tab backward, Arrow Up/Down to navigate rows, Space to toggle checkbox
          - Sticky first column on mobile (horizontal scroll)
          - Pagination footer: "Showing X of Y" left, page controls right

          Create `packages/ui/src/components/data-table-toolbar.tsx`:
          - Filter chips with × close button (slate-100 bg, slate-700 text)
          - "Clear all" text link

          Export from `packages/ui/src/index.ts`.

          Hardening requirements:
          - Debounce rapid keyboard events (50ms) to prevent double-commits
          - Escape always reverts to pre-edit value (never commits partial state)
          - Empty data: render centered empty state message slot
          - Loading: render skeleton rows (8 rows) matching column layout
          - Error: render centered error message with retry button slot
        expected_files:
          - "packages/ui/src/components/data-table.tsx"
          - "packages/ui/src/components/data-table-toolbar.tsx"
        done_check: "test -f packages/ui/src/components/data-table.tsx"

  # ============================================================
  # PHASE 2 — DATABASE
  # Supabase schema, migrations, seed data, types
  # ============================================================
  - id: "phase-2"
    name: "Database"
    description: "PostgreSQL schema via Supabase migrations, seed data, generated types, Zod validation schemas"

    tasks:
      # --------------------------------------------------------
      - id: "p2-schema-auth-crm"
        name: "Schema — users, leads, clients, gmail_connections"
        model: "opus"
        depends_on: ["p1-monorepo-scaffold"]
        estimated_minutes: 20
        context_sources:
          - alias: "tech-spec"
            sections: ["4.4"]
          - alias: "prd"
            sections: ["8"]
        prompt: |
          Create Supabase SQL migration files for the CRM-related tables. Read the context for exact column definitions, constraints, and indexes.

          Create `supabase/migrations/001_create_users.sql`:
          - `users` table extending `auth.users` with `full_name`, `role` (CHECK 'admin'/'accountant'), timestamps

          Create `supabase/migrations/002_create_leads.sql`:
          - `leads` table: business_name, contact_name, contact_email, contact_phone, source (CHECK enum), stage (CHECK 7-value enum), close_reason, notes, created_by FK, timestamps
          - `lead_activity_log` table: lead_id FK CASCADE, action, details JSONB, performed_by FK, timestamps
          - Indexes: idx_leads_stage, idx_leads_created_at DESC, idx_leads_source, idx_lead_activity_lead_id composite

          Create `supabase/migrations/003_create_clients.sql`:
          - `clients` table: business_name, business_type CHECK, tin CHECK regex, registered_address, industry, bir_registration_type CHECK, fiscal_year_start_month CHECK 1-12, gmail_address UNIQUE, monthly_revenue_bracket CHECK, google_sheet_folder_url, status CHECK, converted_from_lead_id FK, timestamps
          - `gmail_connections` table: user_id FK, gmail_email UNIQUE, encrypted token fields, watch fields, status CHECK, last_error, timestamps
          - `client_activity_log` table: client_id FK CASCADE, action, details JSONB, performed_by FK, timestamps
          - All indexes per spec

          All monetary values use `numeric(15,2)`. All IDs use `uuid` with `gen_random_uuid()`. All timestamps use `timestamptz`.

          Hardening requirements:
          - All NOT NULL constraints per spec — no nullable columns unless explicitly nullable
          - CHECK constraints for all enum fields with exact allowed values
          - TIN regex constraint: `'^\d{3}-\d{3}-\d{3}(-\d{3})?$'`
          - ON DELETE RESTRICT for financial data FKs, CASCADE for logs
          - Unique constraint on gmail_connections.gmail_email
        expected_files:
          - "supabase/migrations/001_create_users.sql"
          - "supabase/migrations/002_create_leads.sql"
          - "supabase/migrations/003_create_clients.sql"
        done_check: "test -f supabase/migrations/001_create_users.sql && test -f supabase/migrations/003_create_clients.sql"

      # --------------------------------------------------------
      - id: "p2-schema-financial"
        name: "Schema — chart of accounts, email notifications, transactions, invoices"
        model: "opus"
        depends_on: ["p2-schema-auth-crm"]
        estimated_minutes: 20
        context_sources:
          - alias: "tech-spec"
            sections: ["4.4"]
          - alias: "api-spec"
            sections: ["12"]
        prompt: |
          Create Supabase SQL migration files for financial data tables. Read the context for exact schemas.

          Create `supabase/migrations/004_create_chart_of_accounts.sql`:
          - `chart_of_accounts`: code UNIQUE, name, account_type CHECK (5 types), parent_code self-FK, normal_balance CHECK, is_active, display_order, description, timestamps
          - Indexes: idx_coa_code, idx_coa_account_type, idx_coa_parent_code

          Create `supabase/migrations/005_create_email_notifications.sql`:
          - `email_notifications`: gmail_message_id UNIQUE, gmail_thread_id, client_id FK SET NULL, sender fields, subject, snippet, received_at, document_type_guess CHECK (7 types), classification_confidence CHECK 0-1, is_document, status CHECK (5 states), auto_dismissed, processing_error, processing_started_at, processed_by FK, timestamps
          - `document_attachments`: email_notification_id FK CASCADE, storage_path, original_filename, mime_type, file_size_bytes, page_count, timestamps
          - Indexes: partial index on status WHERE 'unprocessed', composite on client_id+received_at DESC

          Create `supabase/migrations/006_create_transactions.sql`:
          - `transactions`: client_id FK RESTRICT, date, description CHECK len<=255, amount numeric(15,2) CHECK >0, currency DEFAULT 'PHP', type CHECK, category_code FK, category_confidence, source FKs, status CHECK (5 states), approved_by FK, approved_at, rejection_reason, extraction_batch_id, extraction_page_number, timestamps
          - `ai_corrections`: transaction_id FK CASCADE, field_name, original_value, corrected_value, corrected_by FK, correction_source CHECK, timestamps
          - Indexes per spec including partial indexes for review queue

          Create `supabase/migrations/007_create_invoices.sql`:
          - `invoices`: invoice_number UNIQUE, client_id FK RESTRICT, subtotal, vat_amount, total_amount numeric(15,2), issue_date, due_date, status CHECK, sent_at, paid_at, gmail_message_id, notes, created_by FK, timestamps
          - `invoice_line_items`: invoice_id FK CASCADE, description, quantity numeric(10,2) CHECK >0, unit_price numeric(15,2) CHECK >=0, line_total GENERATED ALWAYS AS (quantity*unit_price) STORED, display_order, timestamps

          Hardening requirements:
          - `amount > 0` on transactions — direction via type field, not negative amounts
          - ON DELETE RESTRICT on transactions.client_id — never cascade-delete financial data
          - Partial indexes for performance: status WHERE IN ('pending','in_review','manual_entry_required')
          - UNIQUE on email_notifications.gmail_message_id for idempotency
        expected_files:
          - "supabase/migrations/004_create_chart_of_accounts.sql"
          - "supabase/migrations/005_create_email_notifications.sql"
          - "supabase/migrations/006_create_transactions.sql"
          - "supabase/migrations/007_create_invoices.sql"
        done_check: "test -f supabase/migrations/006_create_transactions.sql && test -f supabase/migrations/007_create_invoices.sql"

      # --------------------------------------------------------
      - id: "p2-schema-extended"
        name: "Schema — tasks, deadlines, reports, BIR templates, settings"
        model: "sonnet"
        depends_on: ["p2-schema-financial"]
        estimated_minutes: 15
        context_sources:
          - alias: "tech-spec"
            sections: ["4.4"]
        prompt: |
          Create Supabase SQL migration files for extended tables. Read the context for exact schemas.

          Create `supabase/migrations/008_create_tasks.sql`:
          - `tasks`: title, due_date, linked_entity_type CHECK ('lead','client'), linked_entity_id uuid, priority CHECK ('low','medium','high') DEFAULT 'medium', status CHECK ('todo','in_progress','done') DEFAULT 'todo', created_by FK, timestamps
          - Indexes: partial on status+due_date WHERE status != 'done', composite on linked_entity

          Create `supabase/migrations/009_create_deadlines.sql`:
          - `deadlines`: client_id FK CASCADE, deadline_type CHECK (6 types), due_date, period_label, status CHECK DEFAULT 'upcoming', completed_at, completed_by FK, notes, timestamps
          - UNIQUE index on (client_id, deadline_type, period_label) for idempotent generation
          - Index on due_date+status WHERE status != 'completed'

          Create `supabase/migrations/010_create_financial_reports.sql`:
          - `financial_reports`: client_id FK RESTRICT, report_type CHECK (8 types), period_start, period_end, ai_narrative, ai_narrative_approved DEFAULT false, ai_narrative_approved_by FK, ai_narrative_approved_at, exported_pdf_path, exported_sheets_url, generated_by FK, timestamps

          Create `supabase/migrations/011_create_bir_templates.sql`:
          - `bir_form_templates`: form_number, version, form_title, applicable_to text[], is_current boolean, template_layout JSONB, timestamps. Partial UNIQUE on form_number WHERE is_current=true.
          - `bir_form_field_mappings`: template_id FK CASCADE, field_code, field_label, mapping_type CHECK (5 types), mapping_expression JSONB, is_required, is_editable, display_order, section, timestamps
          - `bir_tax_form_records`: client_id FK RESTRICT, template_id FK, form_number, filing_period, status CHECK (4 states), prefill_data JSONB DEFAULT '{}', manual_overrides JSONB DEFAULT '{}', exported_pdf_path, timestamps

          Create `supabase/migrations/012_create_system_settings.sql`:
          - `system_settings`: key TEXT PK, value JSONB, description, updated_at, updated_by FK
        expected_files:
          - "supabase/migrations/008_create_tasks.sql"
          - "supabase/migrations/009_create_deadlines.sql"
          - "supabase/migrations/011_create_bir_templates.sql"
          - "supabase/migrations/012_create_system_settings.sql"
        done_check: "test -f supabase/migrations/009_create_deadlines.sql && test -f supabase/migrations/012_create_system_settings.sql"

      # --------------------------------------------------------
      - id: "p2-schema-policies"
        name: "Schema — RLS policies, triggers, draft_emails table"
        model: "opus"
        depends_on: ["p2-schema-extended"]
        estimated_minutes: 15
        context_sources:
          - alias: "tech-spec"
            sections: ["4.4", "6"]
        prompt: |
          Create Supabase SQL migration files for RLS policies, triggers, and the draft_emails table. Read the context for exact policy definitions.

          Create `supabase/migrations/013_create_rls_policies.sql`:
          Enable RLS on ALL tables. Define policies:
          - `users`: SELECT/UPDATE own row (auth.uid() = id). Admin can SELECT all.
          - `leads`, `clients`, `tasks`, `invoices`, `invoice_line_items`, `transactions`: All authenticated users CRUD. DELETE on transactions restricted to admin role.
          - `gmail_connections`, `system_settings`: Admin role only (SELECT/UPDATE).
          - `email_notifications`, `document_attachments`: All authenticated SELECT. INSERT/UPDATE via service role.
          - `lead_activity_log`, `client_activity_log`, `ai_corrections`: All authenticated SELECT. INSERT via service role or trigger.
          - `financial_reports`, `bir_tax_form_records`: All authenticated SELECT/INSERT. UPDATE for narrative approval.
          - `deadlines`: All authenticated CRUD.
          - `chart_of_accounts`, `bir_form_templates`, `bir_form_field_mappings`: All authenticated SELECT. Admin full CRUD.

          Create `supabase/migrations/014_create_triggers.sql`:
          - `set_updated_at` trigger function + triggers on all tables with updated_at
          - `fn_log_lead_created` + `trg_lead_created`: INSERT into lead_activity_log on leads INSERT
          - `fn_log_lead_updated` + `trg_lead_updated`: Log stage changes and field updates

          Create `supabase/migrations/015_create_draft_emails.sql`:
          - `draft_emails`: client_id FK CASCADE, deadline_id FK SET NULL, template_type, subject, body, status CHECK ('pending_review','approved','sent','discarded') DEFAULT 'pending_review', reviewed_by FK, sent_at, timestamps
          - Indexes: (client_id, deadline_id) for idempotency, status for filtering

          Hardening requirements:
          - RLS policies must fail closed — deny by default, allow explicitly
          - Admin role check: `(SELECT role FROM users WHERE id = auth.uid()) = 'admin'`
          - Service role policies use `auth.role() = 'service_role'`
          - Trigger functions use SECURITY DEFINER where needed for cross-table writes
        expected_files:
          - "supabase/migrations/013_create_rls_policies.sql"
          - "supabase/migrations/014_create_triggers.sql"
          - "supabase/migrations/015_create_draft_emails.sql"
        done_check: "test -f supabase/migrations/013_create_rls_policies.sql && test -f supabase/migrations/014_create_triggers.sql"

      # --------------------------------------------------------
      - id: "p2-seed-data"
        name: "Seed data — chart of accounts, BIR templates, system settings"
        model: "sonnet"
        depends_on: ["p2-schema-extended"]
        estimated_minutes: 10
        context_sources:
          - alias: "tech-spec"
            sections: ["4.4"]
          - alias: "api-spec"
            sections: ["6.3"]
        prompt: |
          Create seed migration files for initial data. Read the context for exact seed values.

          Create `supabase/migrations/016_seed_chart_of_accounts.sql`:
          Full Philippine SMB chart of accounts. INSERT all accounts from the tech spec seed data:
          - Assets (1000-1500): Cash and Cash Equivalents, Cash on Hand, Cash in Bank, Accounts Receivable, Inventory, Prepaid Expenses, Property and Equipment
          - Liabilities (2000-2600): Accounts Payable, Accrued Expenses, Output VAT Payable, Income Tax Payable, Withholding Tax Payable, Loans Payable
          - Equity (3000-3300): Owner's Capital, Retained Earnings, Owner's Withdrawals
          - Revenue (4000-4300): Service Revenue, Sales Revenue, Other Income
          - Expenses (5000-5990): Cost of Services, Salaries, Rent, Utilities, Office Supplies, Transportation, Professional Fees, Depreciation, Bank Charges, Interest, Miscellaneous
          Set parent_code, normal_balance, display_order for each.

          Create `supabase/migrations/017_seed_bir_templates.sql`:
          Insert initial BIR form templates for forms: 2551Q, 2550M, 2550Q, 1701, 1701Q, 1702, 1702Q, 1601-C, 1601-EQ, 0619-E, 0619-F.
          For each template: form_number, version ('2024-01'), form_title, applicable_to array, is_current=true, basic template_layout JSONB with section structure.
          Insert representative field mappings for 2550Q (Quarterly VAT Return) as the most complete example: TIN (client_field), registered_name (client_field), total_sales (sum_account_type revenue), output_vat (computed: total_sales * 0.12).

          Seed system_settings with defaults from the tech spec.
        expected_files:
          - "supabase/migrations/016_seed_chart_of_accounts.sql"
          - "supabase/migrations/017_seed_bir_templates.sql"
        done_check: "test -f supabase/migrations/016_seed_chart_of_accounts.sql && test -f supabase/migrations/017_seed_bir_templates.sql"

      # --------------------------------------------------------
      - id: "p2-rpc-functions"
        name: "Supabase RPC functions"
        model: "sonnet"
        depends_on: ["p2-schema-financial"]
        estimated_minutes: 8
        context_sources:
          - alias: "api-spec"
            sections: ["9"]
        prompt: |
          Create a migration file with PostgreSQL RPC functions exposed via PostgREST.

          Read the context for exact function signatures and SQL.

          Create `supabase/migrations/018_create_rpc_functions.sql`:

          Function `get_financial_summary(p_client_id uuid, p_period_start date, p_period_end date)`:
          - Returns JSON with total_revenue, total_expenses, transaction_count, pending_count, approved_count
          - Joins transactions with chart_of_accounts
          - Filters by client_id, date range, status='approved' for totals
          - LANGUAGE sql STABLE

          Function `get_correction_rates(p_days integer)`:
          - Returns table of field_name, corrections count, transactions_corrected count
          - Queries ai_corrections within lookback window
          - Groups by field_name, orders by corrections DESC
          - LANGUAGE sql STABLE
        expected_files:
          - "supabase/migrations/018_create_rpc_functions.sql"
        done_check: "test -f supabase/migrations/018_create_rpc_functions.sql"

      # --------------------------------------------------------
      - id: "p2-db-package"
        name: "Database package — Supabase client, types, Zod schemas"
        model: "sonnet"
        depends_on: ["p2-schema-policies"]
        estimated_minutes: 15
        context_sources:
          - alias: "tech-spec"
            sections: ["4.3"]
          - alias: "api-spec"
            sections: ["12", "13"]
          - alias: "prd"
            sections: ["8"]
        prompt: |
          Build the `packages/db/` package with Supabase client initialization, TypeScript types, and Zod validation schemas.

          Read `packages/db/package.json` for the existing package structure.

          Create `packages/db/src/client.ts`:
          - Export `createClient()` that initializes `@supabase/supabase-js` with env vars
          - Export `createServiceClient()` for Edge Functions (uses service role key)
          - Type the client with the generated Database type

          Create `packages/db/src/types.ts`:
          - TypeScript interfaces for all entities: Lead, Client, Transaction, EmailNotification, Invoice, InvoiceLineItem, Task, Deadline, FinancialReport, BIRTaxFormRecord, User
          - All enum types: LeadStage, LeadSource, TransactionStatus, TransactionType, AccountType, InvoiceStatus, TaskPriority, TaskStatus, DeadlineType, DeadlineStatus, ReportType, BIRFormNumber, etc.
          - Monetary amounts as `string` (decimal precision preserved)
          - Match exact field names and types from the PRD data structures section

          Create `packages/db/src/schemas.ts`:
          - Zod schemas for all Edge Function request bodies
          - UUID validation, email validation, ISO date validation
          - Amount format: `z.string().regex(/^\d{1,13}\.\d{2}$/)`
          - TIN format: `z.string().regex(/^\d{3}-\d{3}-\d{3}(-\d{3})?$/)`
          - Enum validations matching database CHECK constraints

          Export all from `packages/db/src/index.ts`.
        expected_files:
          - "packages/db/src/client.ts"
          - "packages/db/src/types.ts"
          - "packages/db/src/schemas.ts"
          - "packages/db/src/index.ts"
        done_check: "test -f packages/db/src/client.ts && test -f packages/db/src/types.ts && test -f packages/db/src/schemas.ts"

  # ============================================================
  # PHASE 3 — AUTH & LAYOUT
  # Supabase Auth, Toolbox shell, Website layout
  # ============================================================
  - id: "phase-3"
    name: "Auth & Layout"
    description: "Authentication, Toolbox sidebar navigation, Marketing website layout shell"
    phase_check: "pnpm run type-check"

    tasks:
      # --------------------------------------------------------
      - id: "p3-auth"
        name: "Supabase Auth — login, middleware, session management"
        model: "opus"
        depends_on: ["p2-db-package"]
        estimated_minutes: 15
        context_sources:
          - alias: "tech-spec"
            sections: ["6"]
          - alias: "api-spec"
            sections: ["2"]
        prompt: |
          Implement Supabase Auth for the Toolbox app. Read the context for auth requirements.

          Create `apps/toolbox/app/login/page.tsx`:
          - Email/password login form using shadcn/ui components from `@numera/ui`
          - Read `packages/ui/src/components/button.tsx` and `packages/ui/src/components/input.tsx`
          - "Sign In" primary button, error message display
          - Redirect to `/` on success

          Create `apps/toolbox/lib/supabase/middleware.ts`:
          - Next.js middleware that checks Supabase session on every request
          - Unauthenticated requests to any route except `/login` redirect to `/login`
          - Handles token refresh via `supabase.auth.getSession()`

          Create `apps/toolbox/lib/supabase/server.ts`:
          - Server-side Supabase client for Server Components and Route Handlers
          - Uses `createServerClient` from `@supabase/ssr`

          Create `apps/toolbox/lib/supabase/client.ts`:
          - Client-side Supabase client for Client Components
          - Uses `createBrowserClient` from `@supabase/ssr`

          Hardening requirements:
          - Fail closed: missing/expired session = redirect to /login, never show protected content
          - Access token stored in memory only; refresh token in httpOnly cookie (Supabase PKCE default)
          - Scrub JWT from error messages and logs
          - Rate-limit login attempts: disable submit for 5s after 3 consecutive failures (client-side)
          - Role check utility: `isAdmin(user)` reads `users.role` for Settings page protection
        expected_files:
          - "apps/toolbox/app/login/page.tsx"
          - "apps/toolbox/lib/supabase/middleware.ts"
          - "apps/toolbox/lib/supabase/server.ts"
          - "apps/toolbox/lib/supabase/client.ts"
        done_check: "test -f apps/toolbox/app/login/page.tsx && test -f apps/toolbox/lib/supabase/middleware.ts"

      # --------------------------------------------------------
      - id: "p3-toolbox-shell"
        name: "Toolbox shell — sidebar navigation and routing"
        model: "sonnet"
        depends_on: ["p1-shared-ui-core", "p1-toolbox-tokens", "p1-a11y-primitives"]
        estimated_minutes: 15
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 1", "Screen 7"]
          - alias: "prd"
            sections: ["Feature: Toolbox Shell"]
        prompt: |
          Build the Toolbox app shell with sidebar navigation and module routing.

          Read `packages/ui/src/components/` for available shared components.
          Read `apps/toolbox/app/globals.css` for Toolbox-specific tokens.

          Create `apps/toolbox/app/(toolbox)/layout.tsx`:
          - Root layout for authenticated Toolbox pages
          - Includes SkipToContent from `@numera/ui`
          - Renders Sidebar component + main content area with `id="main-content"`

          Create `apps/toolbox/app/(toolbox)/components/sidebar.tsx`:
          - Fixed left sidebar. 240px expanded / 64px collapsed. Toggle via button at bottom.
          - Module switcher at top: CRM tab, Workdesk tab
          - CRM active: show nav items — Pipeline, Clients, Tasks, Invoices
          - Workdesk active: show nav items — Transactions, Reports, Tax Prep, Deadlines
          - Active item: teal-100 bg, teal-600 text+icon, 2px teal-600 left border
          - Collapsed: icons only, tooltip on hover (200ms delay)
          - CRM defaults to 240px expanded; Workdesk defaults to 64px collapsed
          - Persist collapsed state per module in localStorage
          - User avatar/initials + sign-out at bottom
          - `role="navigation"`, `aria-current="page"` on active link
          - Icons from Lucide React (20px size)

          Create route stubs:
          - `apps/toolbox/app/(toolbox)/crm/pipeline/page.tsx` — placeholder
          - `apps/toolbox/app/(toolbox)/crm/clients/page.tsx` — placeholder
          - `apps/toolbox/app/(toolbox)/crm/tasks/page.tsx` — placeholder
          - `apps/toolbox/app/(toolbox)/crm/invoices/page.tsx` — placeholder
          - `apps/toolbox/app/(toolbox)/workdesk/page.tsx` — placeholder (transactions)
          - `apps/toolbox/app/(toolbox)/workdesk/reports/page.tsx` — placeholder
          - `apps/toolbox/app/(toolbox)/workdesk/tax-prep/page.tsx` — placeholder
          - `apps/toolbox/app/(toolbox)/workdesk/deadlines/page.tsx` — placeholder

          Responsive: Desktop ≥1280px always visible. Tablet: collapsed 64px. Mobile <768px: bottom tab bar with 44px touch targets.
        expected_files:
          - "apps/toolbox/app/(toolbox)/layout.tsx"
          - "apps/toolbox/app/(toolbox)/components/sidebar.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/layout.tsx && test -f apps/toolbox/app/(toolbox)/components/sidebar.tsx"

      # --------------------------------------------------------
      - id: "p3-web-layout"
        name: "Marketing website layout — nav bar and footer"
        model: "sonnet"
        depends_on: ["p1-shared-ui-core", "p1-web-tokens", "p1-a11y-primitives"]
        estimated_minutes: 10
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 5"]
          - alias: "prd"
            sections: ["Feature: Global Navigation Bar", "Feature: Footer"]
        prompt: |
          Build the marketing website layout with sticky nav and footer.

          Read `packages/ui/src/components/button.tsx` for shared button component.
          Read `apps/web/app/globals.css` for website-specific tokens.

          Create `apps/web/app/layout.tsx`:
          - Root layout with Inter font (next/font/google), SkipToContent, NavBar, Footer
          - SEO meta: title "Numera — Expert Bookkeeping and Tax Compliance for Philippine Businesses"
          - Max content width: 1200px centered

          Create `apps/web/app/components/nav-bar.tsx`:
          - Sticky to top. Transparent bg when scroll=0; white bg + shadow-xs when scroll>0 (200ms transition)
          - Left: Numera wordmark (teal-600 + slate-900)
          - Center-right: "Services", "How It Works", "Contact" anchor links (text-base/500, slate-700, hover teal-600)
          - Right: "Book a Call" button (teal-600 primary)
          - Mobile <768px: hamburger icon → full-width dropdown, body scroll locked, × close
          - `role="navigation"`

          Create `apps/web/app/components/footer.tsx`:
          - Full-width, slate-900 bg, white text
          - Numera wordmark, tagline, nav links (hover: underline + teal-400), contact email
          - "© 2026 Numera. All rights reserved." + Privacy Policy link
          - Responsive: desktop 2-3 columns, mobile single column
        expected_files:
          - "apps/web/app/layout.tsx"
          - "apps/web/app/components/nav-bar.tsx"
          - "apps/web/app/components/footer.tsx"
        done_check: "test -f apps/web/app/layout.tsx && test -f apps/web/app/components/nav-bar.tsx"

  # ============================================================
  # PHASE 4 — CRM MODULE
  # Lead pipeline, client profiles, tasks, invoicing
  # ============================================================
  - id: "phase-4"
    name: "CRM Module"
    description: "Lead pipeline kanban, client profiles, task tracker, billing and invoicing"

    tasks:
      # --------------------------------------------------------
      - id: "p4-lead-pipeline"
        name: "Lead pipeline — Kanban board"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 15
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 7"]
          - alias: "prd"
            sections: ["Feature: Lead Pipeline"]
        prompt: |
          Build the lead pipeline Kanban board at `apps/toolbox/app/(toolbox)/crm/pipeline/page.tsx`.

          Read `apps/toolbox/app/(toolbox)/components/sidebar.tsx` for the layout structure.
          Read `packages/db/src/types.ts` for Lead type and LeadStage enum.
          Read `packages/db/src/client.ts` for Supabase client.

          Page title: "Lead Pipeline" (text-xl/600). "Show Closed" toggle right of title. "+ Add Lead" button (teal-600 outline, right-aligned).

          Create `apps/toolbox/app/(toolbox)/crm/pipeline/components/kanban-board.tsx`:
          - 7 columns: Lead, Contacted, Call Booked, Proposal Sent, Negotiation, Closed Won, Closed Lost
          - Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable`
          - Closed Won/Lost collapsed by default; "Show Closed" toggle reveals them
          - Backward moves not allowed (drop returns card to origin)

          Create `apps/toolbox/app/(toolbox)/crm/pipeline/components/lead-card.tsx`:
          - Min-width 200px. Business name (text-sm/600), contact name (text-xs/slate-500), stage badge, date (text-xs/slate-400)
          - Calendar icon if stage=Call Booked. Click opens Lead Detail drawer.
          - shadow-xs rest, shadow-sm hover, shadow-md dragging (2deg rotation)

          Fetch leads via Supabase: `supabase.from('leads').select('*').order('updated_at', {ascending: false})`.

          Hardening requirements:
          - Loading: 2-3 skeleton cards per column
          - Empty board: "No leads yet. Add your first lead." + Add Lead button
          - Empty column: "No leads" in slate-500
          - Drag error: toast "Failed to update lead stage" + card snaps back
          - Closed Lost move: prompt dialog for close_reason (required)
          - prefers-reduced-motion: immediate reorder, no animation
        expected_files:
          - "apps/toolbox/app/(toolbox)/crm/pipeline/page.tsx"
          - "apps/toolbox/app/(toolbox)/crm/pipeline/components/kanban-board.tsx"
          - "apps/toolbox/app/(toolbox)/crm/pipeline/components/lead-card.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/crm/pipeline/page.tsx"

      # --------------------------------------------------------
      - id: "p4-lead-detail"
        name: "Lead detail drawer with activity log"
        model: "sonnet"
        depends_on: ["p4-lead-pipeline"]
        estimated_minutes: 12
        context_sources:
          - alias: "prd"
            sections: ["Feature: Lead Detail View"]
          - alias: "ui-design"
            sections: ["Screen 7"]
        prompt: |
          Build the lead detail drawer component.

          Read `apps/toolbox/app/(toolbox)/crm/pipeline/page.tsx` for the pipeline page structure.
          Read `packages/ui/src/components/drawer.tsx` for the drawer primitive.
          Read `packages/db/src/types.ts` for Lead and LeadStage types.

          Create `apps/toolbox/app/(toolbox)/crm/pipeline/components/lead-detail-drawer.tsx`:
          - Right-side drawer (480px desktop, full-screen bottom sheet mobile)
          - Fields: Business Name, Contact Name, Contact Email, Phone, Lead Source (select), Pipeline Stage (select), Notes (textarea max 10,000 chars)
          - Created At, Updated At (read-only)
          - Activity log at bottom: timestamped entries from `lead_activity_log` table, newest first
          - Actions: Save, Delete Lead (destructive, confirmation dialog), "Convert to Client" (only when stage=Closed Won)

          Fetch lead: `supabase.from('leads').select('*').eq('id', leadId).single()`.
          Fetch activity: `supabase.from('lead_activity_log').select('*, performed_by:users(full_name)').eq('lead_id', leadId).order('created_at', {ascending: false})`.

          Hardening requirements:
          - "Unsaved changes" indicator when fields modified
          - Navigate away warning: browser beforeunload if dirty
          - Delete: confirmation dialog "Delete this lead? This cannot be undone."
          - Convert to Client: confirmation → create Client record → navigate to Client Profile
          - Save error: toast, data preserved in form
          - Loading: skeleton matching form layout
          - Empty activity log: "No activity yet." in slate-500
        expected_files:
          - "apps/toolbox/app/(toolbox)/crm/pipeline/components/lead-detail-drawer.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/crm/pipeline/components/lead-detail-drawer.tsx"

      # --------------------------------------------------------
      - id: "p4-client-list"
        name: "Client list with search and pagination"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 10
        context_sources:
          - alias: "prd"
            sections: ["Feature: Client List"]
        prompt: |
          Build the client list page at `apps/toolbox/app/(toolbox)/crm/clients/page.tsx`.

          Read `packages/db/src/types.ts` for Client type.
          Read `packages/db/src/client.ts` for Supabase client.

          Table columns: Business Name, Business Type, BIR Registration (VAT/Non-VAT), Next Deadline (nearest upcoming), Status (Active/Inactive badge).
          Sortable by all columns. Search by name (ilike). Filter by business type, BIR registration.
          Click row → navigate to `/crm/clients/[id]`.
          Pagination: 50 per page, range-based via Supabase.

          Hardening requirements:
          - Loading: 5 skeleton rows
          - Empty: "No clients yet. Close a lead to add your first client."
          - Search no results: "No clients match your search."
          - Error: "Failed to load clients." + Retry button
          - Long business name: truncate 2 lines, tooltip on hover
        expected_files:
          - "apps/toolbox/app/(toolbox)/crm/clients/page.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/crm/clients/page.tsx"

      # --------------------------------------------------------
      - id: "p4-client-profile"
        name: "Client profile — view and edit"
        model: "sonnet"
        depends_on: ["p4-client-list"]
        estimated_minutes: 12
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 11"]
          - alias: "prd"
            sections: ["Feature: Client Profile"]
        prompt: |
          Build the client profile page at `apps/toolbox/app/(toolbox)/crm/clients/[id]/page.tsx`.

          Read `packages/db/src/types.ts` for Client type and enums.

          Two-column layout:
          Left — Identity: Business Name, Business Type (Sole Prop/OPC/Corporation), TIN (validated), Registered Address, Industry (predefined list), BIR Registration Type (VAT/Non-VAT), Fiscal Year Start Month.
          Right — Operational: Gmail Address, Monthly Revenue Bracket, Google Sheet Folder URL.
          Full-width below — Billing: invoice history table (Invoice #, Amount, Issue Date, Due Date, Status badge). Link to invoicing module.

          View mode default; "Edit Profile" button switches to edit mode. "Open in Workdesk" button (teal-600 fill).

          Hardening requirements:
          - TIN validation on blur: regex `###-###-###` or `###-###-###-###`
          - Gmail duplicate: error on save "This Gmail address is already registered"
          - Gmail change: warning modal about document intake reconfiguration
          - Missing required field on save: red border + error per field
          - Inactive client: slate-100 banner "This client is inactive."
          - Loading: skeleton matching profile layout
          - Error: "Failed to load client profile." + Retry
        expected_files:
          - "apps/toolbox/app/(toolbox)/crm/clients/[id]/page.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/crm/clients/[id]/page.tsx"

      # --------------------------------------------------------
      - id: "p4-task-tracker"
        name: "Task tracker — CRUD with filters"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 12
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 13"]
          - alias: "prd"
            sections: ["Feature: Task Tracker"]
        prompt: |
          Build the task tracker at `apps/toolbox/app/(toolbox)/crm/tasks/page.tsx`.

          Read `packages/db/src/types.ts` for Task, TaskPriority, TaskStatus types.

          Page title: "Tasks". "+ New Task" button (teal-600).
          Filter bar: Status dropdown, Due Date range, Linked Entity dropdown, Priority dropdown, "Show Completed" toggle (default off).

          Task table columns: Priority dot (Low=slate-400, Medium=amber-500, High=red-500), Title, Linked Entity (name + type badge), Due Date, Status badge, Actions (✓ Complete, Edit, Delete).
          Overdue: red-50 row bg, due date in red-500. Due today: amber-100 row bg, due date in amber-700.

          Create `apps/toolbox/app/(toolbox)/crm/tasks/components/new-task-drawer.tsx`:
          - 480px right-side drawer. Fields: Title (required), Due Date (required), Linked Entity Type (Lead/Client), Linked Entity (searchable dropdown), Priority (default Medium), Notes (textarea, max 1000 chars).

          Hardening requirements:
          - Loading: 5 skeleton rows
          - Empty: "No tasks. You're all caught up." + checkmark illustration
          - Complete action: optimistic update, undo toast 5s
          - Delete: inline confirm "Delete this task?" Yes/No, no modal
          - Save error: toast "Failed to save task."
          - Mobile: card view with Title, Due Date, Priority dot, Status badge
        expected_files:
          - "apps/toolbox/app/(toolbox)/crm/tasks/page.tsx"
          - "apps/toolbox/app/(toolbox)/crm/tasks/components/new-task-drawer.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/crm/tasks/page.tsx"

      # --------------------------------------------------------
      - id: "p4-invoice-creation"
        name: "Invoice creation form"
        model: "sonnet"
        depends_on: ["p4-client-profile"]
        estimated_minutes: 12
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 12"]
          - alias: "prd"
            sections: ["Feature: Billing"]
        prompt: |
          Build the invoice creation page at `apps/toolbox/app/(toolbox)/crm/invoices/new/page.tsx`.

          Read `packages/db/src/types.ts` for Invoice, InvoiceLineItem types.

          Client dropdown (pre-filled if navigated from client). Invoice # auto-generated: `INV-YYYY-####` (read-only, slate-100 bg).

          Line items table: Description (text), Qty (number), Unit Price (number), Line Total (calculated, read-only, right-aligned ₱XX,XXX.XX). "+ Add Line Item" below table. Min 1 line item required.

          Summary block (right-aligned): Subtotal, VAT 12% (auto for VAT-registered clients — check `client.bir_registration_type`), Grand Total (bold, text-lg).

          Due Date: date picker.

          Actions: "Save as Draft" (outline), "Preview" (teal-600 outline), "Send Invoice" (teal-600 fill — calls `send-invoice` Edge Function).

          All amounts use `font-variant-numeric: tabular-nums` and `₱` prefix formatting.

          Hardening requirements:
          - 0 line items on submit: blocked, error "Add at least one line item."
          - Amount = 0: warning shown, allowed
          - Sending: spinner, disabled button
          - Send success: status → Sent, toast "Invoice sent to [email]"
          - Gmail disconnected: error "Gmail connection is not active. Reconnect in Settings."
          - Client-side VAT calculation: subtotal * 0.12 for VAT clients
        expected_files:
          - "apps/toolbox/app/(toolbox)/crm/invoices/new/page.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/crm/invoices/new/page.tsx"

      # --------------------------------------------------------
      - id: "p4-invoice-list"
        name: "Invoice list with status tracking"
        model: "sonnet"
        depends_on: ["p4-invoice-creation"]
        estimated_minutes: 8
        context_sources:
          - alias: "prd"
            sections: ["Feature: Billing"]
          - alias: "api-spec"
            sections: ["5.2.8"]
        prompt: |
          Build the invoice list page at `apps/toolbox/app/(toolbox)/crm/invoices/page.tsx`.

          Read `packages/db/src/types.ts` for Invoice type and InvoiceStatus enum.

          Table columns: Invoice #, Client, Amount (₱ formatted), Issue Date, Due Date, Status badge.
          Status badges: Draft (slate-100/slate-700), Sent (teal-100/teal-700), Paid (green-100/green-700), Overdue (red-100/red-700).

          Overdue is derived client-side: `status === 'sent' && new Date(due_date) < new Date()`.

          "Mark as Paid" button on Sent invoices: confirmation dialog → update status to 'paid', paid_at to now().

          Fetch: `supabase.from('invoices').select('*, client:clients(business_name), line_items:invoice_line_items(*)').order('issue_date', {ascending: false})`.

          Hardening requirements:
          - Loading: 5 skeleton rows
          - Empty: "No invoices yet. Create your first invoice."
          - Error: "Failed to load invoices." + Retry
          - Mark as Paid: confirmation dialog, toast on success/error
        expected_files:
          - "apps/toolbox/app/(toolbox)/crm/invoices/page.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/crm/invoices/page.tsx"

  # ============================================================
  # PHASE 5 — WORKDESK CORE
  # Email notifications, transaction data grid, document preview
  # ============================================================
  - id: "phase-5"
    name: "Workdesk Core"
    description: "Email notification panel, transaction data grid, document preview panel"

    tasks:
      # --------------------------------------------------------
      - id: "p5-notification-panel"
        name: "Email notification panel with realtime"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 12
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 1"]
          - alias: "prd"
            sections: ["Feature: Email Notification Panel"]
          - alias: "api-spec"
            sections: ["7"]
        prompt: |
          Build the Workdesk email notification panel.

          Read `apps/toolbox/app/(toolbox)/components/sidebar.tsx` for sidebar structure.
          Read `packages/db/src/types.ts` for EmailNotification type.

          Create `apps/toolbox/app/(toolbox)/workdesk/components/notification-panel.tsx`:
          - 280px wide panel adjacent to sidebar. Header: "NOTIFICATIONS" (slate-500 text-xs uppercase tracking-wide).
          - Vertical stack of notification cards. Each card:
            - Client name (text-sm/600), email subject (truncated 60 chars, tooltip for full), date received (text-xs slate-400)
            - Document type badge (teal-100/teal-700, radius-full, text-xs)
            - "Process" button (teal-600 fill, full card width)
          - Badge count on Workdesk nav icon via Supabase Realtime subscription

          Realtime subscription:
          ```typescript
          supabase.channel('email-notifications')
            .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'email_notifications', filter: 'status=eq.unprocessed'}, callback)
            .subscribe()
          ```

          Fetch: `supabase.from('email_notifications').select('*, client:clients(business_name), attachments:document_attachments(id, original_filename, mime_type)').eq('status', 'unprocessed').order('received_at', {ascending: false})`.

          Process button: calls `supabase.functions.invoke('process-document', {body: {notificationId}})`.

          Hardening requirements:
          - Loading: 3 skeleton notification items
          - Empty: "No new documents. You're up to date." + envelope illustration
          - Processing: button → spinner + "Processing…" label, disabled
          - Process error: toast "Failed to process document."
          - Already processing guard: button disabled after first click
          - Unknown sender: "Unknown sender" label, warning icon
          - Cleanup subscription on unmount
        expected_files:
          - "apps/toolbox/app/(toolbox)/workdesk/components/notification-panel.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/workdesk/components/notification-panel.tsx"

      # --------------------------------------------------------
      - id: "p5-transaction-grid"
        name: "Transaction data grid — review, edit, approve"
        model: "opus"
        depends_on: ["p1-data-table", "p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 25
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 1", "Screen 2", "Screen 4"]
          - alias: "prd"
            sections: ["Feature: Transaction Data Grid"]
          - alias: "api-spec"
            sections: ["5.2.4", "5.2.5", "5.2.6"]
        prompt: |
          Build the main Workdesk transaction grid page at `apps/toolbox/app/(toolbox)/workdesk/page.tsx`.

          Read `packages/ui/src/components/data-table.tsx` for the DataTable component.
          Read `packages/db/src/types.ts` for Transaction type and related enums.

          Three-pane layout: sidebar (64px) + notification panel (280px, imported) + main grid area.

          Main grid area contains:
          - Top bar: "Workdesk" title (text-xl/600) + search field
          - Filter bar: Date range picker (default current month), Category dropdown, Status dropdown, Client dropdown. Active filters show as chips with × close.
          - Action bar: "Export" button (outline), "+ New Entry" button (teal-600)
          - DataTable with columns: Checkbox | Date | Description | Amount (PHP) | Type | Category | Client | Source | Status

          Column specifics:
          - Amount: right-aligned, tabular-nums, formatted ₱XX,XXX.XX
          - Type: "Debit" in red-500, "Credit" in green-500
          - Source: document link icon (clickable, opens doc preview)
          - Status: Pending (amber-100/amber-700), Approved (teal-100/teal-700), Rejected (red-100/red-700), In Review (slate-100/slate-700)

          Inline editing: click cell enters edit mode per DataTable component behavior.
          Row actions: Approve (✓) with optimistic update + 5s undo toast, Reject (×) with reason dialog.
          Bulk actions: checkbox select, "Approve Selected"/"Reject Selected" bar fixed to bottom.

          Category "?" indicator: when category_confidence < 0.85 or null, show amber indicator. Click invokes `suggest-category` Edge Function.

          Fetch: per API spec section 5.2.4 query pattern with client_id, date range, pagination.

          Realtime: subscribe to transactions INSERT/UPDATE for live grid refresh.

          Hardening requirements:
          - Loading: 8 skeleton rows
          - Empty: "No transactions for this period." + link to process documents
          - Error: "Failed to load transactions." + Retry
          - Edit save error: toast + row reverts to original
          - Bulk approve partial failure: "X approved, Y failed. See highlighted rows."
          - Category changed after approval: status reverts to In Review
          - AI correction tracking: on category edit, INSERT into ai_corrections before updating transaction
        expected_files:
          - "apps/toolbox/app/(toolbox)/workdesk/page.tsx"
          - "apps/toolbox/app/(toolbox)/workdesk/components/transaction-columns.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/workdesk/page.tsx"

      # --------------------------------------------------------
      - id: "p5-doc-preview"
        name: "Document preview panel"
        model: "sonnet"
        depends_on: ["p5-transaction-grid"]
        estimated_minutes: 10
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 3"]
          - alias: "prd"
            sections: ["Feature: Document Preview Panel"]
        prompt: |
          Build the document preview panel for the Workdesk.

          Read `apps/toolbox/app/(toolbox)/workdesk/page.tsx` for the grid page structure.

          Create `apps/toolbox/app/(toolbox)/workdesk/components/doc-preview-panel.tsx`:
          - 400px right-side panel, slides in from right (300ms easing-out)
          - Shares the right rail with notification panel (toggle — never both visible simultaneously)
          - Close button (× icon, top-right)
          - Email metadata: From, Subject, Date received (text-sm, slate-700)
          - Document preview: PDF via browser native renderer, images displayed directly, scaled to panel width
          - Multi-page PDFs: "Previous | Page X of Y | Next" navigation
          - Panel bg: white, left border slate-200, shadow-lg

          Responsive:
          - Wide ≥1440px: grid and preview side by side
          - Desktop 1280-1439px: preview pushes grid to ~50% width
          - <1280px: preview opens as full-screen overlay with back button

          Document URL: fetch signed URL via `supabase.storage.from('documents').createSignedUrl(path, 3600)`.

          Hardening requirements:
          - Loading: skeleton rectangle in preview area
          - Document not found: "Document preview unavailable."
          - Unsupported file type: "Preview not available." + Download link
          - Close: 300ms easing-in slide out
        expected_files:
          - "apps/toolbox/app/(toolbox)/workdesk/components/doc-preview-panel.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/workdesk/components/doc-preview-panel.tsx"

  # ============================================================
  # PHASE 6 — AI PIPELINE
  # packages/ai, Edge Functions for Gmail, OCR, categorization
  # ============================================================
  - id: "phase-6"
    name: "AI Pipeline"
    description: "AI client library, Gmail webhook, document processing, transaction categorization, Gmail OAuth"

    tasks:
      # --------------------------------------------------------
      - id: "p6-ai-package"
        name: "AI pipeline library — prompts, validation, retry"
        model: "opus"
        depends_on: ["p2-db-package"]
        estimated_minutes: 20
        context_sources:
          - alias: "tech-spec"
            sections: ["4.3", "4.6"]
        prompt: |
          Build the `packages/ai/` library with Claude API client, prompt templates, response validation, and retry/fallback logic.

          Read `packages/db/src/types.ts` for Transaction, EmailNotification types.

          Create `packages/ai/src/client.ts`:
          - Initialize Anthropic SDK (`@anthropic-ai/sdk`)
          - Export typed wrapper functions with retry and timeout logic
          - Retry config: 3 attempts, exponential backoff (2s, 4s, 8s)
          - Timeout: configurable per function (default 30s)

          Create `packages/ai/src/prompts/classify-email.ts`:
          - `classifyEmail(input)` — Claude Haiku prompt for email classification
          - Input: sender, subject, snippet, attachmentNames, matchedClientId
          - Expected output schema: `{isDocument: boolean, documentType: string|null, confidence: number, reasoning: string}`
          - Zod validation on response. Malformed JSON → fail-open (return unprocessed notification)

          Create `packages/ai/src/prompts/extract-document.ts`:
          - `extractDocument(imageBase64, pageContext)` — Claude Vision prompt for OCR
          - Returns array of `{date, description, amount, type, vendor, pageNumber}`
          - Handles multi-page context: running balance, page range info

          Create `packages/ai/src/prompts/categorize-transaction.ts`:
          - `categorizeTransaction(input)` — Claude Haiku prompt for category assignment
          - Includes few-shot corrections from ai_corrections table
          - Returns `{categoryCode, confidence, reasoning}`

          Create `packages/ai/src/prompts/generate-narrative.ts`:
          - `generateNarrative(reportData)` — Claude Sonnet prompt for financial narrative

          Create `packages/ai/src/prompts/draft-email.ts`:
          - `draftEmail(clientContext, templateType, customIntent?)` — Claude Sonnet prompt

          Export all from `packages/ai/src/index.ts`.

          Hardening requirements:
          - All Claude responses validated against Zod schemas before use
          - API 429: exponential backoff (2s, 4s, 8s), max 3 retries
          - API 5xx: retry once, then fail with structured error
          - Timeout: configurable per function, kills request on exceed
          - Never log full prompt content (may contain PII from documents)
          - Zero-data-retention header set on all API calls
        expected_files:
          - "packages/ai/src/client.ts"
          - "packages/ai/src/prompts/classify-email.ts"
          - "packages/ai/src/prompts/extract-document.ts"
          - "packages/ai/src/prompts/categorize-transaction.ts"
        done_check: "test -f packages/ai/src/client.ts && test -f packages/ai/src/prompts/classify-email.ts"

      # --------------------------------------------------------
      - id: "p6-gmail-webhook"
        name: "Edge Functions — gmail-webhook + classify-email"
        model: "opus"
        depends_on: ["p6-ai-package"]
        estimated_minutes: 20
        context_sources:
          - alias: "api-spec"
            sections: ["6.13", "6.14"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the Gmail webhook and email classification Edge Functions.

          Read `packages/ai/src/prompts/classify-email.ts` for the classification function.
          Read `packages/db/src/client.ts` for `createServiceClient()`.

          Create `supabase/functions/gmail-webhook/index.ts`:
          - HTTP POST handler for Google Pub/Sub push notifications
          - Decode base64 `message.data` to get `{emailAddress, historyId}`
          - Look up `gmail_connections` by gmail_email
          - If no active connection or historyId <= watch_history_id → return 200 (idempotent no-op)
          - Call Gmail `history.list` from last watch_history_id
          - For each new message with attachments:
            a. Check email_notifications for existing gmail_message_id (idempotency)
            b. Match sender against clients.gmail_address
            c. Invoke classify-email internally
          - Update gmail_connections.watch_history_id
          - ALWAYS return 200 OK (Gmail retries on non-2xx)

          Create `supabase/functions/classify-email/index.ts`:
          - Internal function called by gmail-webhook (not client-callable)
          - Uses `classifyEmail()` from `@numera/ai`
          - If isDocument=true AND confidence >= threshold (default 0.70) → INSERT email_notifications status='unprocessed'
          - If isDocument=false OR confidence < threshold → INSERT status='dismissed', auto_dismissed=true
          - Read threshold from system_settings

          Hardening requirements:
          - Gmail webhook: verify Pub/Sub subscription name matches expected
          - Always return 200 — errors are logged, not surfaced to Pub/Sub
          - Idempotency: gmail_message_id UNIQUE catches duplicate deliveries
          - classify-email timeout → fail-open: create notification with document_type_guess=null, status=unprocessed
          - Decrypt Gmail tokens only at runtime, never cache decrypted values
          - History ID comparison: only process newer messages
        expected_files:
          - "supabase/functions/gmail-webhook/index.ts"
          - "supabase/functions/classify-email/index.ts"
        done_check: "test -f supabase/functions/gmail-webhook/index.ts && test -f supabase/functions/classify-email/index.ts"

      # --------------------------------------------------------
      - id: "p6-process-document"
        name: "Edge Function — process-document (OCR pipeline)"
        model: "opus"
        depends_on: ["p6-ai-package"]
        estimated_minutes: 25
        context_sources:
          - alias: "api-spec"
            sections: ["6.1"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the document processing Edge Function that orchestrates OCR extraction.

          Read `packages/ai/src/prompts/extract-document.ts` for Vision extraction.
          Read `packages/ai/src/prompts/categorize-transaction.ts` for categorization.
          Read `packages/db/src/client.ts` for `createServiceClient()`.
          Read `packages/db/src/schemas.ts` for request validation.

          Create `supabase/functions/process-document/index.ts`:
          - Auth: Supabase JWT required
          - Request: `{notificationId: uuid}` — validate with Zod
          - Flow:
            1. Verify notification status=unprocessed. If processing AND started <5min ago → 409
            2. Set status=processing, processing_started_at=now()
            3. Decrypt Gmail access token, fetch attachments
            4. Store each attachment in Supabase Storage: `documents/{client_id}/{year}/{filename}`
            5. Create document_attachments rows
            6. Process pages via Claude Vision (max 3 pages per API call, sequential batches)
            7. On Vision failure → fallback to Google Cloud Vision raw OCR → parse to structured format
            8. Multi-page merging: deduplicate boundary transactions (same date+amount+description with Levenshtein ≤ 3)
            9. For each extracted transaction → call categorize-transaction
            10. INSERT transactions. If confidence ≥ 0.85 → assign category. Else → category_code=null
            11. Set notification status=processed

          Response: `{success, data: {transactionsCreated, transactions[], documentsStored, pagesProcessed, extractionBatchId, warnings[]}}`

          Hardening requirements:
          - Concurrent processing guard: 409 if already processing within 5 min
          - Vision API failure: fallback to Google Cloud Vision
          - Both APIs fail: create transactions with status=manual_entry_required
          - File size validation: reject attachments >25MB
          - extraction_batch_id: UUID shared across all transactions from same document
          - Timeout: 120 seconds
          - Return structured error codes per API spec (400, 404, 409, 422, 500, 503)
        expected_files:
          - "supabase/functions/process-document/index.ts"
        done_check: "test -f supabase/functions/process-document/index.ts"

      # --------------------------------------------------------
      - id: "p6-categorize-transaction"
        name: "Edge Functions — categorize-transaction + suggest-category"
        model: "opus"
        depends_on: ["p6-ai-package"]
        estimated_minutes: 15
        context_sources:
          - alias: "api-spec"
            sections: ["6.11", "6.14"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the transaction categorization Edge Functions.

          Read `packages/ai/src/prompts/categorize-transaction.ts` for AI categorization.
          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/categorize-transaction/index.ts`:
          - Internal function (service role key, not client-callable)
          - Input: description, amount, type, clientIndustry, existingCategories, recentCorrections
          - Fetch chart_of_accounts (active only). Fetch up to 10 recent ai_corrections for the client.
          - Call categorizeTransaction() from @numera/ai with few-shot corrections
          - Return {categoryCode, confidence, reasoning}
          - Confidence threshold from system_settings (default 0.85)

          Create `supabase/functions/suggest-category/index.ts`:
          - Client-callable (Supabase Auth JWT)
          - Two input modes: (A) transactionId → fetch existing transaction, or (B) raw data {description, amount, type, clientId}
          - Validate with Zod: one of the two modes must be provided
          - Fetch client industry for context. Fetch recent corrections.
          - Call categorize-transaction logic
          - Return {suggestedCategoryCode, suggestedCategoryName, confidence, reasoning, alternatives[]}

          Hardening requirements:
          - Validate that transactionId exists (404 if not)
          - Validate that clientId exists (404 if not)
          - Claude API unavailable: 503 DEPENDENCY_UNAVAILABLE
          - Never expose raw AI reasoning in error messages
          - Timeout: 10 seconds
        expected_files:
          - "supabase/functions/categorize-transaction/index.ts"
          - "supabase/functions/suggest-category/index.ts"
        done_check: "test -f supabase/functions/categorize-transaction/index.ts && test -f supabase/functions/suggest-category/index.ts"

      # --------------------------------------------------------
      - id: "p6-connect-gmail"
        name: "Edge Function — connect-gmail (OAuth + encryption)"
        model: "opus"
        depends_on: ["p2-db-package"]
        estimated_minutes: 15
        context_sources:
          - alias: "api-spec"
            sections: ["6.8"]
          - alias: "tech-spec"
            sections: ["4.4", "6"]
        prompt: |
          Create the Gmail OAuth connection Edge Function.

          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/connect-gmail/index.ts`:
          - Auth: Supabase JWT, admin role only (verify via users.role)
          - Request: `{code: string}` — Google OAuth2 authorization code
          - Flow:
            1. Verify caller has admin role → 403 if not
            2. Exchange code for access_token + refresh_token via Google OAuth2 token endpoint
            3. Fetch Gmail address via gmail.users.getProfile()
            4. Encrypt both tokens with AES-256-GCM using key from env var (GMAIL_TOKEN_ENCRYPTION_KEY)
            5. INSERT/UPDATE gmail_connections with encrypted tokens, status=active
            6. Call gmail.users.watch() with configured Pub/Sub topic
            7. Store watch_history_id and watch_expiration
          - Response: {gmailEmail, connectionId, watchExpiration, status}

          Create `supabase/functions/_shared/encryption.ts`:
          - `encryptToken(plaintext, key)` → AES-256-GCM encrypted string (iv + ciphertext + tag, base64)
          - `decryptToken(encrypted, key)` → plaintext
          - Key from Deno.env.get('GMAIL_TOKEN_ENCRYPTION_KEY')

          Hardening requirements:
          - Admin-only: fail with 403 for non-admin users
          - OAuth code exchange failure (invalid/expired): 422 PROCESSING_FAILED
          - Google API unreachable: 503 DEPENDENCY_UNAVAILABLE
          - Never log decrypted tokens
          - Encryption key rotation: support reading old key from env if GMAIL_TOKEN_ENCRYPTION_KEY_OLD is set
          - Timeout: 15 seconds
        expected_files:
          - "supabase/functions/connect-gmail/index.ts"
          - "supabase/functions/_shared/encryption.ts"
        done_check: "test -f supabase/functions/connect-gmail/index.ts && test -f supabase/functions/_shared/encryption.ts"

  # ============================================================
  # PHASE 7 — REPORTS & TAX
  # Financial reports, BIR forms, deadline tracking
  # ============================================================
  - id: "phase-7"
    name: "Reports & Tax"
    description: "Financial report generation, BIR tax form preparation, deadline tracking"

    tasks:
      # --------------------------------------------------------
      - id: "p7-report-generator-ui"
        name: "Financial report generator UI"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 15
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 9"]
          - alias: "prd"
            sections: ["Feature: Financial Report Generator"]
        prompt: |
          Build the financial report generator page at `apps/toolbox/app/(toolbox)/workdesk/reports/page.tsx`.

          Read `packages/db/src/types.ts` for ReportType enum and FinancialReport type.

          Left panel (~30%): Report selection form.
          - Report Type dropdown: P&L, Balance Sheet, Cash Flow, Bank Reconciliation, AR Ageing, AP Ageing, General Ledger, Trial Balance
          - Client dropdown. Period dropdown (presets + Custom). "Generate" button (teal-600).
          - "Previous Reports" list below: date, type, export links. Empty: "No reports generated yet."

          Right panel (~70%): Report display.
          - Report header: type, client name, period
          - Formatted financial table: category groupings, amounts ₱XX,XXX.XX right-aligned tabular-nums, subtotals bold, grand total row slate-900 bg white text
          - AI Narrative section (for P&L and Balance Sheet):
            - Left border 4px teal-600, label "AI Summary — Review before sending to client" (text-xs slate-500 uppercase)
            - "Approve Narrative" (teal-600) + "Edit" (outline) buttons
            - Export buttons DISABLED until narrative approved (grayed, opacity-0.5)
            - Inline callout: "Approve the AI narrative to enable export." (amber-100/amber-700, dismissible)
          - Export: "Export PDF" (teal-600), "Export to Google Sheets" (outline)

          Calls `supabase.functions.invoke('generate-report', {body})` on Generate click.

          Hardening requirements:
          - Generating <5s: spinner "Generating report…"
          - Generating >3s: additional "This may take a moment."
          - Insufficient data: "Not enough approved transactions."
          - Empty period: "No transactions found."
          - Export PDF: browser download. Export Sheets: new tab + toast.
          - No Sheets folder: toast error
        expected_files:
          - "apps/toolbox/app/(toolbox)/workdesk/reports/page.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/workdesk/reports/page.tsx"

      # --------------------------------------------------------
      - id: "p7-generate-report"
        name: "Edge Function — generate-report (SQL + AI narrative)"
        model: "opus"
        depends_on: ["p6-ai-package", "p2-rpc-functions"]
        estimated_minutes: 25
        context_sources:
          - alias: "api-spec"
            sections: ["6.2"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the report generation Edge Function with SQL aggregation for all 8 report types.

          Read `packages/ai/src/prompts/generate-narrative.ts` for AI narrative generation.
          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/generate-report/index.ts`:
          - Auth: Supabase JWT
          - Request: `{clientId, reportType, periodStart, periodEnd}` — validate with Zod
          - SQL query per report type (all filter by client_id, date range, status=approved):

          **Profit & Loss:** Group transactions by revenue/expense account types. Calculate subtotals and net income.

          **Balance Sheet:** Sum asset/liability/equity accounts up to periodEnd (cumulative, not period-only). Calculate retained earnings from cumulative net income.

          **Trial Balance:** Sum debits and credits per account. Validate total_debits = total_credits. Include isBalanced flag and imbalance amount.

          **Cash Flow:** Group into Operating/Investing/Financing activities. Calculate net cash flow with opening/closing balance.

          **Bank Reconciliation:** Book balance vs bank balance with outstanding deposits/checks.

          **AR/AP Ageing:** Bucket outstanding invoices/payables into Current, 1-30, 31-60, 61-90, 90+ days.

          **General Ledger:** Per-account transaction detail with running balance.

          **AI Narrative:** For P&L and Balance Sheet only, call generateNarrative() from @numera/ai. Set aiNarrativeApproved=false.

          INSERT into financial_reports table. Return full report data with sections, totals, narrative.

          Hardening requirements:
          - Validate periodEnd >= periodStart (400 INVALID_INPUT)
          - Validate client exists (404)
          - Validate reportType is valid enum value
          - SQL injection prevention: parameterized queries only
          - AI narrative failure: return report without narrative (aiNarrative=null)
          - Trial balance imbalance: include in validationWarnings, don't block
          - Timeout: 30 seconds
        expected_files:
          - "supabase/functions/generate-report/index.ts"
        done_check: "test -f supabase/functions/generate-report/index.ts"

      # --------------------------------------------------------
      - id: "p7-bir-form-ui"
        name: "BIR tax form preparation UI"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 15
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 8"]
          - alias: "prd"
            sections: ["Feature: BIR Tax Form Preparation"]
        prompt: |
          Build the BIR tax form preparation page at `apps/toolbox/app/(toolbox)/workdesk/tax-prep/page.tsx`.

          Read `packages/db/src/types.ts` for BIRFormNumber, BIRTaxFormRecord types.

          Layout: Sidebar (64px collapsed) + Main form area (~65%) + Prior-year comparison sidebar (320px right).

          Top selectors: Form Type dropdown (2551Q, 2550M, 2550Q, 1701, 1701Q, 1702, 1702Q, 1601-C, 1601-EQ, 0619-E, 0619-F), Client dropdown, Filing Period dropdown. "Pre-fill from Data" button (teal-600).

          Form template rendering: structured sections with labeled fields.
          - Editable fields: teal-600 2px border, white bg
          - Read-only fields: slate-100 bg
          - Manual override fields: amber-100 bg (accountant changed pre-filled value)
          - Missing data: amber "?" indicator

          Prior-year sidebar (320px right): same field layout with prior year values, difference indicators (green up / red down with %).

          Export: "Export as PDF" button. Filename: `[FormNumber]-[ClientTIN]-[Period].pdf`.
          Stale template banner when applicable.

          Calls `supabase.functions.invoke('prefill-bir-form', {body})` on Pre-fill click.

          Hardening requirements:
          - Pre-fill loading: shimmer placeholders, selectors disabled
          - Form not applicable to client type: suggestion shown
          - Missing TIN: pre-fill blocked with error
          - Validation on export: required empty fields highlighted red-500
          - Prior-year data unavailable: "No prior-year data available."
          - Desktop ≥1280: form + sidebar side by side. Tablet: sidebar collapses. Mobile: read-only.
        expected_files:
          - "apps/toolbox/app/(toolbox)/workdesk/tax-prep/page.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/workdesk/tax-prep/page.tsx"

      # --------------------------------------------------------
      - id: "p7-prefill-bir-form"
        name: "Edge Function — prefill-bir-form"
        model: "opus"
        depends_on: ["p2-db-package"]
        estimated_minutes: 20
        context_sources:
          - alias: "api-spec"
            sections: ["6.3"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the BIR form pre-fill Edge Function with field mapping evaluation.

          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/prefill-bir-form/index.ts`:
          - Auth: Supabase JWT
          - Request: `{clientId, formNumber, filingPeriod}` — validate with Zod
          - Flow:
            1. Load bir_form_templates WHERE form_number AND is_current=true (404 if not found)
            2. Load all bir_form_field_mappings for the template
            3. Resolve filingPeriod to concrete dates: Q1-2026 → Jan 1 to Mar 31, YYYY-MM → month range, YYYY → fiscal year
            4. For each field mapping, evaluate based on mapping_type:
               - sum_category: SUM(amount) WHERE category_code IN codes AND type AND date range
               - sum_account_type: SUM WHERE account_type matches
               - computed: evaluate formula referencing other fields (topological sort for dependencies)
               - static: literal value
               - client_field: fetch from clients table (tin, business_name, etc.)
            5. Build prefill_data JSON: {field_code: computed_value}
            6. UPSERT bir_tax_form_records with status=prefill_complete

          Dependency resolution for computed fields:
          - Topologically sort fields by dependency
          - Evaluate non-computed first, then computed in order
          - Detect circular dependencies → 500 error

          Response per API spec: {recordId, formNumber, formTitle, filingPeriod, status, sections[], warnings[]}

          Hardening requirements:
          - Client not found: 404
          - No current template for form: 404
          - Circular dependency in field mappings: 500 with clear error
          - Missing transaction data for a field: include in warnings, don't block
          - All amounts as string with 2 decimal places
          - Timeout: 15 seconds
        expected_files:
          - "supabase/functions/prefill-bir-form/index.ts"
        done_check: "test -f supabase/functions/prefill-bir-form/index.ts"

      # --------------------------------------------------------
      - id: "p7-deadline-tracker-ui"
        name: "Deadline tracker UI — calendar and list"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 12
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 10"]
          - alias: "prd"
            sections: ["Feature: Deadline Tracker"]
        prompt: |
          Build the deadline tracker page at `apps/toolbox/app/(toolbox)/workdesk/deadlines/page.tsx`.

          Read `packages/db/src/types.ts` for Deadline, DeadlineType, DeadlineStatus types.

          Split layout: Left (65%) list view, Right (35%) calendar view.

          List view:
          - Page title: "Deadline Tracker" (text-xl/600)
          - View toggle tabs: List (active) | Calendar
          - Filter bar: Client, Deadline Type, Status dropdowns
          - Rows sorted by nearest due date: status dot (left), client name (text-sm/600), deadline type (text-sm/400 slate-700), due date (right-aligned), "Mark Complete" button (outline teal-600)
          - Overdue rows: red-50 bg, red-500 dot
          - Status dots: Upcoming >7d = slate-500, Approaching <7d = amber-500, In Progress = amber-500, Completed = green-500, Overdue = red-500

          Calendar view (right 35%): monthly calendar, colored dots on dates with deadlines, click date → popover.

          Hardening requirements:
          - Loading: 5 skeleton rows in list, calendar shows slate-100 fill
          - Empty: "No deadlines scheduled. Onboard a client to generate their deadline calendar."
          - Mark complete: optimistic update, undo toast 5s
          - Error: "Failed to load deadlines." + Retry
          - BIR deadline on weekend: flag "Note: falls on a weekend."
          - Inactive client deadlines: grayed with "Inactive client" note
          - Tablet/Mobile: list only; calendar via tab toggle
        expected_files:
          - "apps/toolbox/app/(toolbox)/workdesk/deadlines/page.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/workdesk/deadlines/page.tsx"

      # --------------------------------------------------------
      - id: "p7-deadline-edge-fns"
        name: "Edge Functions — deadline generation and cron"
        model: "opus"
        depends_on: ["p2-db-package"]
        estimated_minutes: 15
        context_sources:
          - alias: "api-spec"
            sections: ["6.10", "6.14"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the deadline generation Edge Functions.

          Read `packages/db/src/client.ts` for Supabase client.
          Read `packages/db/src/types.ts` for DeadlineType enum.

          Create `supabase/functions/generate-client-deadlines/index.ts`:
          - Auth: Supabase JWT
          - Request: `{clientId}` — validate with Zod
          - Load client's bir_registration_type and fiscal_year_start_month
          - Generate deadlines for next 12 months:
            - monthly_bookkeeping: all clients, 15th of following month
            - monthly_vat: VAT clients only, 20th of following month
            - quarterly_bir: per BIR schedule (25th of month after quarter end)
            - quarterly_financials: same schedule as quarterly_bir
            - annual_itr: April 15
            - annual_financials: April 15
          - INSERT with ON CONFLICT (client_id, deadline_type, period_label) DO NOTHING (idempotent)
          - Timeout: 10 seconds

          Create `supabase/functions/cron-generate-deadlines/index.ts`:
          - Schedule: January 1 each year (triggered by pg_cron)
          - Query all clients WHERE status=active
          - For each client, generate next 12 months of deadlines (same logic)
          - Idempotent via ON CONFLICT DO NOTHING

          Hardening requirements:
          - Client not found: 404
          - Idempotency: safe to call multiple times, no duplicates
          - Fiscal year handling: adjust quarterly/annual boundaries based on fiscal_year_start_month
          - VAT-specific deadlines only generated for VAT clients
          - Period labels: "January 2026", "Q1 2026", "FY 2026" format
        expected_files:
          - "supabase/functions/generate-client-deadlines/index.ts"
          - "supabase/functions/cron-generate-deadlines/index.ts"
        done_check: "test -f supabase/functions/generate-client-deadlines/index.ts && test -f supabase/functions/cron-generate-deadlines/index.ts"

  # ============================================================
  # PHASE 8 — EMAIL & EXPORT
  # PDF rendering, Sheets export, Gmail send, email drafting, crons
  # ============================================================
  - id: "phase-8"
    name: "Email & Export"
    description: "PDF generation, Google Sheets export, invoice/email sending, AI email drafting, Gmail cron jobs"

    tasks:
      # --------------------------------------------------------
      - id: "p8-render-pdf"
        name: "Edge Function — render-pdf"
        model: "opus"
        depends_on: ["p2-db-package"]
        estimated_minutes: 20
        context_sources:
          - alias: "api-spec"
            sections: ["6.4"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the PDF rendering Edge Function for reports, BIR forms, and invoices.

          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/render-pdf/index.ts`:
          - Auth: Supabase JWT
          - Request: `{type: 'report'|'bir_form'|'invoice', id: uuid}` — validate with Zod
          - Use `@react-pdf/renderer` (via npm: specifier for Deno) for React-based PDF layout

          PDF templates by type:
          - **Reports:** Professional financial report layout. Header (type, client, period), formatted tables with account groupings, subtotals bold, grand total row. AI narrative section OMITTED if ai_narrative_approved=false (server-side safety net).
          - **BIR Forms:** Structured form layout matching BIR template_layout JSONB. Precise field positioning. Pre-filled values displayed. Manual overrides shown.
          - **Invoices:** Professional invoice template. Invoice #, client details, line items table, subtotal, VAT line (if applicable), grand total. Numera branding.

          Storage: upload PDF to Supabase Storage at:
          - Reports: `exports/{client_id}/reports/{report_type}-{period}.pdf`
          - BIR: `exports/{client_id}/bir/{form_number}-{period}.pdf`
          - Invoices: `exports/{client_id}/invoices/{invoice_number}.pdf`

          Return: `{storagePath, signedUrl (1hr expiry), expiresAt, fileSizeBytes}`

          Hardening requirements:
          - Validate record exists (404 if not)
          - AI narrative gate for reports: omit narrative if not approved
          - PDF rendering failure: 422 PROCESSING_FAILED
          - All amounts formatted as ₱XX,XXX.XX with tabular-nums
          - Timeout: 30 seconds
          - Deno compatibility: if @react-pdf/renderer import fails, document fallback approach
        expected_files:
          - "supabase/functions/render-pdf/index.ts"
        done_check: "test -f supabase/functions/render-pdf/index.ts"

      # --------------------------------------------------------
      - id: "p8-export-sheets"
        name: "Edge Function — export-sheets"
        model: "sonnet"
        depends_on: ["p2-db-package"]
        estimated_minutes: 12
        context_sources:
          - alias: "api-spec"
            sections: ["6.5"]
        prompt: |
          Create the Google Sheets export Edge Function.

          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/export-sheets/index.ts`:
          - Auth: Supabase JWT
          - Request: `{type: 'transactions'|'report', clientId, periodStart, periodEnd, reportId?}` — validate
          - Flow:
            1. Fetch client's google_sheet_folder_url (422 if not configured)
            2. Create new spreadsheet via Google Sheets API v4 in client's folder
            3. Name: `{Type}-{ClientName}-{Period}-{timestamp}`
            4. Write headers and data rows
            5. Format: currency columns as `₱#,##0.00`, date columns as `YYYY-MM-DD`
            6. Return {spreadsheetUrl, spreadsheetId, title}

          Google Sheets API auth: use Google service account credentials from env vars.

          Hardening requirements:
          - Client not found: 404
          - No Sheets folder configured: 422 PROCESSING_FAILED
          - Google Sheets API unreachable: 503 DEPENDENCY_UNAVAILABLE
          - reportId required when type='report': 400 INVALID_INPUT
          - Timeout: 60 seconds
        expected_files:
          - "supabase/functions/export-sheets/index.ts"
        done_check: "test -f supabase/functions/export-sheets/index.ts"

      # --------------------------------------------------------
      - id: "p8-send-invoice"
        name: "Edge Function — send-invoice (PDF + Gmail)"
        model: "opus"
        depends_on: ["p6-connect-gmail", "p8-render-pdf"]
        estimated_minutes: 15
        context_sources:
          - alias: "api-spec"
            sections: ["6.6"]
        prompt: |
          Create the invoice sending Edge Function.

          Read `supabase/functions/_shared/encryption.ts` for token decryption.
          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/send-invoice/index.ts`:
          - Auth: Supabase JWT
          - Request: `{invoiceId: uuid}` — validate
          - Flow:
            1. Load invoice with client data and line items
            2. Validate status is 'draft' or 'sent' (re-send allowed)
            3. Render invoice PDF (call render-pdf logic or invoke the function)
            4. Compose email: subject "Invoice {invoice_number} from Numera", body template with amount summary
            5. Send via Gmail API using decrypted access token from gmail_connections
            6. Attach PDF to email
            7. UPDATE invoices: status='sent', sent_at=now(), gmail_message_id
            8. INSERT client_activity_log: action='invoice_sent'
            9. Return {gmailMessageId, sentTo, sentAt, invoiceNumber}

          Hardening requirements:
          - Invoice not found: 404
          - Gmail connection not active/expired: 503 with clear message
          - PDF rendering failure: 422
          - Gmail send failure: 503, do NOT update invoice status
          - Idempotency: re-sending a 'sent' invoice is allowed (re-attach, re-send)
          - Never log email body content
          - Timeout: 30 seconds
        expected_files:
          - "supabase/functions/send-invoice/index.ts"
        done_check: "test -f supabase/functions/send-invoice/index.ts"

      # --------------------------------------------------------
      - id: "p8-send-email"
        name: "Edge Function — send-email (general)"
        model: "sonnet"
        depends_on: ["p6-connect-gmail"]
        estimated_minutes: 10
        context_sources:
          - alias: "api-spec"
            sections: ["6.7"]
        prompt: |
          Create the general email sending Edge Function.

          Read `supabase/functions/_shared/encryption.ts` for token decryption.
          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/send-email/index.ts`:
          - Auth: Supabase JWT
          - Request: `{to, subject, body, clientId}` — validate with Zod
          - Validate: to (email format), subject (1-255 chars), body (1-5000 chars), clientId (uuid)
          - Decrypt Gmail access token from gmail_connections
          - Compose and send plain text email via Gmail API
          - INSERT client_activity_log: action='email_sent', details with subject, recipient, template_type
          - Return {gmailMessageId, sentTo, sentAt}

          Hardening requirements:
          - Client not found: 404
          - Gmail connection not active: 503
          - Invalid email format: 400 VALIDATION_FAILED
          - Subject/body length validation
          - Never log email body
          - Timeout: 15 seconds
        expected_files:
          - "supabase/functions/send-email/index.ts"
        done_check: "test -f supabase/functions/send-email/index.ts"

      # --------------------------------------------------------
      - id: "p8-draft-email"
        name: "Edge Function — draft-email (AI drafting)"
        model: "opus"
        depends_on: ["p6-ai-package"]
        estimated_minutes: 12
        context_sources:
          - alias: "api-spec"
            sections: ["6.9"]
        prompt: |
          Create the AI email drafting Edge Function.

          Read `packages/ai/src/prompts/draft-email.ts` for the AI drafting function.
          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/draft-email/index.ts`:
          - Auth: Supabase JWT
          - Request: `{clientId, templateType, customIntent?}` — validate
          - templateType: document_request, deadline_reminder, report_delivery, custom
          - customIntent required when templateType='custom' (max 500 chars)
          - Flow:
            1. Load client profile (business_name, industry, contact email)
            2. Load recent context: last emails to this client, pending deadlines, recent documents received
            3. Construct Claude Sonnet prompt with template type, client context, and custom intent
            4. Generate draft subject + body
            5. Return {subject, body, templateType, clientName}

          Hardening requirements:
          - Client not found: 404
          - customIntent missing when templateType='custom': 400 VALIDATION_FAILED
          - Claude API unavailable: 503 DEPENDENCY_UNAVAILABLE
          - AI generation failure: return error, let frontend show manual compose fallback
          - Never include sensitive client data (TIN, financial amounts) in the AI prompt context
          - Timeout: 15 seconds
        expected_files:
          - "supabase/functions/draft-email/index.ts"
        done_check: "test -f supabase/functions/draft-email/index.ts"

      # --------------------------------------------------------
      - id: "p8-email-draft-ui"
        name: "Follow-up email drafting drawer"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p2-db-package"]
        estimated_minutes: 10
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 14"]
          - alias: "prd"
            sections: ["Feature: Follow-up Email Drafting"]
        prompt: |
          Build the follow-up email drafting drawer component.

          Read `packages/ui/src/components/drawer.tsx` for the drawer primitive.

          Create `apps/toolbox/app/(toolbox)/components/email-draft-drawer.tsx`:
          - 480px right-side drawer. Header: "Draft Email — [Client Name]" (text-lg/600). Close × top-right.
          - Template selector: segmented control — Document Request, Deadline Reminder, Report Delivery, Custom
          - Custom Intent field (visible only when Custom selected): textarea, placeholder "Describe what you want to say…", max 500 chars
          - "Generate Draft" button (teal-600)
          - Draft area (after generation): Subject input (editable), Body textarea (editable, text-sm). Word count indicator.
          - Actions: "Send via Gmail" (teal-600 fill), "Copy to Clipboard" (outline), "Regenerate" (text button)

          Calls `supabase.functions.invoke('draft-email', {body})` on Generate.
          Calls `supabase.functions.invoke('send-email', {body})` on Send.

          Hardening requirements:
          - Generating: spinner "Generating email draft…"
          - AI failure: toast "Draft generation failed. Write manually." + blank textarea
          - Sending: spinner on Send, disabled
          - Send success: toast "Email sent." Drawer closes.
          - Send error: toast "Failed to send." Drawer stays open.
          - Gmail disconnected: Send disabled, banner "Gmail not active. Reconnect in Settings." red-50/red-700
          - Mobile <1024px: full-screen bottom sheet, simple textarea
        expected_files:
          - "apps/toolbox/app/(toolbox)/components/email-draft-drawer.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/components/email-draft-drawer.tsx"

      # --------------------------------------------------------
      - id: "p8-cron-gmail-watch"
        name: "Edge Function — cron-gmail-watch"
        model: "sonnet"
        depends_on: ["p6-connect-gmail"]
        estimated_minutes: 8
        context_sources:
          - alias: "api-spec"
            sections: ["6.14"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the Gmail watch renewal cron Edge Function.

          Read `supabase/functions/_shared/encryption.ts` for token decryption.
          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/cron-gmail-watch/index.ts`:
          - Schedule: every 6 days (1-day buffer before 7-day Gmail watch expiry)
          - Auth: service role key (cron-triggered)
          - Flow:
            1. Query gmail_connections WHERE status='active'
            2. For each connection:
               a. Decrypt refresh token
               b. If token_expires_at < now(), refresh access token via OAuth2
               c. Call gmail.users.watch() with Pub/Sub topic
               d. Update watch_expiration
            3. If token refresh fails (revoked): set status='revoked', log error
            4. If watch() fails but token valid: retry 3x with 60s intervals. All fail → status='error'

          Hardening requirements:
          - Never expose decrypted tokens in logs
          - Handle partial failures: continue processing remaining connections
          - Set last_error with descriptive message on failure
          - Idempotent: safe to run more frequently than every 6 days
        expected_files:
          - "supabase/functions/cron-gmail-watch/index.ts"
        done_check: "test -f supabase/functions/cron-gmail-watch/index.ts"

      # --------------------------------------------------------
      - id: "p8-cron-deadlines"
        name: "Edge Function — cron-check-approaching-deadlines"
        model: "opus"
        depends_on: ["p8-draft-email", "p7-deadline-edge-fns"]
        estimated_minutes: 15
        context_sources:
          - alias: "api-spec"
            sections: ["6.14"]
          - alias: "tech-spec"
            sections: ["4.6"]
        prompt: |
          Create the daily deadline checking cron Edge Function.

          Read `packages/db/src/client.ts` for Supabase client.

          Create `supabase/functions/cron-check-approaching-deadlines/index.ts`:
          - Schedule: daily at 08:00 PHT (triggered by pg_cron)
          - Auth: service role key
          - Flow:
            1. Query deadlines WHERE due_date <= now()+3 days AND due_date >= now() AND status != 'completed'
            2. For each approaching deadline:
               a. Check if deliverable received: query email_notifications for client in the relevant period
               b. Check draft_emails for existing draft matching (client_id, deadline_id) — skip if exists
               c. If no deliverable and no draft: invoke draft-email with templateType='deadline_reminder'
               d. Store draft in draft_emails with status='pending_review'
            3. For deadlines within 7 days: upsert into a deadline_notifications record for in-app banner
            4. Log summary: {deadlinesChecked, draftsGenerated, draftsSkipped, notificationsCreated}

          Hardening requirements:
          - Idempotency: check draft_emails before generating — safe to run multiple times per day
          - Draft email generation failure: log error, continue to next deadline
          - Handle partial failures gracefully — don't abort on single deadline error
          - Never auto-send emails — only create drafts for accountant review
          - Timeout: 30 seconds
        expected_files:
          - "supabase/functions/cron-check-approaching-deadlines/index.ts"
        done_check: "test -f supabase/functions/cron-check-approaching-deadlines/index.ts"

  # ============================================================
  # PHASE 9 — MARKETING WEBSITE
  # Homepage sections, contact form, Cal.com embed
  # ============================================================
  - id: "phase-9"
    name: "Marketing Website"
    description: "Homepage hero, services, how it works, contact form, Cal.com booking embed"
    phase_check: "pnpm run type-check"

    tasks:
      # --------------------------------------------------------
      - id: "p9-homepage-a"
        name: "Homepage — hero, services, how it works"
        model: "sonnet"
        depends_on: ["p3-web-layout"]
        estimated_minutes: 12
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 5", "Screen 6"]
          - alias: "prd"
            sections: ["Feature: Hero Section", "Feature: Services Section", "Feature: How It Works"]
        prompt: |
          Build the marketing homepage with static content sections.

          Read `apps/web/app/layout.tsx` for the website layout structure.
          Read `apps/web/app/globals.css` for website-specific tokens.

          Create `apps/web/app/page.tsx`:
          - SSR page composing all sections. Import Hero, ServicesSection, HowItWorks components.
          - Include placeholder imports for ContactForm and CalcomEmbed (built in next task).
          - SEO metadata via Next.js Metadata API.

          Create `apps/web/app/components/hero.tsx`:
          - Full viewport height, two columns (desktop). Max 1200px centered.
          - H1: "Expert Bookkeeping and Tax Compliance for Philippine Businesses" (48px/700)
          - Sub: "AI-powered accuracy. One accountant. The throughput of five." (text-xl/400 slate-700)
          - Primary CTA: "Book a Discovery Call" (teal-600 button, anchor to #booking)
          - Secondary CTA: "Send Us a Message" (teal-600 outline, anchor to #contact)
          - Right column: abstract illustration placeholder (decorative)
          - prefers-reduced-motion: no entrance animation
          - Mobile: single column, visual hidden, CTAs full-width

          Create `apps/web/app/components/services-section.tsx`:
          - "What We Handle For You" heading (30px/600 centered). id="services"
          - 3 cards: Bookkeeping (Monthly), Tax Compliance/BIR (Quarterly+Annual), Financial Reporting
          - Each: Lucide icon (24px teal-600), name (text-lg/600), 2-sentence description, frequency tag
          - shadow-xs rest, shadow-sm hover. Responsive: 3→2→1 columns.

          Create `apps/web/app/components/how-it-works.tsx`:
          - 4 numbered steps: Book a Call, Onboard, We Handle Books, You Receive Reports
          - Horizontal row with connecting line (desktop), vertical stack (mobile)
          - Number circles: teal-600 bg, white text, radius-full
        expected_files:
          - "apps/web/app/page.tsx"
          - "apps/web/app/components/hero.tsx"
          - "apps/web/app/components/services-section.tsx"
          - "apps/web/app/components/how-it-works.tsx"
        done_check: "test -f apps/web/app/page.tsx && test -f apps/web/app/components/hero.tsx"

      # --------------------------------------------------------
      - id: "p9-homepage-b"
        name: "Homepage — contact form and Cal.com embed"
        model: "sonnet"
        depends_on: ["p9-homepage-a"]
        estimated_minutes: 12
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 5"]
          - alias: "prd"
            sections: ["Feature: Contact Form", "Feature: Cal.com Booking Embed"]
        prompt: |
          Build the interactive homepage sections: contact form and Cal.com embed.

          Read `apps/web/app/page.tsx` for the homepage structure.
          Read `packages/ui/src/components/button.tsx` and `packages/ui/src/components/input.tsx`.

          Create `apps/web/app/components/contact-form.tsx`:
          - Section heading "Send Us a Message" (30px/600). id="contact"
          - Fields: Name (required), Email (required), Phone (optional, max 20 chars), Business Name (optional), Message (textarea, required, 10-1000 chars)
          - Hidden honeypot field `website` (CSS display:none)
          - Character counter at 800+ chars, red-500 at limit
          - Submit: "Send Message" (teal-600, full-width on mobile). Max field width 640px desktop.
          - Client-side Zod validation before submit
          - POST to `https://<SUPABASE_URL>/functions/v1/handle-contact-form`
          - Focus: border slate-200 → teal-600 (2px, 100ms). Error: red-500 border, red-700 text below, aria-describedby.
          - Submitting: spinner + "Sending…" + disabled. No double-submit.
          - Success: form hidden, teal-100 bg box, checkmark, "Your message was sent."
          - Error: banner above submit with fallback contact email. red-50/red-700.

          Create `apps/web/app/components/calcom-embed.tsx`:
          - Section heading "Book a Discovery Call". id="booking"
          - Cal.com widget inline (JavaScript embed), max-width 700px centered
          - Loading: skeleton placeholder (slate-100 radius-lg, ~600x500px)
          - Error fallback: "Booking temporarily unavailable. Use contact form." slate-700 on slate-50
          - Full-width on mobile

          Hardening requirements:
          - All required fields validated before submit
          - Honeypot: if `website` field non-empty, silently succeed (no network call)
          - Network failure: catch → error banner, no partial state
          - Message blocked at 1000 chars (textarea maxLength)
          - Cal.com script error: fallback message, no broken iframe
        expected_files:
          - "apps/web/app/components/contact-form.tsx"
          - "apps/web/app/components/calcom-embed.tsx"
        done_check: "test -f apps/web/app/components/contact-form.tsx && test -f apps/web/app/components/calcom-embed.tsx"

      # --------------------------------------------------------
      - id: "p9-handle-contact-form"
        name: "Edge Function — handle-contact-form"
        model: "sonnet"
        depends_on: ["p2-db-package"]
        estimated_minutes: 8
        context_sources:
          - alias: "api-spec"
            sections: ["6.12"]
        prompt: |
          Create the public contact form Edge Function.

          Read `packages/db/src/client.ts` for Supabase service client.

          Create `supabase/functions/handle-contact-form/index.ts`:
          - Auth: NONE (public endpoint)
          - CORS: Access-Control-Allow-Origin: https://numera.ph (exact, no wildcard)
          - Handle OPTIONS preflight with correct CORS headers
          - Request: `{name, email, phone?, businessName?, message, website}` — validate with Zod
          - Flow:
            1. If `website` non-empty → return 200 silently (honeypot caught)
            2. Validate: name required (1-100 chars), email valid format, phone max 20 chars, message 10-1000 chars
            3. Rate limit: 5 per IP per hour (implement via simple counter table or in-memory)
            4. INSERT leads: source='website_form', stage='lead', created_by=null, contact_phone from phone
            5. Return `{success: true}`

          Response: always 200 with `{success: true}` (prevent info leakage including honeypot catches).
          Validation errors: 400 with error details. Rate limit: 429.

          Hardening requirements:
          - CORS locked to numera.ph — no wildcard
          - Honeypot silently returns 200 (no indication to bot)
          - Rate limiting: 5 per IP per hour
          - Validate all inputs server-side (don't trust client validation)
          - Trim and normalize email (lowercase)
          - Strip extra fields from request body (allowlist)
        expected_files:
          - "supabase/functions/handle-contact-form/index.ts"
        done_check: "test -f supabase/functions/handle-contact-form/index.ts"

  # ============================================================
  # PHASE 10 — SETTINGS & INTEGRATION
  # Settings page, cross-module wiring
  # ============================================================
  - id: "phase-10"
    name: "Settings & Integration"
    description: "Admin settings page with Gmail connection management and system configuration"

    tasks:
      # --------------------------------------------------------
      - id: "p10-settings-page"
        name: "Settings page — Gmail connection and system settings"
        model: "sonnet"
        depends_on: ["p3-toolbox-shell", "p6-connect-gmail", "p2-db-package"]
        estimated_minutes: 12
        context_sources:
          - alias: "ui-design"
            sections: ["Screen 15"]
          - alias: "prd"
            sections: ["Feature: Toolbox Shell"]
        prompt: |
          Build the settings page at `apps/toolbox/app/(toolbox)/settings/page.tsx`.

          Read `apps/toolbox/app/(toolbox)/components/sidebar.tsx` for layout.
          Read `packages/db/src/types.ts` for SystemSettings type.

          Page title: "Settings" (text-xl/600). Admin-only (check user role, redirect if not admin).

          Section: Gmail Connection
          - Status indicator: green dot + "Connected as accountant@gmail.com" OR red dot + "Not connected"
          - Connected: email, watch expiration date, "Disconnect" button (destructive outline)
          - Disconnected: "Connect Gmail" button (teal-600) → opens Google OAuth consent flow
          - Error: "Gmail connection error: [last_error]" + "Reconnect" button

          Google OAuth flow: redirect to Google consent URL with required scopes (gmail.readonly, gmail.send, gmail.modify). Callback exchanges code via `connect-gmail` Edge Function.

          Section: System Settings (admin only)
          - Category Confidence Threshold: number input (0.00-1.00), default 0.85
          - Email Classification Confidence Threshold: number input, default 0.70
          - AI Cost Alert Threshold: currency input, default $25.00
          - AI Cost Ceiling: currency input, default $30.00
          - Save button per section

          Fetch settings: `supabase.from('system_settings').select('*')`.
          Fetch gmail: `supabase.from('gmail_connections').select('*').single()`.

          Hardening requirements:
          - Loading: skeleton matching sections
          - Error (load failed): "Failed to load settings." + Retry
          - Settings saved: toast "Settings saved."
          - Gmail connecting: redirect → callback → spinner → success/error
          - Non-admin access: redirect to Workdesk
        expected_files:
          - "apps/toolbox/app/(toolbox)/settings/page.tsx"
        done_check: "test -f apps/toolbox/app/(toolbox)/settings/page.tsx"

# ============================================================
# VALIDATION
# ============================================================
validation:
  checks:
    - "pnpm run build"
    - "pnpm run type-check"
    - "pnpm run lint"
  fix_budget: 5
  context_sources:
    - alias: "prd"
      sections: ["all"]
    - alias: "api-spec"
      sections: ["all"]
    - alias: "ui-design"
      sections: ["all"]
  prompt: |
    After fixing build/test/lint failures, perform a comprehensive hardening audit:

    1. **API Routes (Edge Functions):** Check every Edge Function for:
       - Zod input validation on all request bodies
       - Structured error responses matching the API spec error envelope ({error: {code, message, details, request_id}})
       - Correct HTTP status codes (400, 401, 403, 404, 409, 422, 429, 500, 503)
       - Auth checks (JWT for client-facing, service role for internal, none for public)
       - Timeout configuration per function

    2. **Database Layer:** Check all Supabase queries for:
       - Parameterized queries (no string interpolation in SQL)
       - Error handling for connection failures and missing records
       - Correct use of .single() vs .maybeSingle()
       - RLS policies don't accidentally expose data

    3. **Auth:** Check:
       - Middleware redirects unauthenticated users to /login
       - Admin-only routes check user role
       - Token refresh handling
       - No sensitive data in client-side logs

    4. **UI States:** Check every page/component for:
       - Loading state (skeleton or spinner)
       - Error state with retry
       - Empty state with helpful message
       - All interactive elements have visible focus ring (2px teal-600)
       - aria-live on dynamic content (toasts, badges, notification counts)
       - prefers-reduced-motion respected (no animations)

    5. **Financial Data:** Check:
       - All monetary amounts use string type (never floating-point number)
       - Amounts formatted as ₱XX,XXX.XX with tabular-nums
       - Supabase numeric(15,2) for all money columns
       - No precision loss in calculations

    6. **External Services:** Check:
       - Gmail API calls have explicit timeouts
       - Claude API calls have retry with backoff
       - Google Sheets API calls handle unavailability gracefully
       - All external service failures return 503 with DEPENDENCY_UNAVAILABLE code
```

---

## Summary

### Architecture

Numera is a Turborepo monorepo with 2 Next.js apps (marketing website + Toolbox CRM/Workdesk), 3 shared packages (ui, db, ai), and ~17 Supabase Edge Functions. The build plan decomposes this into **50 tasks across 10 phases**, with a **36% Opus / 64% Sonnet model split**.

### Phase Overview

| Phase | Name | Tasks | Opus | Sonnet | Purpose |
|-------|------|-------|------|--------|---------|
| 1 | Foundation | 7 | 1 | 6 | Monorepo, tokens, shared UI, accessibility |
| 2 | Database | 7 | 3 | 4 | Schema, migrations, seeds, types |
| 3 | Auth & Layout | 3 | 1 | 2 | Login, Toolbox shell, Website layout |
| 4 | CRM Module | 7 | 0 | 7 | Leads, clients, tasks, invoices |
| 5 | Workdesk Core | 3 | 1 | 2 | Notifications, transaction grid, doc preview |
| 6 | AI Pipeline | 5 | 5 | 0 | AI library, Gmail webhook, OCR, categorization |
| 7 | Reports & Tax | 6 | 3 | 3 | Reports, BIR forms, deadlines |
| 8 | Email & Export | 8 | 4 | 4 | PDF, Sheets, Gmail send, email drafting, crons |
| 9 | Marketing Website | 3 | 0 | 3 | Homepage, contact form, Cal.com |
| 10 | Settings | 1 | 0 | 1 | Gmail connection, system config |
| **Total** | | **50** | **18** | **32** | |

**Opus/Sonnet split: 36% / 64%** — within the 35-40% target.

### Dependency Graph (Critical Path)

```
p1-monorepo-scaffold
├── p1-shared-tokens
│   ├── p1-web-tokens ──────────────────────┐
│   ├── p1-toolbox-tokens ────────────────┐ │
│   ├── p1-a11y-primitives ─────────────┐ │ │
│   └── p1-shared-ui-core              │ │ │
│       └── p1-data-table               │ │ │
│                                       │ │ │
├── p2-schema-auth-crm                  │ │ │
│   └── p2-schema-financial             │ │ │
│       ├── p2-schema-extended          │ │ │
│       │   ├── p2-schema-policies      │ │ │
│       │   │   └── p2-db-package ──────┤ │ │
│       │   └── p2-seed-data            │ │ │
│       └── p2-rpc-functions            │ │ │
│                                       │ │ │
p3-auth ← p2-db-package                │ │ │
p3-toolbox-shell ← a11y + ui + toolbox─┘ │ │
p3-web-layout ← a11y + ui + web──────────┘ │
                                            │
Phase 4 (CRM): p3-toolbox-shell + p2-db-package
Phase 5 (Workdesk): p1-data-table + p3-toolbox-shell + p2-db-package
Phase 6 (AI): p2-db-package → p6-ai-package → Edge Functions
Phase 7 (Reports): p3-toolbox-shell + p6-ai-package + p2-db-package
Phase 8 (Email): p6-connect-gmail + p6-ai-package + p2-db-package
Phase 9 (Website): p3-web-layout + p2-db-package
Phase 10 (Settings): p3-toolbox-shell + p6-connect-gmail + p2-db-package
```

**Critical path:** p1-monorepo-scaffold → p1-shared-tokens → p1-shared-ui-core → p1-data-table → p5-transaction-grid (the accountant's primary workspace — 80% of usage).

### Model Assignment Rationale

| Task Category | Model | Rationale |
|--------------|-------|-----------|
| Database schema design | Opus | Financial data integrity, precise constraints, relational modeling |
| RLS policies & triggers | Opus | Security-critical, fail-closed design required |
| Auth flow | Opus | Session management, token handling, role enforcement |
| Transaction data grid | Opus | Most complex UI — virtual rows, keyboard nav, inline editing, bulk ops |
| DataTable component | Opus | Foundational grid with accessibility, virtual scrolling, edit semantics |
| AI pipeline library | Opus | Prompt engineering, structured output validation, retry/fallback |
| Gmail webhook | Opus | Pub/Sub handling, idempotency, async orchestration |
| Document processing | Opus | Multi-page OCR, Vision fallback, deduplication logic |
| Transaction categorization | Opus | Few-shot learning, confidence scoring, correction integration |
| Gmail OAuth | Opus | AES encryption, token lifecycle, security-critical |
| Report generation SQL | Opus | 8 report types, complex aggregation, AI narrative |
| BIR form pre-fill | Opus | Field mapping evaluation, dependency resolution, fiscal calendar |
| PDF rendering | Opus | Pixel-precise BIR forms, conditional narrative gate |
| Invoice sending | Opus | Multi-service orchestration (PDF → Gmail → status update) |
| AI email drafting | Opus | Context gathering, prompt construction, Claude integration |
| Deadline cron | Opus | Heuristic deliverable checking, auto-draft generation |
| All CRM UI pages | Sonnet | Standard CRUD patterns with well-defined specs |
| Marketing website | Sonnet | Static content, standard responsive layout |
| Config/scaffold | Sonnet | Boilerplate setup with clear instructions |

### Ayanokoji's Design System Points — Addressed

1. **Token setup as critical path entry point:** `p1-shared-tokens` creates the shared Tailwind config as its own task. `p1-web-tokens` and `p1-toolbox-tokens` extend it with per-app CSS variable overrides. Both depend on `p1-shared-tokens`.

2. **shadcn/ui in `packages/ui/`:** `p1-shared-ui-core` initializes shadcn/ui with all base components in the shared package. `p1-data-table` is a separate Opus task for the complex DataTable component (TanStack Table + virtual rows + keyboard nav + inline editing).

3. **Accessibility primitives in foundation phase:** `p1-a11y-primitives` creates focus ring utility, `prefers-reduced-motion` reset, skip-to-content link, `tabular-nums` utility, focus trap hook, and the custom `3xl: 1440px` breakpoint — all before any screen task runs.

---

## Decisions

| # | Decision | Rationale | Rejected Alternative |
|---|----------|-----------|---------------------|
| B1 | **50 tasks across 10 phases** | Matches the project's three surfaces (website, CRM, Workdesk) with clean dependency boundaries. Each phase produces independently verifiable output. | Fewer phases with mega-tasks (would exceed 5-file and 40-line prompt limits). More phases with micro-tasks (would add dependency overhead with minimal parallelism gain). |
| B2 | **Token setup split into 3 tasks: shared → web override → toolbox override** | The two apps have divergent token contexts (Toolbox: 14px base, slate-50 bg, 4px radius-sm; Website: 16px base, white bg, 6px radius-sm). One shared config with per-app CSS variable overrides avoids forking the Tailwind config while keeping each app's visual identity correct. Per Ayanokoji's recommendation. | Single Tailwind config with runtime theme switching (adds complexity for a single-tenant app). Forked Tailwind configs (duplicates token definitions, risks drift). |
| B3 | **DataTable as separate Opus task in packages/ui/** | The DataTable is the accountant's primary workspace (80% of time). It requires virtual scrolling, role="grid" semantics, keyboard navigation matching Excel/Sheets conventions, inline editing, and bulk selection. This complexity warrants dedicated Opus attention and clean separation from the page-level integration in p5-transaction-grid. Per Ayanokoji's recommendation. | Bundled into p5-transaction-grid (would create a 60+ line prompt exceeding limits). Bundled into p1-shared-ui-core as a Sonnet task (insufficient model capability for accessibility and virtual scrolling complexity). |
| B4 | **Database schema split into 4 migration tasks** | The 17 migration files naturally group into: CRM tables (users/leads/clients), financial tables (CoA/transactions/invoices), extended tables (tasks/deadlines/reports/BIR), and policies/triggers. Each group is independently verifiable and keeps expected files under 5. | Single mega-task for all migrations (17 files, 60+ line prompt). Per-migration tasks (17 tasks for simple SQL files is excessive overhead). |
| B5 | **All AI Pipeline Edge Functions assigned to Opus** | Gmail webhook handling, document OCR orchestration, and transaction categorization involve complex async flows, external API fallback chains, idempotency logic, and security-sensitive operations (token decryption). These require Opus-level reasoning about edge cases and failure modes. | Sonnet for simpler Edge Functions like classify-email (but it's called by gmail-webhook and shares the same failure mode handling, so co-locating them in one Opus task is more coherent). |
| B6 | **Marketing website in Phase 9 (after all Toolbox work)** | The website is the lowest-complexity surface (static content + contact form). Building it late ensures all shared packages (ui, db) are stable. It has no dependency on Toolbox features. | Phase 3 alongside Toolbox layout (would compete for Sonnet capacity with more critical CRM/Workdesk tasks). Phase 1 as part of foundation (shared packages aren't ready yet). |
| B7 | **Notification panel and doc preview as separate tasks, not combined with transaction grid** | The notification panel has its own Realtime subscription and state management. The doc preview panel shares a rail with notifications (toggle behavior). Separating them keeps each task focused and under the file/prompt limits. | Combined into p5-transaction-grid (would create a mega-task with 8+ files and 50+ line prompt). |
| B8 | **Accessibility primitives as a Phase 1 foundation task** | Focus ring, prefers-reduced-motion reset, skip-to-content, and tabular-nums must exist before any screen task runs. If shipped as part of individual screen tasks, they'd be implemented inconsistently across 15 screens. Per Ayanokoji's recommendation. | Part of each screen task's hardening section (inconsistent implementation, duplicated effort). Post-build hardening task (would require modifying every component after the fact). |