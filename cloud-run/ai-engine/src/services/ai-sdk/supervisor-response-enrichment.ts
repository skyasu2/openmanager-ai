/**
 * Supervisor Response Enrichment
 *
 * Post-processing module that enriches LLM responses with missing evidence
 * from tool results without requiring a costly LLM retry.
 *
 * When quality flags indicate missing patterns (e.g., MISSING_METRIC_EVIDENCE),
 * this module extracts relevant data from collected tool results and appends
 * a structured supplement to the response.
 *
 * @version 1.0.0
 * @created 2026-05-16
 */

import { logger } from '../../lib/logger';

export interface CollectedToolResultForEnrichment {
  toolName: string;
  result: unknown;
}

interface EnrichmentResult {
  enrichedResponse: string;
  enrichmentApplied: boolean;
  enrichmentSections: string[];
}

interface CommandLike {
  command?: unknown;
  name?: unknown;
  description?: unknown;
  purpose?: unknown;
  safety?: unknown;
}

const UNSAFE_AUTOMATIC_COMMAND_PATTERN =
  /(?:^|\s)(?:rm|kill|mount|umount)\s|service\s+restart|systemctl\s+restart|clear cache|journalctl\s+--vacuum|apt(?:-get)?\s+clean|sysctl\s+-w/i;

function isSafeAutomaticGuidanceCommand(command: string, safety?: unknown) {
  if (safety === 'read-only') {
    return true;
  }

  if (typeof safety === 'string' && safety !== 'read-only') {
    return false;
  }

  return !UNSAFE_AUTOMATIC_COMMAND_PATTERN.test(command);
}

/**
 * Extract metric summary from server metrics tool results.
 */
function extractMetricSummaryFromResult(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const record = result as Record<string, unknown>;

  // Handle getServerMetrics / getServerMetricsAdvanced results
  if (record.globalSummary && typeof record.globalSummary === 'object') {
    const gs = record.globalSummary as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof gs.cpu_avg === 'number') parts.push(`CPU 평균 ${Math.round(gs.cpu_avg)}%`);
    if (typeof gs.cpu_max === 'number') parts.push(`CPU 최대 ${Math.round(gs.cpu_max)}%`);
    if (typeof gs.memory_avg === 'number') parts.push(`메모리 평균 ${Math.round(gs.memory_avg)}%`);
    if (typeof gs.disk_avg === 'number') parts.push(`디스크 평균 ${Math.round(gs.disk_avg)}%`);
    if (parts.length > 0) return parts.join(', ');
  }

  // Handle server array results
  if (Array.isArray(record.servers)) {
    const servers = record.servers as Array<Record<string, unknown>>;
    if (servers.length === 0) return undefined;
    const topServers = servers.slice(0, 3);
    return topServers
      .map((s) => {
        const name = s.name || s.serverId || s.id || 'unknown';
        const parts: string[] = [];
        if (typeof s.cpu === 'number') parts.push(`CPU ${Math.round(s.cpu as number)}%`);
        if (typeof s.memory === 'number') parts.push(`메모리 ${Math.round(s.memory as number)}%`);
        if (typeof s.disk === 'number') parts.push(`디스크 ${Math.round(s.disk as number)}%`);
        return parts.length > 0 ? `${name}: ${parts.join(', ')}` : undefined;
      })
      .filter(Boolean)
      .join(' | ');
  }

  // Handle single server result
  if (typeof record.cpu === 'number' || typeof record.memory === 'number') {
    const parts: string[] = [];
    const name = record.name || record.serverId || '';
    if (typeof record.cpu === 'number') parts.push(`CPU ${Math.round(record.cpu as number)}%`);
    if (typeof record.memory === 'number') parts.push(`메모리 ${Math.round(record.memory as number)}%`);
    if (typeof record.disk === 'number') parts.push(`디스크 ${Math.round(record.disk as number)}%`);
    return name ? `${name}: ${parts.join(', ')}` : parts.join(', ');
  }

  return undefined;
}

/**
 * Extract server names/IDs from tool results.
 */
function extractServerReferences(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const record = result as Record<string, unknown>;

  if (Array.isArray(record.servers)) {
    const servers = record.servers as Array<Record<string, unknown>>;
    const names = servers
      .slice(0, 5)
      .map((s) => s.name || s.serverId || s.id)
      .filter(Boolean)
      .map(String);
    if (names.length > 0) {
      const suffix = servers.length > 5 ? ` 외 ${servers.length - 5}대` : '';
      return names.join(', ') + suffix;
    }
  }

  return undefined;
}

/**
 * Extract action guidance from tool results (commands, suggestions).
 */
function extractActionGuidance(
  toolResults: CollectedToolResultForEnrichment[]
): string | undefined {
  const commandResult = toolResults.find(
    (tr) => tr.toolName === 'recommendCommands'
  );
  if (!commandResult?.result || typeof commandResult.result !== 'object')
    return undefined;

  const record = commandResult.result as Record<string, unknown>;
  const commandItems = Array.isArray(record.commands)
    ? record.commands
    : Array.isArray(record.recommendations)
      ? record.recommendations
      : [];

  if (commandItems.length > 0) {
    const guidance = (commandItems as CommandLike[])
      .map((cmd) => {
        const command = String(cmd.command || cmd.name || '').trim();
        const desc = String(cmd.description || cmd.purpose || '').trim();
        return { command, desc, safety: cmd.safety };
      })
      .filter(({ command, safety }) =>
        command
          ? isSafeAutomaticGuidanceCommand(command, safety)
          : false
      )
      .slice(0, 3)
      .map(({ command, desc }) => {
        return desc ? `\`${command}\` — ${desc}` : `\`${command}\``;
      })
      .join('\n');

    return guidance.length > 0
      ? `${guidance}\n\n변경/삭제/재시작 명령은 결과 확인 후 승인된 절차로만 실행하세요.`
      : undefined;
  }

  return undefined;
}

/**
 * Enrich a supervisor response by appending missing evidence from tool results.
 *
 * This function checks quality flags and supplements the response only when
 * the corresponding evidence is available in tool results. It never fabricates data.
 *
 * @param response     - The original LLM response text
 * @param qualityFlags - Flags from evaluateAgentResponseQuality
 * @param toolResults  - Collected tool results from execution
 * @returns Enriched response with optional supplements
 */
export function enrichResponseWithToolResults(
  response: string,
  qualityFlags: string[],
  toolResults: CollectedToolResultForEnrichment[]
): EnrichmentResult {
  if (qualityFlags.length === 0 || toolResults.length === 0) {
    return {
      enrichedResponse: response,
      enrichmentApplied: false,
      enrichmentSections: [],
    };
  }

  let enriched = response;
  const appliedSections: string[] = [];

  // 1. MISSING_METRIC_EVIDENCE — append metric data from tool results
  if (
    qualityFlags.includes('MISSING_METRIC_EVIDENCE') ||
    qualityFlags.includes('MISSING_PERCENT_EVIDENCE')
  ) {
    const metricTools = [
      'getServerMetrics',
      'getServerMetricsAdvanced',
      'filterServers',
      'getServerByGroup',
    ];
    const metricResult = toolResults.find((tr) =>
      metricTools.includes(tr.toolName)
    );
    if (metricResult) {
      const summary = extractMetricSummaryFromResult(metricResult.result);
      if (summary) {
        enriched += `\n\n📊 **참고 수치**: ${summary}`;
        appliedSections.push('metric_evidence');
      }
    }
  }

  // 2. MISSING_SERVER_REFERENCE — append server names
  if (qualityFlags.includes('MISSING_SERVER_REFERENCE')) {
    const serverTools = [
      'getServerMetrics',
      'getServerMetricsAdvanced',
      'filterServers',
      'getServerByGroup',
    ];
    const serverResult = toolResults.find((tr) =>
      serverTools.includes(tr.toolName)
    );
    if (serverResult) {
      const refs = extractServerReferences(serverResult.result);
      if (refs) {
        enriched += `\n\n🖥️ **관련 서버**: ${refs}`;
        appliedSections.push('server_reference');
      }
    }
  }

  // 3. MISSING_ACTION_GUIDANCE / MISSING_STEP_GUIDE — append recommended actions
  if (
    qualityFlags.includes('MISSING_ACTION_GUIDANCE') ||
    qualityFlags.includes('MISSING_STEP_GUIDE')
  ) {
    const guidance = extractActionGuidance(toolResults);
    if (guidance) {
      enriched += `\n\n🔧 **권장 조치**:\n${guidance}`;
      appliedSections.push('action_guidance');
    }
  }

  const enrichmentApplied = appliedSections.length > 0;

  if (enrichmentApplied) {
    logger.info(
      { sections: appliedSections, flagCount: qualityFlags.length },
      '[ResponseEnrichment] Applied post-processing enrichments'
    );
  }

  return {
    enrichedResponse: enriched,
    enrichmentApplied,
    enrichmentSections: appliedSections,
  };
}
