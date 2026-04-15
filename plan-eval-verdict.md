# Barker Plan Evaluation

**Plan:** `BARKER-PLAN-numera-accounting-2026-04-14.md` (v1)
**Evaluated by:** L Lawliet (QA / BI)
**Date:** 2026-04-16
**Verdict:** REVISE
**Blocking issues:** 8
**Warnings:** 14

---

## Summary

The plan is well-structured and demonstrates thorough scope coverage for most of the Numera platform. Phase sequencing is sound, dependency graph is clean, prompts are self-contained and correctly instructed. However, evaluation surfaces **8 blocking issues** across build quality and spec alignment: an auth middleware task on the wrong model, an oversized UI component task, systemic schema naming conflicts with the Tech Spec, and four critical missing pieces — the Tasks table + Task Tracker UI, Gmail OAuth connection infrastructure, and two cron Edge Functions whose absence means the Gmail pipeline expires after 7 days and annual deadlines stop generating after Year 1. These must be resolved before the plan can safely run.

---

## Structural Integrity

| Check | Result | Notes |
|-------|--------|-------|
| YAML validity | PASS | One fenced block, parses cleanly; `project.name` is kebab-case |
| Task identity | PASS | 31 unique IDs, all `pN-*` prefixed, all fields present, models are `opus`/`sonnet` only |
| Dependency graph | PASS | No circular deps, no self-refs, `p1-scaffold` is clean entry point, all `depends_on` refs exist |
| Context sources | PASS | All aliases reference `"discovery"` (the only defined `input_files` alias); `sections: ["all"]` only in validation block |
| Validation block | PASS | `checks` has build + type-check + lint; `fix_budget: 5`; build check present |

---

## Build Quality

| Check | Result | Severity | Notes |
|-------|--------|----------|-------|
| Model assignment | FAIL | BLOCKING | `p2-auth` on Sonnet creates auth middleware (security-critical). Ratio 38.7% Opus otherwise fine. |
| Task granularity | FAIL | BLOCKING | `p3-ui-core` lists 9 `expected_files` (>8 threshold); 20+ components in scope. All other tasks within bounds. |
| Prompt quality | PASS | — | All prompts self-contained, read-before-write, exact paths, no test/verify language |
| Hardening coverage | PASS | — | Auth, DB, API, UI, external service tasks all have specific hardening directives |
| Validation block quality | WARN | Warning | `context_sources` only includes `discovery`; PRD/Tech Spec/API Spec not loaded for Validator. Broad discovery sections help but miss spec-level contracts. |
| File conflict safety | PASS | — | No overlapping `expected_files` between parallel tasks. One minor note: `p9-email-flow` updates `sidebar.tsx` (created by `p3-layout-toolbox`) but sidebar is not in its `expected_files` — update not formally tracked. |
| Done/phase checks | WARN | Warning | Phase 8 `phase_check` uses `npm run build` in a `pnpm` workspace project (wrong package manager). Phase 9 has no `phase_check` field. All `done_check` commands are cheap `test -f` ✓ |

---

## Spec Alignment

| Spec | Result | Coverage | Gaps |
|------|--------|----------|------|
| PRD | FAIL | ~85% — marketing website, CRM pipeline, clients, invoicing, Workdesk all covered | Task Tracker (missing table + UI), Follow-up Email Drafting UI (function exists, no page task) |
| Tech Spec | FAIL | Architecture correct; schema naming diverges from spec in 6+ columns | `email_inbox` vs `email_notifications`, `documents` vs `document_attachments`, `activities` vs `lead_activity_log`, `leads.email` vs `leads.contact_email`, `leads.status` vs `leads.stage`, `leads.lost_reason` vs `leads.close_reason`; missing `tasks`, `gmail_connections`, `system_settings`, `bir_form_templates`, `ai_corrections` tables |
| API Spec | FAIL | Core CRUD, reports, exports covered | `connect-gmail` missing (can't provision Gmail); `cron-gmail-watch` missing (watch expires in 7 days); `cron-generate-deadlines` missing (deadlines stop after Year 1); `process-document` implemented as Server Action rather than Edge Function per spec |
| UI Design | FAIL | 12 of 15 screens covered | Screen 13 (Task Tracker) missing; Screen 14 (Follow-up Email Drafting) missing; Screen 15 (Settings Page / Gmail connection) missing; Screen 8 (BIR Tax Form Preparation) only partially covered via generic report viewer — prior-year comparison sidebar not implemented |

---

## Blocking Issues

**B1** — `p2-auth` assigned `sonnet`; creates security-critical auth middleware

Task `p2-auth` (Sonnet) creates Next.js middleware with session management, token refresh, fail-closed redirects to `/login`, and the OAuth callback handler. This is security-critical code. Per the evaluation rules, Sonnet on security-critical work is a blocking model assignment error.

**B2** — `p3-ui-core` has 9 `expected_files` (threshold: >8 = BLOCKING)

The task lists 9 files in `expected_files` and asks for 20+ shadcn/ui components in a single prompt. The file count alone triggers the blocking threshold. The task should be split into at minimum `p3-ui-primitives` (Button, Input, Textarea, Label, Checkbox, Select, Separator, Avatar, Skeleton) and `p3-ui-overlays` (Dialog, Sheet, Popover, Command, Calendar, Tooltip, Toast/Sonner, DropdownMenu, Tabs, Form).

**B3** — Schema naming conflicts with Tech Spec cause systemic TypeScript type failures

The plan's `p2-schema-a` creates columns that diverge from the Tech Spec and API Spec's query patterns:

| Plan (schema) | Tech Spec / API Spec |
|---|---|
| `email_inbox` (table) | `email_notifications` |
| `documents` (table) | `document_attachments` |
| `activities` (generic table) | `lead_activity_log` (dedicated) |
| `leads.email` | `leads.contact_email` |
| `leads.status` | `leads.stage` |
| `leads.lost_reason` | `leads.close_reason` |

The API Spec has explicit TypeScript query patterns using `stage`, `contact_email`, and `email_notifications`. Building the application against the plan's schema will produce type errors throughout tasks `p4-crm-api`, `p4-crm-pipeline`, `p5-wd-api`, `p9-email-flow`, and every task that reads leads or email inbox data.

**B4** — `tasks` table missing from schema; Task Tracker UI (Screen 13) has no task

The `tasks` table is defined in the Tech Spec and API Spec (`5.1 Exposed Tables`), referenced in the ERD (`leads →{ tasks`, `clients →{ tasks`), and Screen 13 (Task Tracker) is in the UI Design. The plan has no migration for this table, no CRUD layer, and no UI task. This is a core CRM feature (the sidebar in Screen 7 shows "Tasks" as a nav item) that cannot be built from the current plan.

**B5** — `gmail_connections` table missing; Settings Page (Screen 15) and `connect-gmail` OAuth flow absent

The `gmail_connections` table stores decrypted OAuth tokens used by both the Gmail sync function and the `process-document` Edge Function (see API Spec §6.1: "Fetch Gmail attachments using decrypted access token from `gmail_connections`"). Without this table and the `connect-gmail` OAuth flow:
- The Gmail ingestion pipeline has no credentials to call Gmail API
- The Settings Page (Screen 15, admin-only Gmail connection management) has no implementation

The entire email-to-transaction pipeline is non-functional until B5 is resolved.

**B6** — `cron-gmail-watch` Edge Function missing; Gmail push notification subscription expires after 7 days

The Gmail API `watch()` subscription that enables push notifications expires after 7 days maximum (Google requirement). The Tech Spec (§4.1 Edge Functions) defines `cron-gmail-watch` to renew this subscription. The plan has no task for this function. After 7 days of running the deployed system, the Gmail push pipeline silently stops receiving new emails. This is a production-critical omission.

**B7** — `cron-generate-deadlines` Edge Function missing; deadline instances stop after Year 1

The plan generates deadline instances for 12 months at client onboarding (`p9-onboarding-flow`). The Tech Spec defines `cron-generate-deadlines` (annual cron) to generate the next year's instances. Without it, every client's deadline tracker becomes empty 12 months after onboarding. The deadline tracking feature stops functioning at the 12-month mark.

**B8** — `cron-check-approaching-deadlines` Edge Function missing; proactive deadline reminders absent

The Tech Spec defines a daily cron (`cron-check-approaching-deadlines`, "Supabase pg_cron — daily 08:00 PHT") that checks for approaching deadlines and auto-drafts reminder emails. This is the automated reminder system described in the PRD (deadline tracking section). Without it, the accountant has no proactive notifications — only manual review of the deadline tracker.

---

## Warnings

**W1** — Monetary precision: plan uses `numeric(12,2)` / `numeric(14,2)`; Tech Spec specifies `numeric(15,2)` everywhere

For a Philippine accounting firm handling large invoices (e.g., corporate clients with multi-million peso transactions), the plan's 12-digit precision caps at ₱9,999,999,999.99. The Tech Spec mandates 15,2 (`numeric(15,2)`) throughout. Align the plan's schema directives to `numeric(15,2)`.

**W2** — `bir_form_templates`, `bir_form_field_mappings`, `bir_tax_form_records` tables missing from schema

The Discovery explicitly states "Template system must be easily updatable. Forms are data-driven, not hardcoded." The Tech Spec defines these three tables for the BIR template system. The plan's `p6-ai-reports/bir.ts` hardcodes form field computations, bypassing the maintainable template architecture. When BIR updates forms (which happens periodically), Rick must edit TypeScript logic rather than database records.

**W3** — `ai_corrections` table missing from schema

The API Spec (§5.2.6) defines AI correction tracking: when the accountant edits an AI-extracted field, the frontend writes to `ai_corrections` before updating the transaction. This creates a learning loop for model improvement and an audit trail. No migration task covers this table.

**W4** — `system_settings` table missing from schema

The API Spec lists `system_settings` as an admin-only table. The Settings Page (Screen 15) reads and writes system configuration. Without this table, system-level configuration has no persistence layer.

**W5** — `process-document` implemented as Next.js Server Action rather than Supabase Edge Function

The API Spec defines `process-document` as an Edge Function at `supabase/functions/process-document`. The plan implements it as `apps/toolbox/src/lib/workdesk/actions/process-document.ts` (Server Action). Key implications:
- Claude Vision API key must be in Vercel environment, not Supabase secrets
- Next.js Server Actions have a 30-second default timeout; document processing can take up to 120 seconds (API Spec §6.1 timeout)
- The `409 CONFLICT` (already processing check) requires shared state — easier in Supabase Edge than distributed Next.js

**W6** — `send-invoice` implemented as Server Action; requires Gmail OAuth credentials not available in Next.js context

`sendInvoice()` in `p4-crm-invoicing` must call Gmail API to send the invoice email. The Gmail OAuth tokens are stored in `gmail_connections` (Supabase). A Server Action would need to expose Gmail credentials to the Next.js runtime. The Tech Spec directs this to an Edge Function with access to Supabase secrets.

**W7** — `send-email` Edge Function not covered

The API Spec defines `send-email` for general Gmail send (follow-up emails, etc.). No task creates this function.

**W8** — Follow-up Email Drafting UI (Screen 14) has no task

`packages/ai/src/email.ts` exports `draftFollowUpEmail()` (created by `p6-ai-email`), but there is no task for the UI layer: a modal/drawer within client context, prompt input, AI draft review, send/discard actions. Screen 14 is in the UI Design.

**W9** — BIR Tax Form Preparation (Screen 8) not separately implemented; prior-year comparison sidebar absent

The plan's `p7-reports-ui` treats BIR forms as generic report cards. Screen 8 specifies a distinct UX: per-field editability (editable/read-only/manual-override/missing-data states), a prior-year comparison sidebar with YoY deltas, stale-template warning banner, and field-level validation on export. The generic report viewer (`report-table.tsx`) does not implement these patterns.

**W10** — `p7-exports` reads `apps/toolbox/src/lib/invoicing/` but has no dependency on `p4-crm-invoicing`

The prompt for `p7-exports` says "Read apps/toolbox/src/lib/invoicing/ for invoice types." The invoicing module (`queries.ts`, `actions.ts`) is created by `p4-crm-invoicing`. `p7-exports` depends only on `p6-ai-reports`. If the Barker scheduler runs `p7-exports` before `p4-crm-invoicing` completes (possible, given their dependency chains don't intersect), the invoicing files won't exist. Add `p4-crm-invoicing` to `p7-exports.depends_on`.

**W11** — Validation `context_sources` only includes `discovery`; key specs not loaded

The Validator prompt performs a broad hardening audit, but its only context source is `DISCOVERY.md`. The PRD feature inventory, Tech Spec schema definitions, and API Spec error contracts aren't available to the Validator. Consider adding the spec files to `input_files` and referencing them in `validation.context_sources`.

**W12** — Phase 8 `phase_check` uses `npm run build` in a `pnpm` workspace

```yaml
phase_check: "cd apps/web && npm run build"
```

The project is configured as a `pnpm` workspace (`pnpm-workspace.yaml`, scaffolded in `p1-scaffold`). Using `npm` here will bypass workspace resolution. Change to: `cd apps/web && pnpm run build` or `pnpm turbo build --filter=web`.

**W13** — Phase 9 has no `phase_check`

Integration & Polish phase has no gate. After `p9-states`, `p9-email-flow`, and `p9-onboarding-flow` all complete, there's no verification that the integrated application compiles. Add `phase_check: "pnpm run type-check && pnpm run lint"`.

**W14** — `p4-crm-invoicing` (6 files) and `p5-wd-api` (7 files) exceed the 5-file split indicator

Both tasks are above the 5-file warning threshold. They are within the 8-file blocking threshold and have well-scoped prompts, so execution is expected to succeed — but they are candidates for splitting if revision cycles introduce instability in these tasks.

---

## Revision Manifest

---

**R1** | BLOCKING | build-quality
**Affected tasks:** `p2-auth`
**Description:** `p2-auth` is assigned `model: "sonnet"` but creates security-critical auth middleware, session refresh logic, and OAuth callback handling.
**Required fix:** Change `p2-auth` model to `"opus"`.
**Acceptance criteria:** `p2-auth.model == "opus"` in the YAML.

---

**R2** | BLOCKING | build-quality
**Affected tasks:** `p3-ui-core`
**Description:** `p3-ui-core` lists 9 `expected_files` and scopes 20+ components. `expected_files` count exceeds the 8-file blocking threshold.
**Required fix:** Split `p3-ui-core` into two tasks using `a/b` chunking:
- `p3-ui-core-a` (Sonnet): primitive components — Button, Input, Textarea, Label, Select, Checkbox, Separator, Avatar, Skeleton, Badge. Estimated 15 min.
- `p3-ui-core-b` (Sonnet): overlay/composite components — Dialog, Sheet, Popover, Command, Calendar, Tooltip, Toast/Sonner, DropdownMenu, Tabs, Form, Card, Table. Depends on `p3-ui-core-a`. Estimated 20 min.
Update all tasks that `depends_on: ["p3-ui-core"]` to depend on `["p3-ui-core-b"]`.
**Acceptance criteria:** No task has `expected_files` count > 8. Tasks depending on the former `p3-ui-core` now depend on `p3-ui-core-b`.

---

**R3** | BLOCKING | spec-alignment
**Affected tasks:** `p2-schema-a`, and downstream tasks `p4-crm-api`, `p4-crm-pipeline`, `p5-wd-api`, `p9-email-flow`
**Description:** The plan creates schema column names that diverge from the Tech Spec and API Spec query contracts. This propagates incorrect TypeScript types into every downstream task.
**Required fix:** Align `p2-schema-a` schema to match the Tech Spec exactly:

| Change in `p2-schema-a` | Fix |
|---|---|
| `leads.email` | Rename to `contact_email` |
| `leads.status` | Rename to `stage` |
| `leads.lost_reason` | Rename to `close_reason` |
| Table `activities` | Replace with `lead_activity_log` scoped to leads, with `action` and `details` jsonb columns (see Tech Spec §4.4 `lead_activity_log` definition) |

In `p2-schema-b`, rename:
- Table `email_inbox` → `email_notifications`
- Table `documents` → `document_attachments`

Update TypeScript types in `packages/db/src/types/database.ts` to use the corrected names. Update `p4-crm-api` and `p5-wd-api` prompt context to reference the corrected names.
**Acceptance criteria:** Schema table and column names match the Tech Spec §4.4 definitions verbatim. TypeScript types reflect the corrected names.

---

**R4** | BLOCKING | spec-alignment
**Affected tasks:** `p2-schema-a` (schema gap), new task needed for UI
**Description:** No `tasks` table in the schema; Task Tracker (Screen 13 in UI Design) has no implementation task.
**Required fix:**
1. Add `tasks` table to `p2-schema-a`:
   - `id` (uuid PK), `title` (text NOT NULL), `description` (text), `status` (text CHECK IN ('todo','in_progress','done')), `priority` (text CHECK IN ('low','medium','high')), `due_date` (date), `linked_entity_type` (text CHECK IN ('lead','client')), `linked_entity_id` (uuid), `assigned_to` (uuid FK→users), `created_by` (uuid FK→users), `created_at`/`updated_at` (timestamptz). Add indexes on `(status, due_date)` and `(linked_entity_type, linked_entity_id)`.
2. Add a new task `p4-crm-tasks` (Sonnet, depends_on: `["p3-layout-toolbox", "p4-crm-api"]`):
   - CRM task tracker page at `apps/toolbox/src/app/(authenticated)/crm/tasks/page.tsx`
   - DataGrid: Title, Linked Entity, Priority badge, Due Date, Status, Assigned To, Actions
   - Quick-add task dialog, mark complete, filter by status/entity/assignee
   - Hardening: empty state, loading skeleton, overdue styling (red if due_date < today), 404 for linked entities
3. Update the sidebar nav in `p3-layout-toolbox` (or note in `p4-crm-tasks` to update `sidebar.tsx`) to include the Tasks nav item under CRM (consistent with Screen 7 showing "Tasks" in CRM nav).
**Acceptance criteria:** `tasks` table in `p2-schema-a` migration. New task `p4-crm-tasks` exists in Phase 4. Task Tracker page route created.

---

**R5** | BLOCKING | spec-alignment
**Affected tasks:** `p2-schema-b` (schema gap), new task needed
**Description:** No `gmail_connections` table in schema; no `connect-gmail` OAuth flow; Settings Page (Screen 15) absent. Without `gmail_connections`, `p6-ai-email` cannot retrieve OAuth tokens for Gmail API calls (API Spec §6.1 step 3: "Fetch Gmail attachments using decrypted access token from `gmail_connections`").
**Required fix:**
1. Add `gmail_connections` table to `p2-schema-b`:
   - `id` (uuid PK), `client_id` (uuid FK→clients nullable), `email_address` (text NOT NULL unique), `access_token_encrypted` (text NOT NULL), `refresh_token_encrypted` (text NOT NULL), `token_expiry` (timestamptz NOT NULL), `watch_expiry` (timestamptz), `watch_history_id` (text), `is_active` (bool DEFAULT true), `connected_by` (uuid FK→users), `created_at`/`updated_at`.
   - RLS: admin only.
2. Add a new task `p9-settings-page` (Opus, depends_on: `["p3-layout-toolbox", "p2-schema-b"]`):
   - Settings page at `apps/toolbox/src/app/(authenticated)/settings/page.tsx` — admin-only route
   - Gmail connection card: shows connected email, expiry, Disconnect button. "Connect Gmail" triggers OAuth with `connect-gmail` Edge Function
   - `supabase/functions/connect-gmail/index.ts` — OAuth token exchange, encrypt and store in `gmail_connections`
   - Hardening: admin role check (403 for non-admin), token encryption at rest, never log tokens, handle revoked refresh tokens
**Acceptance criteria:** `gmail_connections` table in `p2-schema-b`. Settings page task exists. `connect-gmail` Edge Function task exists.

---

**R6** | BLOCKING | spec-alignment
**Affected tasks:** new task needed
**Description:** `cron-gmail-watch` Edge Function absent. Gmail's `watch()` API subscription expires after exactly 7 days. Without renewal, push notifications stop and the email ingestion pipeline silently dies.
**Required fix:** Add task `p9-cron-gmail-watch` (Sonnet, depends_on: `["p6-ai-email", "p9-settings-page"]`):
- `supabase/functions/cron-gmail-watch/index.ts` — Called by Supabase pg_cron every 6 days. For each active `gmail_connections` row: call Gmail `users.watch()` with the Pub/Sub topic, update `watch_expiry` and `watch_history_id`.
- Hardening: handle revoked OAuth tokens (mark connection inactive, don't throw), log renewal failures, idempotent (renewing early is safe), never log tokens.
**Acceptance criteria:** `supabase/functions/cron-gmail-watch/index.ts` in expected_files. Task exists in Phase 9.

---

**R7** | BLOCKING | spec-alignment
**Affected tasks:** new task needed
**Description:** `cron-generate-deadlines` Edge Function absent. Client deadline instances are generated for 12 months at onboarding. After that, the deadline tracker goes empty. The Tech Spec defines an annual cron to generate the next year's instances.
**Required fix:** Add task `p9-cron-deadlines` (Sonnet, depends_on: `["p5-wd-api"]`) — can be combined with R6 task or separate:
- `supabase/functions/cron-generate-deadlines/index.ts` — Runs annually (December 1). For each active client with active deadline templates, generates instances for the coming year. Idempotent (skip if instances already exist for that period).
- `supabase/functions/cron-check-approaching-deadlines/index.ts` — Runs daily at 08:00 PHT. Finds deadline instances due within 7 days and overdue. Calls `draft-email` AI function to generate reminder drafts. Stores in a `reminders` table or logs to activities.
- Hardening: idempotent instance generation, skip inactive clients, timezone Asia/Manila for due date calculations, never block on single-client failure.
**Acceptance criteria:** Both cron functions have tasks. `cron-generate-deadlines` and `cron-check-approaching-deadlines` Edge Functions appear in expected_files.

---

**R8** | BLOCKING | spec-alignment
**Affected tasks:** `p7-exports` (missing dependency)
**Description:** `p7-exports` prompt instructs the instance to read `apps/toolbox/src/lib/invoicing/` (created by `p4-crm-invoicing`) but `p4-crm-invoicing` is not in `p7-exports.depends_on`. Barker may schedule `p7-exports` before `p4-crm-invoicing` completes. *(Promoted from warning given the dependency graph impact on execution correctness.)*
**Required fix:** Add `"p4-crm-invoicing"` to `p7-exports.depends_on`.
**Acceptance criteria:** `p7-exports.depends_on` includes `"p4-crm-invoicing"`.

---

*Warnings W1–W14 do not block execution but should be addressed in the same revision for plan quality.*

Key warnings to address alongside the blocking fixes:
- **W3** (schema names): align `numeric` precision to `15,2` throughout `p2-schema-a` and `p2-schema-b`
- **W2** (BIR templates): add `bir_form_templates`, `bir_form_field_mappings`, `bir_tax_form_records` tables to `p2-schema-b` if the template-driven BIR architecture from DISCOVERY is to be maintained
- **W12** (Phase 8 phase_check): change `npm run build` to `pnpm run build` or `pnpm turbo build --filter=web`
- **W13** (Phase 9 no gate): add `phase_check: "pnpm run type-check && pnpm run lint"` to phase 9
