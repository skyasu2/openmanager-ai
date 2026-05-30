import { logger } from '../../../lib/logger';
import type { AllServerAnomalyScanResult } from '../../../tools-ai-sdk/analyst-tools-detect-all';

export const ANALYST_PREFETCH_PROMPT_MARKER =
  '[Analyst precomputed anomaly evidence]';

const MAX_PROMPT_CHARS = 2_000;
const MAX_ANOMALIES = 6;
const MAX_RISING_TRENDS = 4;

function formatSummary(result: AllServerAnomalyScanResult): string {
  return [
    `totalServers: ${result.totalServers}`,
    `anomalyCount: ${result.anomalyCount}`,
    `affectedServers: ${result.affectedServers.length ? result.affectedServers.join(', ') : 'none'}`,
    `summary: online=${result.summary.onlineCount}, warning=${result.summary.warningCount}, critical=${result.summary.criticalCount}, offline=${result.summary.offlineCount ?? 0}`,
    `timestamp: ${result.timestamp}`,
    `analysisBasis: ${result.analysisBasis}`,
  ].join('\n');
}

function formatAnomalies(result: AllServerAnomalyScanResult): string {
  if (!result.anomalies.length) return '- none';

  return result.anomalies
    .slice(0, MAX_ANOMALIES)
    .map(
      (item) =>
        `- ${item.server_id} (${item.server_name}): ${item.metric}=${item.value}, severity=${item.severity}`
    )
    .join('\n');
}

function formatRisingTrends(result: AllServerAnomalyScanResult): string {
  const trends = result.risingTrendScan.risingTrends.slice(0, MAX_RISING_TRENDS);
  if (!trends.length) {
    return `risingTrendScan: method=${result.risingTrendScan.method}, horizonHours=${result.risingTrendScan.horizonHours}, riskCount=0`;
  }

  return [
    `risingTrendScan: method=${result.risingTrendScan.method}, horizonHours=${result.risingTrendScan.horizonHours}, riskCount=${result.risingTrendScan.riskCount}`,
    ...trends.map(
      (item) =>
        `- ${item.serverId} ${item.metric}: current=${item.currentValue}, projected30m=${item.projectedValue30m}, warningThreshold=${item.warningThreshold}, risk=${item.riskLevel}`
    ),
  ].join('\n');
}

export function buildAnalystEvidencePrefetchPrompt(
  result: AllServerAnomalyScanResult
): string {
  const prompt = [
    ANALYST_PREFETCH_PROMPT_MARKER,
    'Analyst precomputed anomaly evidence',
    'Source: deterministic runAllServerAnomalyScan(metricType: "all") executed before the first LLM step.',
    'Do not call detectAnomaliesAllServers again unless this evidence is absent, stale, or explicitly contradicted by user-provided current metrics.',
    '',
    formatSummary(result),
    '',
    'Top anomalies:',
    formatAnomalies(result),
    '',
    formatRisingTrends(result),
  ].join('\n');

  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;
  return `${prompt.slice(0, MAX_PROMPT_CHARS - 80)}\n[truncated: deterministic Analyst evidence exceeded prompt budget]`;
}

export async function maybeBuildAnalystEvidencePrefetchPrompt({
  agentName,
  existingPrompt,
}: {
  agentName: string;
  existingPrompt?: string;
}): Promise<string | undefined> {
  if (agentName !== 'Analyst Agent') return undefined;
  if (existingPrompt?.includes(ANALYST_PREFETCH_PROMPT_MARKER)) {
    return undefined;
  }

  try {
    const { runAllServerAnomalyScan } = await import(
      '../../../tools-ai-sdk/analyst-tools-detect-all.js'
    );
    const result = await runAllServerAnomalyScan({ metricType: 'all' });
    return buildAnalystEvidencePrefetchPrompt(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[AnalystEvidencePrefetch] skipped: ${message}`);
    return undefined;
  }
}
