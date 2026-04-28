/**
 * @vitest-environment node
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HARDENING_MIGRATION = fileURLToPath(
  new URL(
    '../../../supabase/migrations/20260428101907_harden_supabase_rag_public_surface.sql',
    import.meta.url
  )
);

const SERVICE_ONLY_FUNCTIONS = [
  'public.search_knowledge_text(text,integer,text)',
  'public.search_knowledge_base(extensions.vector,double precision,integer,text,text)',
  'public.hybrid_graph_vector_search(extensions.vector,double precision,integer,integer,integer)',
  'public.hybrid_search_vectors(extensions.vector,text,double precision,integer)',
  'public.hybrid_search_with_text(extensions.vector,text,double precision,double precision,double precision,double precision,integer,integer,integer,integer,text)',
  'public.match_documents(extensions.vector,integer,jsonb)',
  'public.match_knowledge_base(text,double precision,integer)',
  'public.get_approval_history(approval_status,approval_action_type,integer,integer,timestamp with time zone,timestamp with time zone)',
  'public.get_approval_stats(integer)',
];

const SERVER_ONLY_TABLES = [
  'ai_feedback',
  'approval_history',
  'command_vectors',
  'incident_reports',
  'knowledge_base',
  'knowledge_relationships',
  'security_audit_logs',
  'system_rules',
  'vector_documents_stats',
];

function readMigration(): string {
  expect(existsSync(HARDENING_MIGRATION)).toBe(true);
  return readFileSync(HARDENING_MIGRATION, 'utf8');
}

function compactSql(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .trim()
    .toLowerCase();
}

describe('Supabase security hardening migration contract', () => {
  it('limits KRL and legacy RAG RPC execution to service role', () => {
    const sql = compactSql(readMigration());

    expect(sql).toContain(
      'revoke execute on function %s from public,anon,authenticated'
    );
    expect(sql).toContain('grant execute on function %s to service_role');

    for (const fn of SERVICE_ONLY_FUNCTIONS) {
      expect(sql).toContain(`to_regprocedure('${fn}')`);
    }
  });

  it('removes direct anon/authenticated table privileges for server-only tables', () => {
    const sql = compactSql(readMigration());

    for (const table of SERVER_ONLY_TABLES) {
      expect(sql).toContain(
        `revoke all privileges on table public.${table} from public,anon,authenticated`
      );
      expect(sql).toContain(
        `grant all privileges on table public.${table} to service_role`
      );
    }
  });

  it('drops only unused vector-era indexes and preserves BM25 search vector index', () => {
    const sql = compactSql(readMigration());

    expect(sql).toContain(
      'drop index if exists public.idx_knowledge_base_embedding_hnsw;'
    );
    expect(sql).toContain(
      'drop index if exists public.idx_knowledge_base_content_trgm;'
    );
    expect(sql).toContain(
      'drop index if exists public.idx_command_vectors_embedding_hnsw;'
    );
    expect(sql).not.toContain(
      'drop index if exists public.idx_knowledge_base_search_vector;'
    );
  });

  it('does not delete Supabase data structures in the hardening phase', () => {
    const sql = compactSql(readMigration());

    expect(sql).not.toMatch(/\bdrop table\b/);
    expect(sql).not.toMatch(/\bdrop column\b[^;]*\bembedding\b/);
  });
});
