# Barker Plan Evaluation

**Plan:** `/workspaces/l-lawliet/accounting-service/BARKER-PLAN-numera-accounting.md`
**Verdict:** REVISE
**Blocking issues:** 2
**Warnings:** 7

---

## Summary

The Numera Accounting Service Barker plan is architecturally excellent — 50 well-scoped tasks across 10 phases, comprehensive feature coverage across all three surfaces (marketing site, CRM, Workdesk), and thorough hardening on every AI pipeline and security-critical task. Two targeted fixes are required before execution: a migration file (`010_create_financial_reports.sql`) that appears in the `p2-schema-extended` prompt but is absent from its `expected_files`, which would leave the financial reports table uncreated and break Phase 7 and 8 downstream tasks; and a reference in `p8-cron-deadlines` to a `deadline_notifications` table that does not exist in the schema and has no corresponding migration, causing the deadline cron to fail at runtime.

---

## Structural Integrity

| Check | Result | Notes |
|-------|--------|-------|
| YAML validity | PASS | Valid YAML fenced block; all required top-level fields present |
| Task identity | PASS | 50 unique kebab-case IDs, all prefixed with phase number (`p1-` through `p10-`); all required fields present on every task |
| Dependency graph | PASS | All `depends_on` entries reference valid task IDs; no circular dependencies; `p1-monorepo-scaffold` has `depends_on: []` (entry point); cross-phase dependencies are forward-only |
| Context sources | PASS | All aliases (`prd`, `tech-spec`, `api-spec`, `ui-design`, `discovery`) match `input_files` definitions; no task references an undefined alias |
| Validation block | PASS | `checks` non-empty; `fix_budget: 5`; build, type-check, and lint all present; comprehensive 6-area hardening audit in `prompt` |

---

## Build Quality

| Check | Result | Severity | Notes |
|-------|--------|----------|-------|
| Model assignment | PASS | — | All AI pipeline, security, and financial logic tasks correctly assigned Opus: p3-auth, p5-transaction-grid, p6-ai-package, p6-gmail-webhook, p6-process-document, p6-categorize-transaction, p6-connect-gmail, p7-generate-report, p7-prefill-bir-form, p8-render-pdf, p8-send-invoice, p8-draft-email, p8-cron-deadlines. All CRUD, scaffold, and UI tasks Sonnet. Borderline: `p2-schema-extended` (Sonnet creating financial_reports + BIR template schema) — acceptable given the detailed prompt, but noted. |
| Task granularity | PASS | — | All `estimated_minutes` 5–30. No prompt exceeds ~35 lines. All `expected_files` ≤ 4 files (though several prompts create more files than expected_files lists — see Warning 1). |
| Prompt quality | PASS | — | All prompts are self-contained. Prompts instruct builders to read existing files before starting. No "run tests" or "verify it works" language. `p9-handle-contact-form` has one ambiguous instruction (rate limiting — see Warning 2). |
| Hardening coverage | PASS | — | Every task with business logic has a specific `Hardening requirements` section. Auth, RLS, AI pipeline, encryption, and atomic operations are all covered with specific directives. No generic "handle errors properly" placeholders. |
| Validation block | PASS/WARN | — | Build + type-check + lint present. No test runner (the plan has no test-writing tasks — acceptable for a build plan). `context_sources` covers prd, api-spec, and ui-design at `sections: ["all"]` but omits `tech-spec`. The hardening audit won't have context for encryption requirements (§6), data model constraints (§4.4), or AI pipeline specifics (§4.6). |
| File conflicts | PASS | — | No parallel tasks share `expected_files`. Phase ordering enforces sequential execution between potentially conflicting tasks. |
| Done/phase checks | PASS/WARN | — | All `done_check` commands are cheap `test -f` assertions. Phase 3 and Phase 9 have `phase_check: "pnpm run type-check"` (reasonable gates). Most phases have no explicit phase_check (fine per Barker schema). |

---

## Spec Alignment

| Spec | Result | Coverage | Gaps |
|------|--------|----------|------|
| PRD | PASS/WARN | ~49/50 features covered | `Feature: Invoice Sending from Workdesk` (PRD §Workdesk Module) — the Workdesk quick-action modal for sending invoices without switching to CRM — has no corresponding UI task. The `p8-send-invoice` Edge Function exists but the frontend modal component does not. |
| Tech Spec | PASS | All architecture decisions addressed | All 17+ migrations covered across 4 schema tasks. All AI models (Haiku for classification/categorization, Sonnet Vision for OCR, Sonnet for narrative/email draft) correctly referenced. Turborepo, Next.js 14, Supabase Edge Functions (Deno) correctly scaffolded. |
| API Spec | PASS | 14/14 Edge Functions covered (§6.1–§6.14 including all crons) | All PostgREST query patterns (§5.2.1–§5.2.12) referenced in task prompts. Error envelope `{error: {code, message, details, request_id}}` specified in hardening on every Edge Function. Rate limiting (§4) addressed. |
| UI Design | PASS | 15/15 screens covered | Screen 1 (transaction grid), Screen 2 (row editing), Screen 3 (doc preview), Screen 4 (filtered grid), Screen 5 (homepage desktop), Screen 6 (homepage mobile), Screen 7 (lead pipeline), Screen 8 (BIR form), Screen 9 (report generator), Screen 10 (deadline tracker), Screen 11 (client profile), Screen 12 (invoice creation), Screen 13 (task tracker), Screen 14 (email drafting), Screen 15 (settings) — all have corresponding tasks with `ui-design` context. |

---

## Blocking Issues

**1. `010_create_financial_reports.sql` missing from `p2-schema-extended` expected_files.**

The `p2-schema-extended` prompt explicitly instructs creating five migration files:

```
008_create_tasks.sql
009_create_deadlines.sql
010_create_financial_reports.sql
011_create_bir_templates.sql
012_create_system_settings.sql
```

But `expected_files` lists only four — `010_create_financial_reports.sql` is absent:

```yaml
# current (broken)
expected_files:
  - "supabase/migrations/008_create_tasks.sql"
  - "supabase/migrations/009_create_deadlines.sql"
  - "supabase/migrations/011_create_bir_templates.sql"
  - "supabase/migrations/012_create_system_settings.sql"
done_check: "test -f supabase/migrations/009_create_deadlines.sql && test -f supabase/migrations/012_create_system_settings.sql"

# correct
expected_files:
  - "supabase/migrations/008_create_tasks.sql"
  - "supabase/migrations/009_create_deadlines.sql"
  - "supabase/migrations/010_create_financial_reports.sql"
  - "supabase/migrations/011_create_bir_templates.sql"
  - "supabase/migrations/012_create_system_settings.sql"
done_check: "test -f supabase/migrations/009_create_deadlines.sql && test -f supabase/migrations/010_create_financial_reports.sql && test -f supabase/migrations/012_create_system_settings.sql"
```

The `financial_reports` table is critical infrastructure for three downstream phases:
- `p7-generate-report`: INSERTs into `financial_reports` as its primary output
- `p7-report-generator-ui`: queries `financial_reports` to list previously generated reports
- `p8-render-pdf`: reads `financial_reports.ai_narrative_approved` as the narrative safety gate

If the Sonnet builder follows the `expected_files` contract over the full prompt text and skips creating `010`, none of the Phase 7 or Phase 8 report features will function. The `done_check` currently verifies only 009 and 012, so the omission would go undetected until Phase 7 tasks fail with "relation does not exist" errors.

**Fix:** Add `"supabase/migrations/010_create_financial_reports.sql"` to `p2-schema-extended.expected_files` and include it in the `done_check`. One-line edit.

---

**2. `p8-cron-deadlines` references `deadline_notifications` table that does not exist in the schema.**

The `p8-cron-deadlines` prompt instructs (step 3 of the cron flow):

```
3. For deadlines within 7 days: upsert into a deadline_notifications record for in-app banner
```

The tech spec defines 17 migrations (001–017). No migration creates a `deadline_notifications` table. The complete schema table inventory is: `users`, `leads`, `lead_activity_log`, `clients`, `client_activity_log`, `gmail_connections`, `email_notifications`, `document_attachments`, `chart_of_accounts`, `transactions`, `ai_corrections`, `invoices`, `invoice_line_items`, `tasks`, `deadlines`, `financial_reports`, `bir_form_templates`, `bir_form_field_mappings`, `bir_tax_form_records`, `system_settings`, `draft_emails`. `deadline_notifications` is not in this list.

The builder will generate code such as:
```typescript
await supabase.from('deadline_notifications').upsert({ ... })
```

This will fail at runtime with a Postgres "relation does not exist" error on every invocation of step 3. Although the hardening requirements say "Handle partial failures gracefully — don't abort on single deadline error," this error will occur for every deadline processed, silently breaking the in-app notification banner feature entirely.

Per the PRD, the "deadlines due this week" banner is described as "dismissible per session" — a client-side feature derivable directly from the `deadlines` table in the UI without a server-side notifications table.

**Fix (option A — simplest):** Remove step 3 from `p8-cron-deadlines`. The Workdesk UI already queries `deadlines` to render the tracker; the approaching deadline banner can be derived client-side from `due_date <= now()+7 days` at page load.

**Fix (option B — if a dedicated table is preferred):** Add a `deadline_notifications` migration to `p2-schema-policies` or a new task, with columns: `client_id FK, deadline_id FK, due_date, period_label, created_at`. Index on `(client_id, deadline_id)` for idempotency.

---

## Warnings

1. **`p6-ai-package` `expected_files` omits `generate-narrative.ts`, `draft-email.ts`, and `index.ts`.** The task prompt creates 7 files but `expected_files` lists only 4. Two of the missing files are directly imported by downstream tasks: `p7-generate-report` reads `packages/ai/src/prompts/generate-narrative.ts`, and `p8-draft-email` reads `packages/ai/src/prompts/draft-email.ts`. The prompt is explicit enough that a builder will create all 7 files, but the `done_check` won't verify the critical missing files. Recommend adding all 7 to `expected_files` and adding `generate-narrative.ts` and `draft-email.ts` to the `done_check`.

2. **`p9-handle-contact-form` rate limiting includes an in-memory option that won't work in serverless.** The prompt says: "Rate limit: 5 per IP per hour (implement via simple counter table or in-memory)." In-memory state does not persist across Supabase Edge Function invocations on Deno. A builder could implement the in-memory option, pass local testing, and silently fail to enforce rate limits in production. Recommend removing "or in-memory" and specifying a Postgres counter table: `rate_limit_counters(ip TEXT, window_start TIMESTAMPTZ, count INT)` with `ON CONFLICT DO UPDATE`.

3. **Validation block `context_sources` omits `tech-spec`.** The validator receives full context for PRD, API spec, and UI design — but not the tech spec. The hardening audit won't have context for: AES-256-GCM token encryption requirements (§6), AI pipeline confidence thresholds and fallback chains (§4.6), data model constraints (§4.4, e.g. `amount > 0`, `ON DELETE RESTRICT` on financial tables). Recommend adding `{alias: "tech-spec", sections: ["4.4", "4.6", "6"]}` to `validation.context_sources`.

4. **No automated test tasks in the plan.** None of the 50 tasks write test files and `validation.checks` does not include a test runner. For an accounting application processing financial data (OCR extraction, BIR form field mapping evaluation, monetary precision), the absence of automated tests means edge cases are never computationally verified. The comprehensive hardening audit partially compensates. Consider adding test tasks for `packages/ai/` (prompt/validation logic) and `prefill-bir-form` (topological sort, computed field evaluation) post-build.

5. **`Feature: Invoice Sending from Workdesk` has no UI task.** The PRD defines this as a distinct feature: a quick-action modal within the Workdesk client view that lists Draft invoices and allows sending without navigating to CRM. The `p8-send-invoice` Edge Function exists, but the frontend modal component is not in any task's `expected_files`. Accountants must navigate to the CRM Invoices module to send — the Workdesk convenience path described in the PRD is absent. Consider adding a small Sonnet task (Phase 5 or Phase 8) for the `workdesk-send-invoice-modal.tsx` component.

6. **`p2-schema-extended` is Sonnet despite creating financial and BIR data models.** The task creates `financial_reports` (with `ai_narrative_approved` logic), `bir_form_templates` (with `template_layout JSONB` driving PDF rendering), and `bir_form_field_mappings` (with 5-type `mapping_expression JSONB` schema including `computed` formula evaluation). These are complex financial data structures. The task prompt mirrors the tech spec verbatim, which largely compensates — Sonnet can follow detailed instructions. Borderline; Opus would add a safety margin for the JSONB expression schema design.

7. **`p4-lead-detail` does not specify audit logging for the "Convert to Client" action.** The lead detail drawer includes a "Convert to Client" flow (confirmation modal → create Client record → navigate to profile). The task hardening requirements do not explicitly instruct the builder to INSERT into `lead_activity_log` with `action='converted_to_client'`. The database triggers handle stage changes but not the conversion action specifically. Minor gap — the builder may or may not add the conversion audit entry.

---

## Recommendations

1. Fix both blocking issues before running `barker run`. The `expected_files` fix for `p2-schema-extended` is a one-line edit. The `deadline_notifications` issue requires either removing step 3 from the cron prompt (simplest) or adding a migration task.

2. Add `generate-narrative.ts` and `draft-email.ts` to `p6-ai-package.expected_files` and `done_check`.

3. In `p9-handle-contact-form`, replace "implement via simple counter table or in-memory" with an explicit Postgres counter table specification.

4. Add `tech-spec` sections `["4.4", "4.6", "6"]` to `validation.context_sources`.

5. Consider adding a UI task for the Workdesk "Send Invoice" quick-action modal (PRD feature gap).

6. The model assignments, dependency graph, hardening directives, AI pipeline decomposition, and UI/spec coverage are all strong. Once the two blocking issues are resolved, the plan should execute cleanly.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| EV-01 | `010_create_financial_reports.sql` missing from `p2-schema-extended.expected_files` — **blocking** | The `financial_reports` table is consumed by p7-generate-report (INSERT), p7-report-generator-ui (SELECT history), and p8-render-pdf (ai_narrative_approved gate). A missing migration causes all three tasks to fail with relation-not-found errors. The done_check verifying only 009 and 012 would not detect the omission. |
| EV-02 | `deadline_notifications` table reference in `p8-cron-deadlines` — **blocking** | No migration creates this table. The tech spec schema inventory (17 migrations, 21 tables) does not include it. The cron will generate code against a nonexistent relation, causing a Postgres error on every execution of step 3. The in-app banner is derivable from the `deadlines` table without a dedicated notifications table. |
| EV-03 | `p6-ai-package` incomplete `expected_files` — **warning, not blocking** | The prompt is complete and explicitly names all 7 files. Builders will likely create them all. The risk is low because downstream task prompts explicitly name the imported files (`generate-narrative.ts`, `draft-email.ts`), providing a late-stage catch if they're missing. But the done_check gap is real. |
| EV-04 | `p9-handle-contact-form` in-memory rate limiting option — **warning, not blocking** | The builder is also offered "simple counter table" which works correctly. The plan will build; rate limiting may be ineffective in production if the builder chooses in-memory, but this does not break the build or other features. |
| EV-05 | Validation block missing tech-spec — **warning, not blocking** | PRD, API spec, and UI design provide sufficient context for ~80% of the hardening audit. Tech spec would improve coverage for encryption and AI pipeline specifics but is not required for the audit to produce value. |
| EV-06 | No test tasks — **warning, not blocking** | Acceptable for a rapid build plan. The 6-area hardening audit compensates for the absence of automated tests at the plan execution stage. Testing would be a post-build activity for this project. |
| EV-07 | `Feature: Invoice Sending from Workdesk` missing — **warning, not blocking** | The accountant can still send invoices from the CRM module. The Workdesk quick-action path is a PRD convenience feature, not core functionality. The risk is an incomplete PRD feature, not a technical failure. |
| EV-08 | `p2-schema-extended` Sonnet model — **not flagged as blocking** | The task prompt precisely mirrors the tech spec schema definitions, leaving minimal room for creative interpretation. The risk of incorrect constraint design is low given the provided context. Not a correctness violation per BP-08. |
| EV-09 | Full three-pass evaluation executed | PRD, Tech Spec, API Spec, UI Design all read in full. All 50 tasks reviewed across all 10 phases. All migration file references cross-checked against the tech spec schema and migration list. All 14 Edge Function specs verified against plan tasks. All 15 UI Design screens mapped to tasks. |
