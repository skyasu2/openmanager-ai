-- Backfill remaining command_vectors rows into the current KRL text corpus.
--
-- Context:
-- - Runtime retrieval uses public.search_knowledge_text over public.knowledge_base.
-- - command_vectors is legacy inventory. Some rows were already copied into
--   knowledge_base with tags like `cv:<id>`, but production still has a small
--   remainder only present in command_vectors.
-- - This migration is data-preserving: it does not drop vector data or tables.

DO $$
BEGIN
    IF to_regclass('public.knowledge_base') IS NULL THEN
        RAISE EXCEPTION 'knowledge_base table is required for command vector backfill';
    END IF;

    IF to_regclass('public.command_vectors') IS NULL THEN
        RAISE NOTICE 'command_vectors table is absent; skipping command vector backfill';
    END IF;
END $$;

WITH source_rows AS (
    SELECT
        cv.id,
        cv.content,
        cv.metadata,
        COALESCE(NULLIF(cv.metadata->>'category', ''), 'command') AS command_category,
        COALESCE(
            (
                SELECT array_agg(command_text ORDER BY command_text)
                FROM (
                    SELECT DISTINCT trim(command_text) AS command_text
                    FROM jsonb_array_elements_text(
                        CASE
                            WHEN jsonb_typeof(cv.metadata->'commands') = 'array'
                            THEN cv.metadata->'commands'
                            ELSE '[]'::jsonb
                        END
                    ) AS command_text
                    WHERE trim(command_text) <> ''
                ) commands
            ),
            ARRAY[]::text[]
        ) AS commands,
        COALESCE(
            (
                SELECT array_agg(DISTINCT normalized_tag ORDER BY normalized_tag)
                FROM (
                    SELECT lower(
                        regexp_replace(
                            trim(raw_tag),
                            '[^0-9a-zA-Z가-힣_+./-]+',
                            '-',
                            'g'
                        )
                    ) AS normalized_tag
                    FROM (
                        SELECT jsonb_array_elements_text(
                            CASE
                                WHEN jsonb_typeof(cv.metadata->'tags') = 'array'
                                THEN cv.metadata->'tags'
                                ELSE '[]'::jsonb
                            END
                        ) AS raw_tag
                        UNION ALL
                        SELECT jsonb_array_elements_text(
                            CASE
                                WHEN jsonb_typeof(cv.metadata->'commands') = 'array'
                                THEN cv.metadata->'commands'
                                ELSE '[]'::jsonb
                            END
                        ) AS raw_tag
                        UNION ALL
                        SELECT COALESCE(NULLIF(cv.metadata->>'category', ''), 'command') AS raw_tag
                    ) raw_tags
                ) normalized_tags
                WHERE normalized_tag <> ''
            ),
            ARRAY[]::text[]
        ) AS normalized_tags
    FROM public.command_vectors cv
    WHERE to_regclass('public.command_vectors') IS NOT NULL
),
prepared_rows AS (
    SELECT
        id,
        ('Command: ' || id) AS title,
        concat_ws(
            E'\n\n',
            content,
            CASE
                WHEN array_length(commands, 1) > 0
                THEN '주요 명령어: ' || array_to_string(commands, ', ')
                ELSE NULL
            END,
            '운영 활용: 이 문서는 legacy command_vectors에서 Knowledge Retrieval Lite corpus로 이관된 명령어 지식입니다. AI 어시스턴트는 현재 벡터 유사도 대신 search_knowledge_text 텍스트 검색과 태그 기반 근거 매핑으로 이 내용을 찾습니다.',
            '주의: 실제 실행 전 대상 서버의 OS, 권한, 서비스 이름, 보존 정책을 확인하고 삭제성 명령은 dry-run 또는 범위 제한 옵션을 먼저 적용합니다.'
        ) AS content,
        'command'::text AS category,
        ARRAY(
            SELECT DISTINCT tag
            FROM unnest(
                ARRAY[
                    'from_command_vectors',
                    'cv:' || id,
                    command_category
                ] || normalized_tags
            ) AS tag
            WHERE tag IS NOT NULL AND tag <> ''
            ORDER BY tag
        ) AS tags,
        'info'::text AS severity,
        'command_vectors_migration'::text AS source,
        ARRAY[]::text[] AS related_server_types,
        COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'origin', 'command_vectors',
            'command_id', id,
            'command_category', command_category,
            'backfilled_by', '20260510032441_backfill_remaining_command_vectors_to_knowledge_base'
        ) AS metadata
    FROM source_rows
)
INSERT INTO public.knowledge_base (
    title,
    content,
    category,
    tags,
    severity,
    source,
    related_server_types,
    metadata,
    search_vector
)
SELECT
    title,
    content,
    category,
    tags,
    severity,
    source,
    related_server_types,
    metadata,
    public.generate_knowledge_search_vector(title, content, tags)
FROM prepared_rows pr
WHERE NOT EXISTS (
    SELECT 1
    FROM public.knowledge_base kb
    WHERE kb.source = 'command_vectors_migration'
      AND kb.tags @> ARRAY['cv:' || pr.id]
)
AND NOT EXISTS (
    SELECT 1
    FROM public.knowledge_base kb
    WHERE kb.source = 'command_vectors_migration'
      AND kb.metadata->>'origin' = 'command_vectors'
      AND kb.metadata->>'command_id' = pr.id
);
