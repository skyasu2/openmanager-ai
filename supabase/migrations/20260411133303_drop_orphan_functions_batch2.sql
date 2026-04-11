DROP FUNCTION IF EXISTS public.add_server_log(text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.cleanup_old_logs(integer);
DROP FUNCTION IF EXISTS public.cleanup_old_metrics(integer);
DROP FUNCTION IF EXISTS public.update_compression_metadata(text, text, jsonb);
DROP FUNCTION IF EXISTS public.update_conversation_updated_at();
DROP FUNCTION IF EXISTS public.update_server_metrics_updated_at();
DROP FUNCTION IF EXISTS public.get_active_patterns(character varying);
DROP FUNCTION IF EXISTS public.get_latest_bottlenecks(integer);
DROP FUNCTION IF EXISTS public.calculate_system_health_score();
DROP FUNCTION IF EXISTS public.exec_sql(text);

DROP VIEW IF EXISTS public.query_statistics;
