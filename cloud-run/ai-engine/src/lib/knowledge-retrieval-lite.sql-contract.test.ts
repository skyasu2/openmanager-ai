import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SEARCH_KNOWLEDGE_TEXT_CONTRACT_MIGRATION = fileURLToPath(
  new URL(
    '../../../../supabase/migrations/20260426181500_extend_search_knowledge_text_contract.sql',
    import.meta.url
  )
);

function readContractMigration(): string {
  expect(existsSync(SEARCH_KNOWLEDGE_TEXT_CONTRACT_MIGRATION)).toBe(true);
  return readFileSync(SEARCH_KNOWLEDGE_TEXT_CONTRACT_MIGRATION, 'utf8');
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
});
