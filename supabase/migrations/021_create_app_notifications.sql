-- 021_create_app_notifications.sql
-- General-purpose in-app notification table

CREATE TABLE app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('new_lead', 'task_due', 'system')),
  title text NOT NULL,
  body text,
  metadata jsonb DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_notif_unread ON app_notifications(created_at DESC) WHERE read = false;

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_notifications_select ON app_notifications
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY app_notifications_update ON app_notifications
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY app_notifications_insert_service ON app_notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
