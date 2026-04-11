-- Restore security_audit_logs without depending on user_profiles/security_threats
-- Context:
-- - Remote project `vnswjnltnhpsueosfhmw` is missing `security_audit_logs`
-- - Historical migration `20250819_enhanced_security_hardening.sql` is broader and
--   depends on tables that do not exist in the current hosted schema

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  user_role text,
  action_type varchar(50) NOT NULL,
  resource_type varchar(50) NOT NULL,
  resource_id text,
  ip_address inet,
  user_agent text,
  request_method varchar(10),
  request_path text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id
  ON public.security_audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action_type
  ON public.security_audit_logs (action_type);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at
  ON public.security_audit_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_resource
  ON public.security_audit_logs (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ip
  ON public.security_audit_logs (ip_address);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'security_audit_logs'
      AND policyname = 'Users can view own audit logs'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can view own audit logs"
      ON public.security_audit_logs
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'security_audit_logs'
      AND policyname = 'System can insert audit logs'
  ) THEN
    EXECUTE '
      CREATE POLICY "System can insert audit logs"
      ON public.security_audit_logs
      FOR INSERT
      TO service_role
      WITH CHECK (true)
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'security_audit_logs'
         AND policyname = 'Admin only access to audit logs'
     ) THEN
    EXECUTE '
      CREATE POLICY "Admin only access to audit logs"
      ON public.security_audit_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_profiles
          WHERE user_id = auth.uid()
            AND role IN (''admin'', ''owner'')
        )
      )
    ';
  END IF;
END $$;

COMMENT ON TABLE public.security_audit_logs IS
  'Security audit log for auth and other privileged actions';
