-- =============================================================================
-- Drop redundant system_rules composite index
-- =============================================================================
-- Purpose:
-- - public.system_rules already has a unique index on (category, key)
-- - idx_system_rules_category_key duplicates the same btree shape
-- - Keep the unique index and remove only the redundant non-unique copy
-- =============================================================================

DROP INDEX IF EXISTS public.idx_system_rules_category_key;
