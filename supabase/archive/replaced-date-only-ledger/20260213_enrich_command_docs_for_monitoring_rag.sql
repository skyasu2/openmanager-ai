-- =============================================================================
-- Enrich command docs with monitoring context (RAG quality uplift)
-- =============================================================================
-- Purpose:
-- 1) Increase semantic density of short command docs for monitoring assistant RAG
-- 2) Keep free-tier friendly: in-place update only, no new tables/indexes
-- =============================================================================

UPDATE public.knowledge_base kb
SET
    content = concat_ws(
        E'\n\n',
        kb.content,
        '## 운영 모니터링 맥락',
        format(
            '- 이 명령은 %s 장애 분석 시 1차 확인용으로 사용합니다.',
            COALESCE(kb.category, '시스템')
        ),
        '- 실행 전/후 지표(CPU, 메모리, 디스크, 네트워크) 변화를 함께 확인합니다.',
        '- 단일 결과로 결론 내리지 말고 로그/메트릭과 교차 검증합니다.',
        '## 안전 체크리스트',
        CASE
            WHEN lower(trim(kb.title)) IN ('docker system prune') THEN '- 이 명령은 데이터/이미지 삭제 가능성이 있으므로 운영환경에서는 사전 승인 후 실행합니다.'
            ELSE '- 운영환경에서는 읽기 전용 옵션 또는 범위를 제한한 옵션을 우선 사용합니다.'
        END,
        '- 피크 시간대에는 부하가 큰 옵션 사용을 피하고, 필요 시 점진적으로 실행합니다.'
    ),
    metadata = COALESCE(kb.metadata, '{}'::jsonb) || jsonb_build_object(
        'quality_patch', 'command_context_v1',
        'quality_patched_at', now()::text
    ),
    tags = CASE
        WHEN kb.tags @> ARRAY['monitoring_context_enriched']::text[] THEN kb.tags
        ELSE kb.tags || ARRAY['monitoring_context_enriched']::text[]
    END
WHERE kb.source = 'command_vectors_migration'
  AND kb.category = 'command'
  AND COALESCE(kb.metadata->>'quality_patch', '') <> 'command_context_v1';
