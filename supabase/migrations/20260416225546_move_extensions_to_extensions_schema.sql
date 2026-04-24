-- Move vector and pg_trgm from public schema to extensions schema
--
-- Rationale: Supabase security advisor lint 0014 flags extensions installed in
-- the public schema because it widens the attack surface for privilege
-- escalation via extension functions.  Moving them to the extensions schema
-- (which is in the default search_path) keeps all existing type references and
-- operator classes working without any application-level changes.
--
-- Safety checks:
--   search_path = "$user", public, extensions  → extensions already resolvable
--   vector type columns : command_vectors.embedding, knowledge_base.embedding
--   pg_trgm GIN indexes : idx_knowledge_base_title_trgm, idx_knowledge_base_content_trgm
--   All references use unqualified names → resolved through search_path after move

ALTER EXTENSION vector   SET SCHEMA extensions;
ALTER EXTENSION pg_trgm  SET SCHEMA extensions;
