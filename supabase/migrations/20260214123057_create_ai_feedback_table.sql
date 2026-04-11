-- Remote-first ledger import draft:
-- create_ai_feedback_table
--
-- Recreated from the current hosted schema and runtime contract in
-- src/app/api/ai/feedback/route.ts.

CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  type text NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  session_id text,
  trace_id text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_timestamp
  ON public.ai_feedback ("timestamp" DESC);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.ai_feedback;
CREATE POLICY "Service role full access"
  ON public.ai_feedback
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
