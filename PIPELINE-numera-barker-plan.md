# Pipeline: Numera Barker Plan

### 1. Barker Plan
- room: numera-barker-plan
- output: BARKER-PLAN-numera-accounting.md
- assigned: tony-stark
- agents: tony-stark, ayanokoji
- source: DISCOVERY.md
- reasoning: extended
- kickoff: |
  Write the Barker build plan for the Numera Accounting Service.

  Use the **barker-plan skill** — follow its exact YAML schema, phase structure,
  task decomposition rules, model assignment guidelines, and hardening requirements.
  Read `references/schema.md` in the skill for the complete YAML field reference.

  **Input documents — read ALL before writing anything:**

  The DISCOVERY.md has been delivered to this room. The remaining four spec
  documents are in the project repository. Clone the repo at
  https://github.com/Lezzur/accounting-service.git (main branch) and read:

  1. `PRD-numera-accounting.md` — Product requirements (features, user personas,
     state specs, acceptance criteria)
  2. `TECH-SPEC-numera-accounting.md` — Technical specification (architecture,
     Supabase schema, AI pipeline, Gmail integration, monorepo structure, failure modes)
  3. `API-SPEC-numera-accounting.md` — API contracts (PostgREST patterns, Edge
     Function endpoints, request/response schemas, error shapes)
  4. `UI-DESIGN-numera-accounting.md` — UI design (15 screens, design tokens,
     component inventory, Stitch screen IDs)
  5. `DISCOVERY.md` — Discovery brief (locked decisions, workflows, design system)

  Register all five as `input_files` in the plan YAML:
  - `prd` → PRD-numera-accounting.md
  - `tech-spec` → TECH-SPEC-numera-accounting.md
  - `api-spec` → API-SPEC-numera-accounting.md
  - `ui-design` → UI-DESIGN-numera-accounting.md
  - `discovery` → DISCOVERY.md

  **Project summary:**

  Numera is a web-based accounting platform for a two-person PH-based bookkeeping
  and tax preparation firm. Three surfaces:

  - **Marketing website** — Mobile-first lead generation. Contact form + Cal.com
    booking embed. SSR for SEO. No auth.
  - **CRM module** (inside Toolbox app) — Desktop-first. Lead pipeline with 7
    stages (Lead → Contacted → Call Booked → Proposal Sent → Negotiation →
    Closed Won / Closed Lost). Client profiles with onboarding data. Task tracker.
    Invoice creation and sending via Gmail. Follow-up email drafting with AI.
  - **Workdesk module** (inside Toolbox app) — Desktop-first. AI-powered
    email-to-transaction pipeline: Gmail push notifications → email classification →
    Claude Vision OCR → structured data extraction → transaction data grid
    (spreadsheet-like, inline editing, bulk operations) → accountant review and
    approval. Financial report generation (P&L, balance sheet, cash flow, bank
    reconciliation, AR/AP aging, general ledger, trial balance). BIR tax form
    preparation (2551Q, 2550M/Q, 1701, 1701Q, 1702, 1702Q, withholding forms).
    Deadline tracker. Document preview. Export to PDF and Google Sheets.

  Stack: Next.js 14+ (App Router), TypeScript strict, Tailwind CSS, shadcn/ui,
  Supabase (PostgreSQL + Auth + Storage + Edge Functions), Claude API (Vision +
  structured output), Gmail API, Turborepo monorepo, Vercel deployment.
  Single-tenant. Solo developer (Rick).

  **Plan construction rules:**

  1. Use specific `context_sources` sections per task — never send `["all"]`
     unless the task genuinely needs the entire document. Be surgical with
     token budget.

  2. Target ~35-40% Opus / ~60-65% Sonnet model split:
     - Opus: Supabase schema design, auth + RLS policies, AI pipeline
       orchestration (OCR → categorization → approval), Edge Function
       architecture, complex business logic (report generation SQL, BIR
       form calculation), Gmail integration
     - Sonnet: monorepo scaffolding, Tailwind/shadcn config, marketing
       site pages, standard CRUD UI, static content, design token setup,
       straightforward frontend components

  3. Every task producing business logic must include a **Hardening
     requirements** section with directives specific to that task type.
     Reference the hardening table in the barker-plan skill (API routes,
     database, auth, file I/O, external services, UI, config). Generic
     "handle errors properly" is not acceptable.

  4. Task prompts must be fully self-contained — Barker runs /clear after
     each task. No references to "the previous task" or "what we set up
     earlier." Every prompt must tell the instance which existing files to
     read and what to build, with exact file paths.

  5. No "run the tests", "verify it works", or "make sure it builds" in
     task prompts. The Validation Phase handles all testing and verification.

  6. Split any task that would exceed ~40 prompt lines or ~5 expected files
     using the a/b/c chunking convention with chained depends_on.

  7. Expected files must not conflict between parallel tasks (tasks with no
     dependency chain between them). If two tasks write to the same file,
     one must depend on the other.

  8. Done checks must be cheap — file existence (`test -f`), quick compiles,
     schema validation. Never full test suites.

  9. Include phase_check commands at meaningful gates: `pnpm run type-check`
     after Foundation, `npx supabase db lint` after database phases, etc.

  **Evaluation rubric — your plan will be evaluated against these three
  passes. Design to pass all of them:**

  PASS 1 — STRUCTURAL INTEGRITY (pass/fail):
  Valid YAML with one fenced code block. project/input_files/phases/validation
  blocks all present. Unique kebab-case task IDs with phase prefix (p1-, p2-).
  Valid dependency graph: all depends_on refs resolve, no cycles, no self-refs,
  at least one entry point. Context source aliases match input_files aliases.
  Validation block has non-empty checks array with build command.

  PASS 2 — BUILD QUALITY (warning/blocking):
  Model assignments match task complexity (~35-40% Opus). Tasks scoped to 5-30
  min with <40 line prompts and <5 expected files. Prompts fully self-contained
  with explicit file paths and no test/verify commands. Hardening section on
  every business-logic task with task-type-specific directives. Validation block
  covers build + typecheck + lint + hardening audit. No file conflicts between
  parallel tasks. Done checks cheap and meaningful.

  PASS 3 — SPEC ALIGNMENT (warning/blocking):
  Every PRD feature/requirement has an implementing task. Architecture matches
  Tech Spec decisions. Every API Spec endpoint group has a task. Every UI Design
  screen has a frontend task. No silently omitted requirements. Edge cases from
  PRD appear in hardening sections.

  **Versioning:** Name the plan `BARKER-PLAN-numera-accounting.md`. If a revision
  document has been delivered to this room (from the evaluation stage), read it
  completely, then produce a revised plan addressing every blocking issue. Preserve
  all task IDs from the previous version. Add new tasks with new IDs only. Note
  which revision issues you addressed at the top of the plan's human-readable
  summary section.

  **Output:** Upload the plan to the project repository at
  https://github.com/Lezzur/accounting-service.git on branch agent/tony-stark.

### 2. Plan Evaluation
- room: numera-plan-eval
- output: plan-eval-verdict.md
- assigned: l-lawliet
- agents: l-lawliet, shikamaru
- requires: BARKER-PLAN-numera-accounting.md
- source: DISCOVERY.md
- feeds: numera-barker-plan
- reasoning: extended
- kickoff: |
  Evaluate the Barker build plan for the Numera Accounting Service.

  Use the **barker-evaluate skill** — follow its exact three-pass evaluation
  process (Structural Integrity → Build Quality → Spec Alignment), output
  format (structured markdown with pass/fail tables and itemized findings),
  and verdict rules.

  **Inputs delivered to this room:**
  - `BARKER-PLAN-numera-accounting.md` — the plan under review
  - `DISCOVERY.md` — source of truth for locked architectural decisions

  **Additional inputs — read from the project repository:**
  Clone https://github.com/Lezzur/accounting-service.git (main branch) and read:
  1. `PRD-numera-accounting.md` — cross-reference for feature coverage
  2. `TECH-SPEC-numera-accounting.md` — cross-reference for architecture alignment
  3. `API-SPEC-numera-accounting.md` — cross-reference for endpoint coverage
  4. `UI-DESIGN-numera-accounting.md` — cross-reference for screen coverage

  Also read the **barker-plan skill** guidelines (specifically `references/schema.md`)
  to verify the plan follows the correct YAML schema, field conventions, task
  structure rules, and prompt requirements.

  **Three-pass evaluation:**

  PASS 1 — STRUCTURAL INTEGRITY (binary pass/fail — any failure is blocking):

  - YAML validity: exactly one fenced YAML code block, parses without errors,
    project block has name/description/working_directory, input_files array
    exists, phases array has at least one phase, validation block exists
  - Task identity: every task has a unique ID, IDs are kebab-case with phase
    prefix (p1-, p2-), every task has all required fields (id, name, model,
    depends_on, estimated_minutes, prompt, expected_files), model is "opus"
    or "sonnet", depends_on is always an array
  - Dependency graph: every depends_on entry references a task ID that exists,
    no circular dependencies, no self-references, at least one task has empty
    depends_on (entry point), no reverse cross-phase dependencies
  - Context sources: every alias references a defined input_files alias, every
    sections array contains valid strings, no gratuitous sections: ["all"]
  - Validation block: checks is non-empty array of strings, fix_budget is
    positive integer, build command is present

  PASS 2 — BUILD QUALITY (each check produces warning or blocking):

  - Model assignment balance: ~35-40% Opus. Opus assigned to architecture,
    auth, data model, complex business logic, AI pipeline, security-critical
    code. Sonnet assigned to CRUD, config, boilerplate, styling, standard UI,
    docs. BLOCKING if Sonnet on security-critical work. WARNING if ratio off
    by <15%.
  - Task granularity: estimated_minutes 5-30, prompts <40 lines, <5 expected
    files, no multi-concern tasks. Large tasks use a/b/c chunking. BLOCKING
    if tasks obviously oversized (>50 lines, >8 files).
  - Prompt quality: self-contained (no "previous task" refs), tells instance
    to read existing files, specifies exact output file paths, NO "run tests"
    or "verify" commands, does not repeat context_sources content verbatim.
    BLOCKING for test/verify commands.
  - Hardening coverage: every business-logic task has a Hardening requirements
    section with task-type-specific directives (API: input validation + error
    codes; DB: connection errors + missing records; Auth: expired tokens +
    fail-closed; UI: loading/error/empty states; External: timeouts + retry).
    BLOCKING if missing on auth/security/data tasks. WARNING on others.
  - Validation block quality: checks include build, typecheck (tsc --noEmit),
    test runner, linter. Validator prompt includes hardening audit checklist.
    Context sources give Validator broad access. BLOCKING if no build check
    or no hardening audit.
  - File conflict safety: no overlapping expected_files between parallel tasks
    (tasks with no dependency chain). BLOCKING if unresolved conflicts.
  - Done/phase checks: done_check commands are cheap (file existence, quick
    compile). Phase checks are meaningful gates. WARNING for expensive checks.

  PASS 3 — SPEC ALIGNMENT (requires all 4 spec documents):

  - PRD coverage: every feature/requirement in the PRD has at least one
    implementing task. Non-functional requirements addressed in hardening.
    Edge cases from PRD appear in hardening sections. WARNING for minor gaps,
    BLOCKING for missing core features.
  - Tech Spec alignment: architecture decisions reflected in task structure,
    data model has database task(s), deployment strategy addressed, tech
    stack in prompts matches spec. BLOCKING for architectural mismatches.
  - API Spec coverage: every endpoint group has a corresponding task, error
    response patterns in hardening, auth requirements covered. WARNING for
    minor endpoint gaps, BLOCKING for missing core endpoint groups.
  - UI Design coverage: every screen has a frontend task, component patterns
    referenced in prompts, loading/error/empty states in hardening, responsive
    requirements addressed. WARNING for minor gaps, BLOCKING for missing
    primary screens (transaction grid, lead pipeline, etc.).

  **Verdicts — issue exactly one:**

  1. **SHIP** — Zero blocking issues. Plan is ready for `barker run`.
     Warnings are acceptable if minor (ratio slightly off, one borderline
     task size). Produce the full evaluation document and state SHIP.

  2. **SHIP WITH NOTES** — Zero blocking issues but warnings worth
     surfacing. List all warnings with specific details. Rick (product
     owner) will make the final call: accept as-is or treat as REVISE.

  3. **REVISE** — One or more blocking issues. Produce the full evaluation
     document, then append a structured revision manifest:

     For each issue:
     ```
     **R[N]** | [BLOCKING/WARNING] | [structural/build-quality/spec-alignment]
     Affected tasks: [task IDs, or "global"]
     Description: [what's wrong — quote the relevant plan text]
     Required fix: [specific, actionable instruction]
     Acceptance criteria: [how to verify the fix was applied]
     ```

  **Revision protocol:**
  - Maximum 3 revision cycles total.
  - Label which plan version you are evaluating: v1, v2, or v3.
  - On re-evaluations (v2, v3): first verify every previous blocking issue
    is resolved, then check for regressions introduced by the revisions,
    then run the full three-pass evaluation on the new version.
  - After 3 revision cycles with remaining blockers: issue a final REVISE
    verdict and escalate to Rick with a summary of unresolved issues and
    your recommendation on whether to proceed despite them or redesign.

  **Output:** Produce `plan-eval-verdict.md` following the barker-evaluate
  skill's output format. Upload to the project repository at
  https://github.com/Lezzur/accounting-service.git on branch agent/l-lawliet.

---

## Revision Protocol (Operational Notes)

This pipeline uses a **review loop** with a maximum of **3 revision cycles**.

**Initial flow (automated by pipeline):**
1. Room 1 (numera-barker-plan) produces `BARKER-PLAN-numera-accounting.md`
2. Pipeline delivers the plan to Room 2 (numera-plan-eval)
3. Room 2 evaluates and produces `plan-eval-verdict.md`
4. Pipeline delivers the verdict back to Room 1 (via `feeds`)

**If verdict is SHIP:** Pipeline complete. Plan is ready for `barker run`.

**If verdict is SHIP WITH NOTES:** Rick reviews the warnings in the verdict
and decides: accept (pipeline complete) or treat as REVISE (revision cycle).

**If verdict is REVISE:** The revision manifest in `plan-eval-verdict.md` is
delivered to Room 1 automatically (via `feeds`). The planner reads the revision
document and produces a revised plan. The revised plan must be delivered to
Room 2 for re-evaluation. This handoff requires manual coordination (Rick or
Dee delivers the revised plan to Room 2 and prompts re-evaluation).

**Revision cycle count:** Track as v1, v2, v3. Hard stop at 3 cycles. After
cycle 3, any remaining blockers escalate to Rick for a final decision.
