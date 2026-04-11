-- Remote-first ledger import draft:
-- create_incident_reports_table
--
-- Based on src/database/migrations/003_create_incident_reports_table.sql,
-- but trimmed to the current hosted schema and made non-destructive.

CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  severity varchar(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  pattern varchar(50),
  affected_servers text[] NOT NULL DEFAULT '{}'::text[],
  anomalies jsonb NOT NULL DEFAULT '[]'::jsonb,
  root_cause_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  resolution_actions jsonb DEFAULT '[]'::jsonb,
  status varchar(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  notifications_sent boolean DEFAULT false,
  notification_channels text[] DEFAULT '{}'::text[],
  last_notification_at timestamptz,
  detection_time_ms integer,
  generation_time_ms integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_created_at
  ON public.incident_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_reports_severity
  ON public.incident_reports (severity);

CREATE INDEX IF NOT EXISTS idx_incident_reports_status
  ON public.incident_reports (status);

CREATE INDEX IF NOT EXISTS idx_incident_reports_pattern
  ON public.incident_reports (pattern);

CREATE INDEX IF NOT EXISTS idx_incident_reports_affected_servers
  ON public.incident_reports USING gin (affected_servers);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all incident reports" ON public.incident_reports;
CREATE POLICY "Users can view all incident reports"
  ON public.incident_reports
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create incident reports" ON public.incident_reports;
CREATE POLICY "Users can create incident reports"
  ON public.incident_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update assigned reports" ON public.incident_reports;
CREATE POLICY "Users can update assigned reports"
  ON public.incident_reports
  FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (assigned_to = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "Service role has full access to incident reports" ON public.incident_reports;
CREATE POLICY "Service role has full access to incident reports"
  ON public.incident_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
