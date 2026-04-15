# SPEC-REVIEW — Numera Accounting Service

**Reviewer:** L Lawliet (QA / Business Intelligence)
**Date:** 2026-04-15
**Status:** FINAL
**Review Basis:** Documents read from `agent/tony-stark` branch of `Lezzur/accounting-service` — the versions that include Tony Stark's post-QA fixes applied in response to Lisa's analysis.
**Documents Reviewed:**
- `DISCOVERY.md` (2026-04-14, Approved, High Confidence) — source of truth
- `PRD-numera-accounting.md` (2026-04-15, Reviewed)
- `TECH-SPEC-numera-accounting.md` (2026-04-15, Draft)
- `API-SPEC-numera-accounting.md` (1.0.0, Draft)
- `UI-DESIGN-numera-accounting.md` (2026-04-15, Complete)

---

## Executive Summary

**Overall Assessment: PASS WITH ISSUES (CONDITIONALLY READY)**

Lisa's QA analysis found 6 Critical issues, 13 Major issues, and 15+ Minor issues in the original spec set. Tony Stark's revision pass resolved all 6 Critical and all 13 Major findings. The spec set is now substantially ready for developer handoff.

**10 residual issues remain** — 0 Critical, 1 Major, 9 Minor. None block the start of development, but the Major issue (undocumented auto-email trigger mechanism) must be resolved before the Deadline Tracker feature is built.

This review is structured as: (1) per-document assessment of the current state, (2) verification that original findings were resolved, (3) new/residual issues found, (4) cross-document consistency matrix, and (5) final verdict.

---

## Per-Document Review

---

### PRD — `PRD-numera-accounting.md`

#### Strengths
- Feature inventory is comprehensive and covers all three surfaces (Website, CRM, Workdesk)
- Every feature has explicit state specifications (loading, empty, error, success) — rare quality for a PRD at this stage
- User flows are precise and include decision points and terminal states
- Personas are sharp: Anti-persona exclusion criteria prevent scope creep
- Data structures are typed (TypeScript interfaces), eliminating ambiguity between frontend and backend
- `close_reason` for Closed Lost leads is fully specified at both the UI and data model level
- Invoice "Viewed" status deviation from Discovery is explicitly acknowledged with rationale

#### Issues Found

**P-01 (Minor) — Contact form user flow omits Phone field**

> PRD Section 6, Flow "Prospect Sends Contact Form Inquiry", Step 2: "Fills in Name (required), Email (required), Business Name (optional), Message (required)."

The Contact Form feature spec (Section 5) correctly lists Phone as an optional field. The user flow description does not mention it. A developer reading only the flow section would not know Phone exists. Fix: add "Phone (optional)" to step 2 of the flow.

**P-02 (Minor) — `FinancialReport` TypeScript interface missing `aiNarrative` field**

> PRD Section 8, `FinancialReport` interface lists `aiNarrativeApproved: boolean` but does not include `aiNarrative: string | null`.

The Tech Spec `financial_reports` table has an `ai_narrative text` column. The API Spec `generate-report` response includes `aiNarrative` in the payload. The PRD interface is incomplete. Fix: add `aiNarrative?: string` to the interface.

**P-03 (Minor) — Invoice statuses in PRD do not match the enum**

> PRD Billing & Invoicing feature: "Invoice Statuses: Draft (editable), Sent (read-only), Paid (read-only), Overdue (derived: Sent + dueDate < today, red badge)."
> PRD `InvoiceStatus` enum: `Draft = "draft"`, `Sent = "sent"`, `Paid = "paid"`. Comment: `// Overdue = derived at read time`.

These are consistent — Overdue is correctly marked as derived. Not actually an issue. Documenting here for completeness.

**P-04 (Minor) — Accountant Partner reviewer is TBC**

> PRD header: "Reviewers: Rick (Product Owner / Developer), Accountant Partner (TBC)"

The primary user of this system has not reviewed the requirements spec. Before development reaches CRM and Workdesk features, the accountant partner must validate the workflows — especially BIR form selection, deadline types, and the transaction data grid UX. Not a spec defect, but a process risk.

---

### Tech Spec — `TECH-SPEC-numera-accounting.md`

#### Strengths
- Database schema is exceptionally detailed: every column typed, constrained, and indexed; seed data included
- AI pipeline is specified with confidence thresholds, fallback chains, and multi-page merging logic
- Edge Function contracts include request/response shapes, error codes, timeouts, and processing flows
- Single-entry bookkeeping decision is explicitly documented with rationale (Decision D1)
- `ai_corrections` table enables learning-from-corrections loop — this is architecturally significant and well-documented
- All new Edge Functions (connect-gmail, draft-email, generate-client-deadlines) are fully specified
- `@react-pdf/renderer` Deno compatibility risk is acknowledged with a fallback plan

#### Issues Found

**T-01 (Major) — Deadline reminder auto-email mechanism has no trigger**

> PRD Deadline Tracker feature: "the system uses the `draft-email` Edge Function with `templateType: 'deadline_reminder'` to auto-generate a follow-up email draft for the client when a deadline is ≤ 3 days away and the associated deliverable (e.g., bank statement) has not been received. The draft appears in the accountant's follow-up queue."

This behavior requires a background process to: (1) check `deadlines` table for approaching deadlines, (2) check whether the associated deliverable has been received (i.e., query `transactions` or `email_notifications`), (3) call `draft-email` to generate the draft. No cron job, trigger, or Edge Function is specified for this. The `cron-generate-deadlines` function only creates deadline records annually — it does not check for approaching deadlines or generate drafts.

Without this mechanism, the deadline reminder auto-draft feature cannot be built. Fix: add a new scheduled function (e.g., `cron-check-approaching-deadlines`) to the Tech Spec that runs daily, queries `deadlines WHERE due_date <= now() + 3 days AND status != 'completed'`, cross-references whether deliverables have been received (heuristic: any `email_notifications` from that client in the relevant period), and calls `draft-email` to generate the draft. Store generated drafts in a `draft_emails` table or surface them in the notification panel.

**T-02 (Minor) — `lead_activity_log` INSERT trigger not documented**

> Tech Spec: "`lead_activity_log` RLS Policy: All authenticated users can SELECT. INSERT via trigger/Edge Function only."
> Migration 14 is listed as `014_create_triggers.sql — updated_at triggers, lead activity log triggers` but no trigger DDL is specified.

A developer implementing migration 014 has no spec for what the lead activity log trigger should capture or how it should format entries. Fix: add a section to the Tech Spec defining the trigger: on INSERT or UPDATE to `leads`, insert a row to `lead_activity_log` with `action = 'stage_changed'` (when stage changes) or `action = 'updated'` (otherwise), capturing `details = {"from": old_stage, "to": new_stage}` for stage changes.

**T-03 (Minor) — `send-email` audit trail table not defined**

> PRD Follow-up Email Drafting: "Sends logged in client's activity log."
> Tech Spec schema: no `client_activity_log` table exists.

There is a `lead_activity_log` table for leads, but no equivalent for clients. "Sends logged in client's activity log" has no table to write to. Fix: either add a `client_activity_log` table (mirror of `lead_activity_log` with `client_id` instead of `lead_id`) or clarify that sent emails from the Follow-up Email Drafting feature are logged elsewhere (e.g., as notes in the `clients` table).

**T-04 (Minor) — `@react-pdf/renderer` Deno compatibility is a potential blocker**

> Tech Spec: "`@react-pdf/renderer` runs on Node.js natively. Deno compatibility requires the npm: specifier. If import resolution fails at deploy time, fallback to a minimal Cloud Run service (~$5/month) for PDF rendering. Test during M6 milestone."

PDF generation is required for invoices, BIR forms, and financial reports — three core features. If this library fails on Deno, the fallback (Cloud Run) requires additional infrastructure setup mid-project. The risk should be validated at M1 (architecture spike), not M6, to avoid rework on PDF-dependent features. Not a spec defect but a development risk.

---

### API Spec — `API-SPEC-numera-accounting.md`

#### Strengths
- All 12 Edge Functions are fully documented with request/response shapes, error codes, timeouts, and auth requirements
- Standard error envelope is defined once and applied consistently
- `suggest-category` has two invocation modes (existing transaction ID vs. raw data) — excellent developer ergonomics
- `connect-gmail` processing flow is detailed enough to implement directly
- `generate-client-deadlines` idempotency is explicitly specified (`ON CONFLICT DO NOTHING`)
- `render-pdf` AI narrative gate behavior is unambiguous

#### Issues Found

**A-01 (Minor) — BIR form list in `prefill-bir-form` is incomplete**

> API Spec Section 6.3, request body: "`formNumber` — BIR form number (e.g., `2550Q`, `2551Q`, `1701`, `1701Q`, `1702`, `1702Q`)"

PRD Section 5 lists 11 supported forms: `2551Q, 2550M, 2550Q, 1701, 1701Q, 1702, 1702Q, 1601-C, 1601-EQ, 0619-E, 0619-F`. The API Spec example only enumerates 6. Because the system is data-driven (form templates are a DB table), all 11 will work at runtime — but the spec is incomplete as documentation. Fix: update the `formNumber` parameter description to list all 11 supported forms.

**A-02 (Minor) — `handle-contact-form` CORS policy not in API Spec but is in Tech Spec**

> Tech Spec `handle-contact-form`: "CORS restricted to `numera.ph`." API Spec Section 6.12 documents the CORS headers.

Actually, this is documented in the API Spec at section 6.12. Not an issue. Verified.

**A-03 (Minor) — No query pattern documented for `system_settings` UPDATE**

> API Spec Section 5.1 table list: "`system_settings` — Admin only: SELECT/UPDATE."
> UI Design Screen 15 (Settings Page): Specifies threshold editing with save buttons.

The API Spec documents PostgREST table access for `system_settings` but no query pattern (like those in Section 5.2) shows how the frontend reads or writes settings. A developer would need to figure out the PostgREST PATCH syntax. Low risk (it's standard PostgREST), but minor documentation gap.

---

### UI Design — `UI-DESIGN-numera-accounting.md`

#### Strengths
- Design token table is complete, accurate, and includes Stitch project IDs for generated screens
- Semantic CSS variable mapping table is present and correct (M12 fix verified)
- All 15 screens are specified, including the three new ones (Task Tracker, Follow-up Email Drafting, Settings)
- Missing UI States Addendum comprehensively addresses the 9 states that were absent
- Keyboard navigation table for the transaction grid is precise and complete
- WCAG 2.1 AA compliance is verified with contrast ratio calculations
- The document preview / notification panel shared rail trade-off is explained with reasoning

#### Issues Found

**U-01 (Minor) — "Aging" vs "Ageing" spelling inconsistency**

> UI Design Screen 9 (Financial Report Generator): Report Type dropdown lists "AR Aging, AP Aging."
> Tech Spec `financial_reports` table `report_type` CHECK constraint and PRD `ReportType` enum: `ar_ageing`, `ap_ageing`.
> API Spec `generate-report` request body: `ar_ageing`, `ap_ageing`.

The UI label uses American English ("Aging"), the code identifiers use British English ("Ageing"). The database schema is the authority — code values cannot change without a migration. The UI label can safely display "Aging" since it's presentation-only, but the inconsistency will cause confusion during code reviews and QA. Fix: decide on one canonical spelling. Recommend standardizing the DB/code to `ar_aging`/`ap_aging` (American English is more common in technical contexts) with a migration, or explicitly document that "Aging" is the UI display label and "ageing" is the code identifier.

**U-02 (Minor) — Screen 13 (Task Tracker) has no Stitch screen**

> UI Design Screen Inventory: Screen 13 "Task Tracker — Specified (no Stitch screen)"
> Screen 14 "Follow-up Email Drafting — Specified (no Stitch screen)"
> Screen 15 "Settings Page — Specified (no Stitch screen)"

These three screens are text-specified but not visually rendered. Given that Screens 13 and 14 involve non-trivial layout decisions (480px drawer, task table with priority dots, email textarea), a Stitch render or hand-drawn wireframe would reduce frontend implementation ambiguity. Acceptable for launch given the text spec quality; however, the developer should validate layout assumptions before implementation.

**U-03 (Minor) — `green-700` on `teal-100` contrast is flagged as AA but green-700 text on teal-100 bg may be confusing**

> UI Design Color Tokens: "`green-700` on `teal-100` = ~5.2:1. All pass AA."

The "Approved" status badge uses `teal-100` bg with `teal-700` text (from the Status badge colors spec in Screen 1). But the semantic token table shows `green-700` on `teal-100`. These aren't the same color pair. The "Approved" badge appears to use teal, not green — which is correct for the primary color scheme. The `green-700 / teal-100` pair seems to be documenting a different use case. Verify the "Approved" badge renders as `teal-100 bg / teal-700 text` as specified in Screen 1 (line ~419), not `teal-100 bg / green-700 text`.

---

## Verification: Original Issues from Lisa's Analysis

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| C1 | Missing `connect-gmail` Edge Function | **RESOLVED** | API Spec §6.8, Tech Spec §4.6 both fully document it |
| C2 | `process-document` response shape mismatch | **RESOLVED** | Both docs now use `{success, data:{transactionsCreated, transactions[], documentsStored, pagesProcessed, extractionBatchId, warnings}, meta}` |
| C3 | Error codes differ between Tech Spec and API Spec | **RESOLVED** | Both docs use `VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`, `PROCESSING_FAILED`, `INTERNAL_ERROR`, `DEPENDENCY_UNAVAILABLE` |
| C4 | `sourceDocumentUrl` vs `source_document_attachment_id` type mismatch | **RESOLVED** | PRD Transaction interface now uses `sourceDocumentAttachmentId?: string` (UUID FK) matching Tech Spec schema |
| C5 | Task Tracking screen missing from UI Design | **RESOLVED** | Screen 13 fully specified with layout, states, and responsive behavior |
| C6 | Invoice "Viewed" status contradicts Discovery | **PARTIALLY RESOLVED** | PRD explicitly documents the deviation. DISCOVERY.md Section 10 still says "Sent → Viewed → Paid" and has not been amended. Low risk since the deviation is acknowledged, but DISCOVERY is technically inconsistent with implemented specs. |
| M1 | Deadline reminder system missing | **RESOLVED** | PRD Deadline Tracker now specifies in-app 7-day notification banner and auto-draft generation via `draft-email` — **but see T-01 above, the trigger mechanism is missing** |
| M2 | No endpoint for deadline generation during onboarding | **RESOLVED** | API Spec §6.10 `generate-client-deadlines`, Tech Spec §4.6 both fully document it |
| M3 | Closed Lost reason not captured | **RESOLVED** | Tech Spec `leads` table has `close_reason text` field; PRD Kanban Board has required dialog prompt |
| M4 | Google Sheets folder setup missing from onboarding flow | **RESOLVED** | PRD Flow "Lead Converted to Client" step 5 now includes Google Sheet Folder URL |
| M5 | Follow-up Email Drafting has no API endpoint and no UI screen | **RESOLVED** | API Spec §6.9 `draft-email`, UI Design Screen 14 both fully specified |
| M6 | `suggest-category` endpoint orphaned | **RESOLVED** | PRD Transaction Data Grid explicitly references `suggest-category` invocation for "?" indicator behavior |
| M7 | `generate-report` response schemas undefined for 6 of 8 report types | **RESOLVED** | API Spec §6.2 now documents all 8 report type response schemas |
| M8 | `generate-report` response shape differs between docs | **RESOLVED** | Both docs place `aiNarrative` inside `data` envelope at same level |
| M9 | `prefill-bir-form` response shape differs | **RESOLVED** | Both docs now use `sections[].fields[]` nested structure |
| M10 | Contact form `phone` field inconsistency | **RESOLVED** | PRD feature spec, Tech Spec, and API Spec all include `phone` as optional field |
| M11 | `render-pdf` AI narrative gate behavior unspecified | **RESOLVED** | API Spec §6.4 explicitly: "narrative omitted from PDF if `ai_narrative_approved = false`"; Tech Spec mirrors this |
| M12 | Semantic CSS variable mapping table missing from UI Design | **RESOLVED** | UI Design now includes complete mapping table with hex values for Toolbox and Website contexts |
| M13 | 9 missing UI states across screens | **RESOLVED** | UI Design "Missing UI States Addendum" covers all identified gaps |
| Minor | camelCase vs snake_case convention undocumented | **RESOLVED** | API Spec §3.4 documents that PostgREST returns snake_case and the Supabase SDK maps to camelCase via generated types |
| Minor | Industry predefined list not enumerated | **RESOLVED** | PRD Client Profile feature now lists all 12 industry values |
| Minor | "3-5 service cards" vague count | **RESOLVED** | PRD Services Section now says "3 service cards at launch... maximum 5 total" |
| Minor | `send-invoice` and `send-email` missing from architecture diagram | **RESOLVED** | Tech Spec §4.1 diagram now includes both Edge Functions |
| Minor | Sidebar expanded/collapsed default rule | **RESOLVED** | PRD Toolbox Shell feature specifies: "CRM defaults to 240px expanded. Workdesk defaults to 64px collapsed. User override persists per module in localStorage." |
| Minor | Kanban backward-movement blanket prohibition | **RESOLVED** | PRD now specifies "Not allowed. Drop on invalid target returns card to origin." — deliberate design decision, not unspecified |

---

## Cross-Document Consistency Matrix (Post-Fix State)

| | PRD | Tech Spec | API Spec | UI Design |
|---|---|---|---|---|
| **PRD** | — | ✓ aligned on data types and edge functions | ✓ aligned; minor: FinancialReport interface missing `aiNarrative` field (P-02) | ✓ aligned; Screen 5 contact form omits Phone from user flow (P-01) |
| **Tech Spec** | | — | ✓ fully aligned; all endpoint contracts match | ✓ aligned; "Aging" vs "ageing" label vs. code identifier (U-01) |
| **API Spec** | | | — | ✓ aligned; all endpoints have corresponding UI interactions |
| **UI Design** | | | | — |
| **DISCOVERY** | C6 residual: DISCOVERY §10 invoicing workflow not updated | ✓ | ✓ | ✓ |

**Conflict count:** 0 Critical cross-document conflicts remain.
**Residual inconsistency:** DISCOVERY.md §10 invoice workflow vs. PRD deliberate deviation (documented but source-of-truth not updated).

---

## Open Issues Summary

| # | Severity | Document | Description |
|---|----------|----------|-------------|
| T-01 | **Major** | Tech Spec | Auto-deadline-reminder email mechanism has no trigger/cron specification |
| C6 residual | Minor | DISCOVERY | §10 invoicing workflow not updated to reflect removal of "Viewed" status |
| P-01 | Minor | PRD | Contact form user flow step 2 omits Phone field |
| P-02 | Minor | PRD | `FinancialReport` interface missing `aiNarrative` field |
| P-04 | Minor | PRD | Accountant Partner reviewer listed as TBC |
| T-02 | Minor | Tech Spec | `lead_activity_log` INSERT trigger not documented |
| T-03 | Minor | Tech Spec | `send-email` audit trail table not defined |
| T-04 | Minor | Tech Spec | `@react-pdf/renderer` Deno compatibility risk should be validated at M1 not M6 |
| A-01 | Minor | API Spec | `prefill-bir-form` parameter description lists only 6 of 11 supported BIR forms |
| U-01 | Minor | UI Design | "Aging" (UI label) vs "ageing" (DB code) spelling inconsistency |
| U-02 | Minor | UI Design | Screens 13, 14, 15 have no Stitch renders |
| U-03 | Minor | UI Design | `green-700/teal-100` badge pair needs verification against Screen 1 Approved badge spec |

---

## Final Verdict

**CONDITIONALLY READY FOR DEVELOPER HANDOFF.**

The spec set has undergone one full QA pass (Lisa) and one full revision pass (Tony Stark). All original Critical and Major issues are resolved. The current blocker is **T-01** — the deadline reminder auto-email feature references behavior that requires a background trigger with no implementation path specified. This must be resolved before the Deadline Tracker feature is built, but it does not block starting development on other features.

**Recommended pre-handoff actions (in priority order):**

1. **Before Deadline Tracker feature begins:** Resolve T-01 — add `cron-check-approaching-deadlines` Edge Function specification to Tech Spec.
2. **Before any feature begins:** Amend DISCOVERY.md §10 to reflect the "Viewed" status removal — keeps the source-of-truth document accurate.
3. **Within first week of development:** Validate `@react-pdf/renderer` Deno compatibility (T-04 risk). Don't wait for M6.
4. **Before CRM feature begins:** Schedule accountant partner review of PRD (P-04).
5. **Minor fixes as time allows:** P-01, P-02, T-02, T-03, A-01, U-01, U-03.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| QA-D1 | Reviewed post-fix documents (agent/tony-stark branch) rather than originals | The purpose of this review is to assess readiness for developer handoff, not to re-score already-fixed issues. Findings reference the current document state. |
| QA-D2 | C6 (Invoice "Viewed" status) classified as Minor residual, not Critical | The PRD explicitly acknowledges the deviation from DISCOVERY with rationale. All four spec documents are internally consistent. DISCOVERY.md is out of date but not misleading in the context of the overall spec set. |
| QA-D3 | T-01 classified as Major | The deadline reminder auto-draft feature is explicitly described in the PRD as product behavior. If a developer builds to the PRD, they will discover the trigger mechanism is unspecified only after implementing the feature. Early flag prevents backtracking. |
| QA-D4 | "Aging" vs "Ageing" classified as Minor, not Critical | The inconsistency is presentation-only. The database schema and API code values are canonical ("ageing"). The UI label is cosmetic. A developer can resolve this independently. |
| QA-D5 | No scope creep found | All features in the spec documents match DISCOVERY §6 in-scope items. No out-of-scope features from DISCOVERY §6 "Explicitly Out of Scope" section appear in the specs. |
