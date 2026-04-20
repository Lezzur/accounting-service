-- 008_create_tasks.sql
-- Accountant to-dos linked to leads or clients

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  due_date date NOT NULL,
  linked_entity_type text CHECK (linked_entity_type IN ('lead', 'client')),
  linked_entity_id uuid,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date) WHERE status != 'done';
CREATE INDEX IF NOT EXISTS idx_tasks_linked ON tasks(linked_entity_type, linked_entity_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_all_authenticated" ON tasks;
CREATE POLICY "tasks_all_authenticated"
  ON tasks FOR ALL
  USING (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
