-- Remote-first ledger import draft:
-- create_system_rules_table
--
-- Recreated from the current hosted schema and runtime usage in
-- src/config/rules/loader.ts.

CREATE TABLE IF NOT EXISTS public.system_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  enabled boolean DEFAULT true,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS system_rules_category_key_key
  ON public.system_rules (category, key);

CREATE INDEX IF NOT EXISTS idx_system_rules_category_key
  ON public.system_rules (category, key);

ALTER TABLE public.system_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_rules_read_access ON public.system_rules;
CREATE POLICY system_rules_read_access
  ON public.system_rules
  FOR SELECT
  TO public
  USING (true);
