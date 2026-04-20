# Migrations — conventions

Every SQL statement in this directory must be **idempotent**: safe to re-run against a database where the object may or may not already exist.

This isn't academic. Migrations here are sometimes applied via Studio SQL Editor, sometimes via `supabase db push`. When the two paths drift, re-applying raw `CREATE X` fails with `already exists` and blocks every subsequent migration until someone patches it. Building idempotency in from day one avoids that.

## Cheatsheet

| Statement | Guard |
|---|---|
| `CREATE TABLE` | `CREATE TABLE IF NOT EXISTS` |
| `CREATE INDEX` (and `CREATE UNIQUE INDEX`) | `CREATE INDEX IF NOT EXISTS` |
| `CREATE TRIGGER foo ON bar` | prepend `DROP TRIGGER IF EXISTS foo ON bar;` |
| `CREATE POLICY foo ON bar` | prepend `DROP POLICY IF EXISTS foo ON bar;` |
| `CREATE FUNCTION` | use `CREATE OR REPLACE FUNCTION` |
| `ALTER TABLE ... ADD COLUMN` | `ADD COLUMN IF NOT EXISTS` |
| `ALTER TABLE ... ADD CONSTRAINT` | prepend `ALTER TABLE ... DROP CONSTRAINT IF EXISTS name;` |
| `INSERT INTO ... VALUES (...)` | append `ON CONFLICT (unique_key) DO NOTHING` (or `DO UPDATE` if update-on-conflict is the intent) |
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | already idempotent |

When Postgres doesn't natively support a guard (e.g. `CREATE TYPE`, some `ALTER TABLE` forms), wrap in a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END; $$;` block.

## Version numbers

One migration file per integer prefix (`013_`, `014_`, etc.). **Two files with the same numeric prefix will collide** — Supabase's `schema_migrations` table uses the prefix as the primary key, and the second file to apply will fail with `duplicate key value violates unique constraint "schema_migrations_pkey"`. Always pick the next unused number.

## New migration checklist

Before committing a new migration:

1. Every `CREATE` / `ALTER ADD` / `INSERT` has its guard per the cheatsheet above.
2. Filename prefix is unique and one higher than the current max.
3. Running the file twice in a row on a fresh DB produces the same end state with no errors.
4. If the migration adds columns that app code reads, run `npx supabase gen types typescript --project-id <ref> --schema public > ../../packages/db/src/types.generated.ts` and update `packages/db/src/types.ts` so TypeScript sees the new shape.

## Why the whole set of 001-024 was retrofitted

Earlier migrations were written against a single known-empty DB and never stress-tested for re-apply. When `supabase db push` was run against the live project in April 2026 (the project had drifted via Studio edits), every migration from 013 onward failed serially. The retrofit fixed all of them in one pass; treat this README as the agreed convention going forward so we don't pay the same cost again.
