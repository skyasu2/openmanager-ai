/**
 * Goldset-based RAG quality evaluation (monitoring assistant).
 *
 * Compares rag_on(useGraphRAG=true) vs rag_off(useGraphRAG=false)
 * on fixed query goldset with simple lexical/category scoring.
 *
 * Usage:
 *   npx tsx scripts/rag-eval-goldset.ts
 *
 * Notes:
 * - Automatically loads ENV_FILE, .env.local, .env (near scripts/cwd)
 */

import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './_env';
import { searchKnowledgeBase } from '../src/tools-ai-sdk/reporter-tools/knowledge';

type Mode = 'rag_on' | 'rag_off';

type GoldsetCase = {
  id: string;
  query: string;
  expectedCategories: string[];
  requiredKeywords: string[];
  commandIntent: boolean;
};

type RagItem = {
  title: string;
  content: string;
  category: string;
  similarity: number;
  sourceType: string;
};

type EvalResult = {
  success: boolean;
  latencyMs: number;
  totalFound: number;
  commandRatio: number;
  contextChars: number;
  estimatedTokens: number;
  categoryCoverage: number;
  keywordCoverage: number;
  qualityScore: number;
  destructiveLeak: boolean;
  error?: string;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function parseItems(output: unknown): RagItem[] {
  const root = asObject(output);
  if (!root || !Array.isArray(root.results)) return [];

  return root.results
    .map((item) => asObject(item))
    .filter((item): item is Record<string, unknown> => !!item)
    .map((row) => ({
      title: String(row.title ?? ''),
      content: String(row.content ?? ''),
      category: String(row.category ?? 'unknown'),
      similarity: Number(row.similarity ?? 0),
      sourceType: String(row.sourceType ?? 'unknown'),
    }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function computeCategoryCoverage(items: RagItem[], expectedCategories: string[]): number {
  if (expectedCategories.length === 0) return 1;
  const categories = new Set(items.map((item) => item.category.toLowerCase()));
  let hit = 0;
  for (const expected of expectedCategories) {
    if (categories.has(expected.toLowerCase())) hit += 1;
  }
  return hit / expectedCategories.length;
}

function computeKeywordCoverage(items: RagItem[], requiredKeywords: string[]): number {
  if (requiredKeywords.length === 0) return 1;
  const haystack = items
    .map((item) => `${item.title}\n${item.content}`.toLowerCase())
    .join('\n');
  let hit = 0;
  for (const keyword of requiredKeywords) {
    if (haystack.includes(keyword.toLowerCase())) hit += 1;
  }
  return hit / requiredKeywords.length;
}

function hasDestructiveCommand(items: RagItem[]): boolean {
  return items.some((item) => item.title.trim().toLowerCase() === 'docker system prune');
}

function computeQualityScore(
  commandIntent: boolean,
  categoryCoverage: number,
  keywordCoverage: number,
  commandRatio: number,
  destructiveLeak: boolean
): number {
  if (commandIntent) {
    const score =
      0.55 * commandRatio +
      0.30 * keywordCoverage +
      0.15 * categoryCoverage;
    return clamp01(score);
  }

  let score =
    0.45 * categoryCoverage +
    0.40 * keywordCoverage +
    0.15 * (1 - commandRatio);

  if (commandRatio > 0.4) score -= 0.15;
  if (destructiveLeak) score -= 0.25;
  return clamp01(score);
}

async function runCase(mode: Mode, testCase: GoldsetCase): Promise<EvalResult> {
  const start = performance.now();
  try {
    const output = await searchKnowledgeBase.execute!(
      {
        query: testCase.query,
        useGraphRAG: mode === 'rag_on',
        fastMode: true,
        includeWebSearch: false,
      },
      { toolCallId: `rag-goldset-${mode}-${testCase.id}`, messages: [] }
    );

    const allItems = parseItems(output);
    const items = allItems.slice(0, 5);
    const latencyMs = performance.now() - start;
    const commandCount = items.filter((item) => item.category === 'command').length;
    const commandRatio = items.length > 0 ? commandCount / items.length : 0;
    const contextChars = items.reduce((acc, item) => acc + item.content.length, 0);
    const categoryCoverage = computeCategoryCoverage(items, testCase.expectedCategories);
    const keywordCoverage = computeKeywordCoverage(items, testCase.requiredKeywords);
    const destructiveLeak = !testCase.commandIntent && hasDestructiveCommand(items);
    const qualityScore = computeQualityScore(
      testCase.commandIntent,
      categoryCoverage,
      keywordCoverage,
      commandRatio,
      destructiveLeak
    );

    return {
      success: true,
      latencyMs,
      totalFound: items.length,
      commandRatio,
      contextChars,
      estimatedTokens: estimateTokens(contextChars),
      categoryCoverage,
      keywordCoverage,
      qualityScore,
      destructiveLeak,
    };
  } catch (error) {
    return {
      success: false,
      latencyMs: performance.now() - start,
      totalFound: 0,
      commandRatio: 0,
      contextChars: 0,
      estimatedTokens: 0,
      categoryCoverage: 0,
      keywordCoverage: 0,
      qualityScore: 0,
      destructiveLeak: false,
      error: String(error),
    };
  }
}

function summarize(results: EvalResult[]) {
  const success = results.filter((r) => r.success);
  return {
    runs: results.length,
    successRuns: success.length,
    avgLatencyMs: average(success.map((r) => r.latencyMs)),
    p95LatencyMs: percentile(success.map((r) => r.latencyMs), 95),
    avgQualityScore: average(success.map((r) => r.qualityScore)),
    avgCategoryCoverage: average(success.map((r) => r.categoryCoverage)),
    avgKeywordCoverage: average(success.map((r) => r.keywordCoverage)),
    avgCommandRatio: average(success.map((r) => r.commandRatio)),
    avgEstimatedTokens: average(success.map((r) => r.estimatedTokens)),
    destructiveLeaks: success.filter((r) => r.destructiveLeak).length,
  };
}

async function loadGoldset(): Promise<GoldsetCase[]> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, './data/rag-goldset.monitoring.json');
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid goldset format: expected array');
  }

  return parsed.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      id: String(row.id ?? ''),
      query: String(row.query ?? ''),
      expectedCategories: Array.isArray(row.expectedCategories)
        ? row.expectedCategories.map((v) => String(v))
        : [],
      requiredKeywords: Array.isArray(row.requiredKeywords)
        ? row.requiredKeywords.map((v) => String(v))
        : [],
      commandIntent: Boolean(row.commandIntent),
    };
  });
}

async function main() {
  const goldset = await loadGoldset();
  console.log(`Goldset loaded: ${goldset.length} cases`);

  const rows: Array<{
    id: string;
    query: string;
    commandIntent: boolean;
    rag_on: EvalResult;
    rag_off: EvalResult;
  }> = [];

  for (const testCase of goldset) {
    const ragOn = await runCase('rag_on', testCase);
    const ragOff = await runCase('rag_off', testCase);
    rows.push({
      id: testCase.id,
      query: testCase.query,
      commandIntent: testCase.commandIntent,
      rag_on: ragOn,
      rag_off: ragOff,
    });
  }

  const ragOnSummary = summarize(rows.map((r) => r.rag_on));
  const ragOffSummary = summarize(rows.map((r) => r.rag_off));

  const delta = {
    quality: ragOnSummary.avgQualityScore - ragOffSummary.avgQualityScore,
    latency_ms: ragOnSummary.avgLatencyMs - ragOffSummary.avgLatencyMs,
    estimated_tokens: ragOnSummary.avgEstimatedTokens - ragOffSummary.avgEstimatedTokens,
    command_ratio: ragOnSummary.avgCommandRatio - ragOffSummary.avgCommandRatio,
  };

  console.log('\n=== Per Case (quality/latency/tokens) ===');
  for (const row of rows) {
    console.log(
      JSON.stringify({
        id: row.id,
        query: row.query,
        command_intent: row.commandIntent,
        rag_on: {
          quality: Number(row.rag_on.qualityScore.toFixed(3)),
          latency_ms: Math.round(row.rag_on.latencyMs),
          tokens: row.rag_on.estimatedTokens,
        },
        rag_off: {
          quality: Number(row.rag_off.qualityScore.toFixed(3)),
          latency_ms: Math.round(row.rag_off.latencyMs),
          tokens: row.rag_off.estimatedTokens,
        },
      })
    );
  }

  console.log('\n=== Summary ===');
  console.log(JSON.stringify({ mode: 'rag_on', ...ragOnSummary }, null, 2));
  console.log(JSON.stringify({ mode: 'rag_off', ...ragOffSummary }, null, 2));

  console.log('\n=== Delta (rag_on - rag_off) ===');
  console.log(JSON.stringify(delta, null, 2));
}

main().catch((error) => {
  console.error('[FATAL] rag-eval-goldset failed:', error);
  process.exit(1);
});
