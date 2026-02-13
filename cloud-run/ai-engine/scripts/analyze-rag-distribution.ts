/**
 * Analyze RAG knowledge_base distribution for monitoring assistant quality.
 *
 * Usage:
 *   npx tsx scripts/analyze-rag-distribution.ts
 *
 * Notes:
 * - Automatically loads ENV_FILE, .env.local, .env (near scripts/cwd)
 * - Supabase credentials still required via env values
 */

import './_env';
import { createClient } from '@supabase/supabase-js';

type KnowledgeRow = {
  title: string | null;
  category: string | null;
  severity: string | null;
  source: string | null;
  content: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
};

function getEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function getSupabaseEnv() {
  const url =
    getEnv('SUPABASE_URL') ||
    getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key =
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SERVICE_KEY');

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return { url, key };
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printRows(rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    console.log('(no rows)');
    return;
  }
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
}

async function main() {
  const { url, key } = getSupabaseEnv();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('knowledge_base')
    .select('title, category, severity, source, content, tags, metadata');

  if (error) {
    throw new Error(`knowledge_base fetch failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? (data as KnowledgeRow[]) : [];

  printSection('Source x Category');
  const sourceCategoryMap = new Map<string, number>();
  for (const row of rows) {
    const source = row.source || 'unknown';
    const category = row.category || 'unknown';
    const key = `${source}|||${category}`;
    sourceCategoryMap.set(key, (sourceCategoryMap.get(key) || 0) + 1);
  }
  printRows(
    Array.from(sourceCategoryMap.entries())
      .map(([key, cnt]) => {
        const [source, category] = key.split('|||');
        return { source, category, cnt };
      })
      .sort((a, b) => Number(b.cnt) - Number(a.cnt))
  );

  printSection('Severity Distribution');
  const severityMap = new Map<string, number>();
  for (const row of rows) {
    const source = row.source || 'unknown';
    const category = row.category || 'unknown';
    const severity = row.severity || 'unknown';
    const key = `${source}|||${category}|||${severity}`;
    severityMap.set(key, (severityMap.get(key) || 0) + 1);
  }
  printRows(
    Array.from(severityMap.entries())
      .map(([key, cnt]) => {
        const [source, category, severity] = key.split('|||');
        return { source, category, severity, cnt };
      })
      .sort((a, b) => {
        if (a.source !== b.source) return a.source.localeCompare(b.source);
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.severity.localeCompare(b.severity);
      })
  );

  printSection('Potentially Short Command Docs');
  const commandRows = rows.filter(
    (row) => row.category === 'command' && row.source === 'command_vectors_migration'
  );
  const shortCommandRows = commandRows
    .filter((row) => (row.content || '').trim().length < 120)
    .map((row) => ({
      title: row.title || '',
      source: row.source || '',
      category: row.category || '',
      content_len: (row.content || '').trim().length,
    }))
    .sort((a, b) => Number(a.content_len) - Number(b.content_len))
    .slice(0, 30);
  printRows(shortCommandRows);

  printSection('Command Length Stats');
  const commandLengths = commandRows.map((row) => (row.content || '').trim().length);
  const totalCommandDocs = commandLengths.length;
  const shortLt120 = commandLengths.filter((len) => len < 120).length;
  const shortLt180 = commandLengths.filter((len) => len < 180).length;
  const avgLength = totalCommandDocs
    ? Math.round(commandLengths.reduce((acc, len) => acc + len, 0) / totalCommandDocs)
    : 0;
  printRows([
    {
      total_command_docs: totalCommandDocs,
      avg_content_len: avgLength,
      short_lt_120: shortLt120,
      short_lt_180: shortLt180,
    },
  ]);

  printSection('Duplicate Titles');
  const duplicateMap = new Map<string, number>();
  for (const row of rows) {
    const title = (row.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const category = row.category || 'unknown';
    const source = row.source || 'unknown';
    const key = `${category}|||${source}|||${title}`;
    duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
  }
  printRows(
    Array.from(duplicateMap.entries())
      .filter(([, cnt]) => cnt > 1)
      .map(([key, dup_count]) => {
        const [category, source, normalized_title] = key.split('|||');
        return { category, source, normalized_title, dup_count };
      })
      .sort((a, b) => Number(b.dup_count) - Number(a.dup_count))
  );

  printSection('Destructive Command Flags');
  printRows(
    rows
      .filter(
        (row) =>
          row.category === 'command' &&
          ['docker system prune'].includes((row.title || '').trim().toLowerCase())
      )
      .map((row) => ({
        title: row.title || '',
        tags: row.tags || [],
        risk_level:
          row.metadata && typeof row.metadata.risk_level === 'string'
            ? row.metadata.risk_level
            : null,
        requires_confirmation:
          row.metadata && typeof row.metadata.requires_confirmation !== 'undefined'
            ? String(row.metadata.requires_confirmation)
            : null,
      }))
  );

  printSection('Summary');
  console.log(`total_docs=${rows.length}`);
  console.log(
    'Review command ratio, duplicate titles, and destructive command flags before further RAG tuning.'
  );
}

main().catch((error) => {
  console.error('[FATAL] analyze-rag-distribution failed:', error);
  process.exit(1);
});
