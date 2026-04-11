-- Remote-first ledger import draft:
-- add_metadata_column_to_knowledge_base
--
-- This migration aligns the local ledger with the hosted schema, where
-- knowledge_base.metadata already exists and is used for GraphRAG enrichment.

ALTER TABLE IF EXISTS public.knowledge_base
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.knowledge_base.metadata IS
  'Additional metadata for GraphRAG (source info, related docs, server types, etc.)';
