import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SEARCH_KNOWLEDGE_TEXT_CONTRACT_MIGRATION = fileURLToPath(
  new URL(
    '../../../../supabase/migrations/20260426181500_extend_search_knowledge_text_contract.sql',
    import.meta.url
  )
);

const SEARCH_KNOWLEDGE_TEXT_RECALL_MIGRATION = fileURLToPath(
  new URL(
    '../../../../supabase/migrations/20260510024218_improve_search_knowledge_text_recall.sql',
    import.meta.url
  )
);

const SEARCH_KNOWLEDGE_TEXT_PRECISION_MIGRATION = fileURLToPath(
  new URL(
    '../../../../supabase/migrations/20260510025317_tune_search_knowledge_text_precision.sql',
    import.meta.url
  )
);

function readContractMigration(): string {
  expect(existsSync(SEARCH_KNOWLEDGE_TEXT_CONTRACT_MIGRATION)).toBe(true);
  return readFileSync(SEARCH_KNOWLEDGE_TEXT_CONTRACT_MIGRATION, 'utf8');
}

function readRecallMigration(): string {
  expect(existsSync(SEARCH_KNOWLEDGE_TEXT_RECALL_MIGRATION)).toBe(true);
  return readFileSync(SEARCH_KNOWLEDGE_TEXT_RECALL_MIGRATION, 'utf8');
}

function readPrecisionMigration(): string {
  expect(existsSync(SEARCH_KNOWLEDGE_TEXT_PRECISION_MIGRATION)).toBe(true);
  return readFileSync(SEARCH_KNOWLEDGE_TEXT_PRECISION_MIGRATION, 'utf8');
}

function removedVectorRuntimeTerms(): string[] {
  return [
    ['query', 'embedding'].join('_'),
    ['search', 'knowledge', 'base'].join('_'),
    ['hybrid', 'graph', 'vector', 'search'].join('_'),
  ];
}

describe('Knowledge Retrieval Lite SQL contract', () => {
  it('extends search_knowledge_text with metadata fields used by runtime boosts', () => {
    const sql = readContractMigration();

    expect(sql).toContain('CREATE FUNCTION public.search_knowledge_text');
    expect(sql).toMatch(/severity\s+TEXT/i);
    expect(sql).toMatch(/related_server_types\s+TEXT\[\]/i);
    expect(sql).toMatch(/metadata\s+JSONB/i);
    expect(sql).toContain('COALESCE(kb.metadata');
    expect(sql).toContain('COALESCE(kb.related_server_types');
  });

  it('keeps incident retrieval adjacent to troubleshooting runbooks', () => {
    const sql = readContractMigration();

    expect(sql).toContain(
      "p_filter_category IN ('incident', 'troubleshooting')"
    );
    expect(sql).toContain(
      "kb.category IN ('incident', 'troubleshooting', 'best_practice')"
    );
  });

  it('adds relaxed token-prefix recall without replacing KRL with vector search', () => {
    const sql = readRecallMigration();

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.search_knowledge_text');
    expect(sql).toContain("to_tsquery('simple', string_agg(token || ':*', ' | '))");
    expect(sql).toContain('regexp_split_to_array');
    expect(sql).toContain('primary_match');
    expect(sql).toContain('relaxed_rank * 0.65');
    for (const term of removedVectorRuntimeTerms()) {
      expect(sql.toLowerCase()).not.toContain(term);
    }
  });

  it('prioritizes token overlap to reduce broad relaxed fallback noise', () => {
    const sql = readPrecisionMigration();

    expect(sql).toContain('query_tokens text[]');
    expect(sql).toContain('token_stats.token_match_count');
    expect(sql).toContain('LEAST(ranked.token_match_count, 3) * 0.035');
    expect(sql).toContain('ranked.token_match_count DESC');
    for (const term of removedVectorRuntimeTerms()) {
      expect(sql.toLowerCase()).not.toContain(term);
    }
  });
});
