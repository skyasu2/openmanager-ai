-- =============================================================================
-- Harden RAG RPC Functions + Incident Report FK Indexes
-- =============================================================================
-- Purpose:
-- 1) Harden SECURITY DEFINER RAG RPC functions with fixed search_path
-- 2) Add missing FK indexes on incident_reports for better join/update performance
-- =============================================================================

-- 1) SECURITY DEFINER function hardening (RAG path)
DO $$
BEGIN
    IF to_regprocedure('public.search_knowledge_base(vector,double precision,integer,text,text)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.search_knowledge_base(vector, double precision, integer, text, text) SET search_path = public, pg_temp';
    END IF;

    IF to_regprocedure('public.match_documents(vector,integer,jsonb)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.match_documents(vector, integer, jsonb) SET search_path = public, pg_temp';
    END IF;

    IF to_regprocedure('public.match_knowledge_base(text,double precision,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.match_knowledge_base(text, double precision, integer) SET search_path = public, pg_temp';
    END IF;

    IF to_regprocedure('public.hybrid_search_with_text(vector,text,double precision,double precision,double precision,double precision,integer,integer,integer,integer,text)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.hybrid_search_with_text(vector, text, double precision, double precision, double precision, double precision, integer, integer, integer, integer, text) SET search_path = public, pg_temp';
    END IF;

    IF to_regprocedure('public.hybrid_graph_vector_search(vector,double precision,integer,integer,integer)') IS NOT NULL THEN
        EXECUTE 'ALTER FUNCTION public.hybrid_graph_vector_search(vector, double precision, integer, integer, integer) SET search_path = public, pg_temp';
    END IF;
END $$;

-- 2) Add missing FK indexes for incident_reports (if table/columns exist)
DO $$
BEGIN
    IF to_regclass('public.incident_reports') IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'incident_reports'
              AND column_name = 'assigned_to'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_incident_reports_assigned_to_fk
                ON public.incident_reports (assigned_to)
                WHERE assigned_to IS NOT NULL;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'incident_reports'
              AND column_name = 'created_by'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_incident_reports_created_by_fk
                ON public.incident_reports (created_by)
                WHERE created_by IS NOT NULL;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'incident_reports'
              AND column_name = 'resolved_by'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_incident_reports_resolved_by_fk
                ON public.incident_reports (resolved_by)
                WHERE resolved_by IS NOT NULL;
        END IF;

        ANALYZE public.incident_reports;
    END IF;
END $$;
