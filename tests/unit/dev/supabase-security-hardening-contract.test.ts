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

const LEGACY_RPC_CLEANUP_MIGRATION = fileURLToPath(
  new URL(
    '../../../supabase/migrations/20260510022419_drop_legacy_vector_graph_rag_rpcs.sql',
    import.meta.url
  )
);

const LEGACY_HELPER_CLEANUP_MIGRATION = fileURLToPath(
  new URL(
    '../../../supabase/migrations/20260510030704_drop_remaining_legacy_vector_graph_helpers.sql',
    import.meta.url
  )
);

const COMMAND_VECTOR_BACKFILL_MIGRATION = fileURLToPath(
  new URL(
    '../../../supabase/migrations/20260510032441_backfill_remaining_command_vectors_to_knowledge_base.sql',
    import.meta.url
  )
);

const LOW_VALUE_INDEX_CLEANUP_MIGRATION = fileURLToPath(
  new URL(
    '../../../supabase/migrations/20260510034213_drop_low_value_unused_operational_indexes.sql',
    import.meta.url
  )
);

const LEGACY_GRAPHRAG_INVENTORY_CLEANUP_MIGRATION = fileURLToPath(
  new URL(
    '../../../supabase/migrations/20260515000000_drop_legacy_graphrag_inventory.sql',
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

const LEGACY_VECTOR_GRAPH_RAG_FUNCTIONS = [
  'public.search_knowledge_base(extensions.vector,double precision,integer,text,text)',
  'public.hybrid_graph_vector_search(extensions.vector,double precision,integer,integer,integer)',
  'public.hybrid_search_vectors(extensions.vector,text,double precision,integer)',
  'public.hybrid_search_with_text(extensions.vector,text,double precision,double precision,double precision,double precision,integer,integer,integer,integer,text)',
  'public.match_documents(extensions.vector,integer,jsonb)',
  'public.match_knowledge_base(text,double precision,integer)',
];

const REMAINING_LEGACY_VECTOR_GRAPH_HELPER_FUNCTIONS = [
  'public.get_knowledge_neighbors(uuid,text,knowledge_relationship_type[],integer)',
  'public.get_vector_stats()',
  'public.search_all_commands(extensions.vector,integer)',
  'public.search_all_commands(text)',
  'public.search_similar_commands(extensions.vector,double precision,integer)',
  'public.search_similar_vectors(extensions.vector,double precision,integer)',
  'public.search_vectors_by_category(extensions.vector,text,double precision,integer)',
  'public.search_vectors_with_filters(extensions.vector,jsonb,double precision,integer)',
  'public.traverse_knowledge_graph(uuid,text,integer,knowledge_relationship_type[],integer)',
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

function readLegacyRpcCleanupMigration(): string {
  expect(existsSync(LEGACY_RPC_CLEANUP_MIGRATION)).toBe(true);
  return readFileSync(LEGACY_RPC_CLEANUP_MIGRATION, 'utf8');
}

function readLegacyHelperCleanupMigration(): string {
  expect(existsSync(LEGACY_HELPER_CLEANUP_MIGRATION)).toBe(true);
  return readFileSync(LEGACY_HELPER_CLEANUP_MIGRATION, 'utf8');
}

function readCommandVectorBackfillMigration(): string {
  expect(existsSync(COMMAND_VECTOR_BACKFILL_MIGRATION)).toBe(true);
  return readFileSync(COMMAND_VECTOR_BACKFILL_MIGRATION, 'utf8');
}

function readLowValueIndexCleanupMigration(): string {
  expect(existsSync(LOW_VALUE_INDEX_CLEANUP_MIGRATION)).toBe(true);
  return readFileSync(LOW_VALUE_INDEX_CLEANUP_MIGRATION, 'utf8');
}

function readLegacyGraphRagInventoryCleanupMigration(): string {
  expect(existsSync(LEGACY_GRAPHRAG_INVENTORY_CLEANUP_MIGRATION)).toBe(true);
  return readFileSync(LEGACY_GRAPHRAG_INVENTORY_CLEANUP_MIGRATION, 'utf8');
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

  it('drops only unused legacy vector/graph RAG RPC functions after KRL migration', () => {
    const sql = compactSql(readLegacyRpcCleanupMigration());

    for (const fn of LEGACY_VECTOR_GRAPH_RAG_FUNCTIONS) {
      expect(sql).toContain(`to_regprocedure('${fn}')`);
    }

    expect(sql).toContain('drop function %s restrict');
    expect(sql).toContain('public.search_knowledge_text(text,integer,text)');
    expect(sql).not.toMatch(/drop function[^;]*search_knowledge_text/);
  });

  it('keeps legacy RPC cleanup idempotent and dependency-safe', () => {
    const sql = compactSql(readLegacyRpcCleanupMigration());

    expect(sql).toContain('if legacy_function is null then continue; end if;');
    expect(sql).toContain('drop function %s restrict');
    expect(sql).not.toMatch(/\bcascade\b/);
  });

  it('preserves data tables in the legacy RAG RPC cleanup phase', () => {
    const sql = compactSql(readLegacyRpcCleanupMigration());

    expect(sql).not.toMatch(/\bdrop table\b/);
    expect(sql).not.toMatch(/\bdrop column\b/);
    expect(sql).toContain('public.command_vectors');
    expect(sql).toContain('public.knowledge_relationships');
  });

  it('drops remaining unused vector/graph helper RPCs without touching KRL trigger helpers', () => {
    const sql = compactSql(readLegacyHelperCleanupMigration());

    for (const fn of REMAINING_LEGACY_VECTOR_GRAPH_HELPER_FUNCTIONS) {
      expect(sql).toContain(`to_regprocedure('${fn}')`);
    }

    expect(sql).toContain('drop function %s restrict');
    expect(sql).not.toMatch(/\bcascade\b/);
    expect(sql).toContain('public.search_knowledge_text(text,integer,text)');
    expect(sql).toContain(
      'public.generate_knowledge_search_vector(text,text,text[])'
    );
    expect(sql).toContain('public.update_knowledge_search_vector()');
    expect(sql).not.toMatch(/drop function[^;]*search_knowledge_text/);
    expect(sql).not.toMatch(
      /drop function[^;]*generate_knowledge_search_vector/
    );
    expect(sql).not.toMatch(/drop function[^;]*update_knowledge_search_vector/);
  });

  it('keeps legacy helper cleanup data-preserving and drops only the unused graph weight index', () => {
    const sql = compactSql(readLegacyHelperCleanupMigration());

    expect(sql).not.toMatch(/\bdrop table\b/);
    expect(sql).not.toMatch(/\bdrop column\b/);
    expect(sql).toContain('drop index if exists public.idx_kr_weight;');
    expect(sql).not.toContain(
      'drop index if exists public.idx_knowledge_base_search_vector;'
    );
    expect(sql).toContain("to_regclass('public.command_vectors')");
    expect(sql).toContain("to_regclass('public.knowledge_relationships')");
  });

  it('backfills remaining command vector text into KRL corpus without preserving vector coupling', () => {
    const sql = compactSql(readCommandVectorBackfillMigration());

    expect(sql).toContain('insert into public.knowledge_base');
    expect(sql).toContain('from public.command_vectors cv');
    expect(sql).toContain('command_vectors_migration');
    expect(sql).toContain('from_command_vectors');
    expect(sql).toContain("'cv:' || id");
    expect(sql).toContain('not exists');
    expect(sql).toContain("kb.tags @> array['cv:' || pr.id]");
    expect(sql).toContain('generate_knowledge_search_vector(');
    expect(sql).not.toMatch(/\bdrop table\b/);
    expect(sql).not.toMatch(/\bdrop column\b/);
    expect(sql).not.toMatch(/\bembedding\b\s*,/);
    expect(sql).not.toMatch(/cv\.embedding/);
  });

  it('defines dependency-safe legacy GraphRAG inventory cleanup while preserving KRL search', () => {
    const sql = compactSql(readLegacyGraphRagInventoryCleanupMigration());

    expect(sql).toContain("to_regprocedure('public.search_knowledge_text");
    expect(sql).toContain("to_regclass('public.knowledge_relationships')");
    expect(sql).toContain("to_regclass('public.command_vectors')");
    expect(sql).toContain(
      'drop table if exists public.knowledge_relationships'
    );
    expect(sql).toContain('drop table if exists public.command_vectors');
    expect(sql).toContain(
      'alter table public.knowledge_base drop column if exists embedding'
    );
    expect(sql).not.toMatch(/\bcascade\b/);
    expect(sql).not.toMatch(/drop function[^;]*search_knowledge_text/);
    expect(sql).not.toMatch(
      /drop function[^;]*generate_knowledge_search_vector/
    );
    expect(sql).not.toMatch(/drop function[^;]*update_knowledge_search_vector/);
  });

  it('drops only low-value unused operational indexes while preserving FK/RLS support indexes', () => {
    const sql = compactSql(readLowValueIndexCleanupMigration());

    for (const indexName of [
      'idx_incident_reports_severity',
      'idx_incident_reports_status',
      'idx_security_audit_logs_action_type',
      'idx_security_audit_logs_ip',
      'idx_approval_history_status',
      'idx_approval_history_decided_at',
    ]) {
      expect(sql).toContain(`drop index if exists public.${indexName};`);
    }

    for (const preservedIndex of [
      'idx_incident_reports_assigned_to_fk',
      'idx_incident_reports_created_by_fk',
      'idx_incident_reports_resolved_by_fk',
      'idx_security_audit_logs_user_id',
      'idx_security_audit_logs_created_at',
      'idx_security_audit_logs_resource',
      'idx_approval_history_status_time',
      'idx_approval_history_requested_at',
      'idx_approval_history_action_type',
      'idx_approval_history_session_id',
    ]) {
      expect(sql).not.toContain(
        `drop index if exists public.${preservedIndex};`
      );
    }

    expect(sql).not.toMatch(/\bdrop table\b/);
    expect(sql).not.toMatch(/\bdelete from\b/);
    expect(sql).not.toMatch(/\btruncate\b/);
  });
});
