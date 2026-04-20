-- 023_seed_dummy_deadlines.sql
-- Seed dummy deadline data across all active clients to exercise the
-- Deadline Tracker UI. Today's reference date is 2026-04-17, so the mix
-- below produces at least one row in each display-status bucket:
--   overdue     — past due_date, not completed  (e.g. annual_itr 2025 due 2026-04-15)
--   approaching — due within the next 7 days    (e.g. monthly_vat Mar 2026 due 2026-04-20)
--   in_progress — status='in_progress'          (added via CASE below)
--   upcoming    — due more than 7 days out      (April & May deliverables)
--   completed   — status='completed'            (all February deliverables + half of Q1 BIR)
--
-- Idempotent: ON CONFLICT on the (client_id, deadline_type, period_label)
-- unique index means re-running is a no-op.

WITH client_list AS (
  SELECT
    id,
    row_number() OVER (ORDER BY business_name) AS rn
  FROM clients
  WHERE status = 'active'
),
deadline_seed AS (
  SELECT * FROM (VALUES
    -- (deadline_type,          period_label,    due_date,          base_status)
    ('monthly_bookkeeping',     'February 2026', DATE '2026-03-10', 'completed'),
    ('monthly_bookkeeping',     'March 2026',    DATE '2026-04-10', 'upcoming'),      -- overdue once past due_date
    ('monthly_bookkeeping',     'April 2026',    DATE '2026-05-10', 'upcoming'),
    ('monthly_vat',             'February 2026', DATE '2026-03-20', 'completed'),
    ('monthly_vat',             'March 2026',    DATE '2026-04-20', 'in_progress'),   -- approaching
    ('monthly_vat',             'April 2026',    DATE '2026-05-20', 'upcoming'),
    ('quarterly_bir',           'Q1 2026',       DATE '2026-04-25', 'upcoming'),      -- approaching
    ('quarterly_financials',    'Q1 2026',       DATE '2026-05-15', 'upcoming'),
    ('annual_itr',              '2025',          DATE '2026-04-15', 'upcoming'),      -- overdue
    ('annual_financials',       '2025',          DATE '2026-04-30', 'upcoming')
  ) AS t(deadline_type, period_label, due_date, base_status)
)
INSERT INTO deadlines (client_id, deadline_type, period_label, due_date, status, completed_at)
SELECT
  c.id,
  d.deadline_type,
  d.period_label,
  d.due_date,
  -- Vary status per client so not every row looks identical:
  --   - Even-numbered clients have their annual_itr 2025 already filed (completed)
  --   - Odd-numbered clients still have it pending (will render overdue).
  --   - Every 3rd client has Q1 quarterly_bir already completed.
  CASE
    WHEN d.deadline_type = 'annual_itr'   AND c.rn % 2 = 0 THEN 'completed'
    WHEN d.deadline_type = 'quarterly_bir' AND c.rn % 3 = 0 THEN 'completed'
    ELSE d.base_status
  END AS status,
  CASE
    WHEN d.base_status = 'completed' THEN (d.due_date + INTERVAL '1 day')::timestamptz
    WHEN d.deadline_type = 'annual_itr'    AND c.rn % 2 = 0 THEN (d.due_date - INTERVAL '2 day')::timestamptz
    WHEN d.deadline_type = 'quarterly_bir' AND c.rn % 3 = 0 THEN (d.due_date - INTERVAL '1 day')::timestamptz
    ELSE NULL
  END AS completed_at
FROM client_list c
CROSS JOIN deadline_seed d
ON CONFLICT (client_id, deadline_type, period_label) DO NOTHING;
