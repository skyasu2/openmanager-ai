import { CONTEXT_CONFIG, getOrCreateSessionContext, getSessionContext, saveSessionContext } from './context-store-core';
import { logger } from '../../../lib/logger';
import type {
  AnomalyData,
  HandoffEvent,
  MetricSnapshot,
  RootCauseData,
} from './context-store-types';

export async function recordHandoffEvent(
  sessionId: string,
  from: string,
  to: string,
  reason?: string,
  additionalContext?: string
): Promise<void> {
  const context = await getOrCreateSessionContext(sessionId);

  const handoff: HandoffEvent = {
    from,
    to,
    reason,
    context: additionalContext,
    timestamp: new Date().toISOString(),
  };

  context.handoffs = [...context.handoffs, handoff].slice(-CONTEXT_CONFIG.maxHandoffs);
  context.lastAgent = to;
  context.updatedAt = new Date().toISOString();

  await saveSessionContext(context);
  logger.info(`[ContextStore] Handoff: ${from} -> ${to} (${reason || 'no reason'})`);
}

export async function appendAnomalies(sessionId: string, anomalies: AnomalyData[]): Promise<void> {
  if (anomalies.length === 0) {
    return;
  }

  const context = await getOrCreateSessionContext(sessionId);

  const existingKeys = new Set(context.findings.anomalies.map((anomaly) => `${anomaly.serverId}:${anomaly.metric}`));

  const newAnomalies = anomalies.filter(
    (anomaly) => !existingKeys.has(`${anomaly.serverId}:${anomaly.metric}`)
  );

  context.findings.anomalies = [...context.findings.anomalies, ...newAnomalies].slice(
    -CONTEXT_CONFIG.maxAnomalies
  );

  context.updatedAt = new Date().toISOString();
  await saveSessionContext(context);

  logger.info(
    `[ContextStore] Added ${newAnomalies.length} anomalies (total: ${context.findings.anomalies.length})`
  );
}

export async function setRootCause(sessionId: string, rootCause: RootCauseData): Promise<void> {
  const context = await getOrCreateSessionContext(sessionId);
  context.findings.rootCause = rootCause;
  context.updatedAt = new Date().toISOString();
  await saveSessionContext(context);

  logger.info(
    `[ContextStore] Root cause set: ${rootCause.cause} (${(rootCause.confidence * 100).toFixed(0)}%)`
  );
}

export async function appendAffectedServers(sessionId: string, serverIds: string[]): Promise<void> {
  if (serverIds.length === 0) {
    return;
  }

  const context = await getOrCreateSessionContext(sessionId);

  const existingSet = new Set(context.findings.affectedServers);
  const newServers = serverIds.filter((id) => !existingSet.has(id));

  context.findings.affectedServers = [...context.findings.affectedServers, ...newServers];
  context.updatedAt = new Date().toISOString();
  await saveSessionContext(context);

  logger.info(
    `[ContextStore] Added ${newServers.length} affected servers (total: ${context.findings.affectedServers.length})`
  );
}

export async function appendMetrics(sessionId: string, metrics: MetricSnapshot[]): Promise<void> {
  if (metrics.length === 0) {
    return;
  }

  const context = await getOrCreateSessionContext(sessionId);

  const metricsMap = new Map<string, MetricSnapshot>();
  for (const metric of context.findings.metrics) {
    metricsMap.set(metric.serverId, metric);
  }
  for (const metric of metrics) {
    metricsMap.set(metric.serverId, metric);
  }

  context.findings.metrics = Array.from(metricsMap.values()).slice(-CONTEXT_CONFIG.maxMetrics);
  context.updatedAt = new Date().toISOString();
  await saveSessionContext(context);

  logger.info(
    `[ContextStore] Updated metrics for ${metrics.length} servers (total: ${context.findings.metrics.length})`
  );
}

export async function appendKnowledgeResults(sessionId: string, results: string[]): Promise<void> {
  if (results.length === 0) {
    return;
  }

  const context = await getOrCreateSessionContext(sessionId);

  const existingSet = new Set(context.findings.knowledgeResults);
  const newResults = results.filter((result) => !existingSet.has(result));

  context.findings.knowledgeResults = [...context.findings.knowledgeResults, ...newResults].slice(-20);

  context.updatedAt = new Date().toISOString();
  await saveSessionContext(context);

  logger.info(`[ContextStore] Added ${newResults.length} knowledge results`);
}

export async function appendRecommendedCommands(
  sessionId: string,
  commands: string[]
): Promise<void> {
  if (commands.length === 0) {
    return;
  }

  const context = await getOrCreateSessionContext(sessionId);

  const existingSet = new Set(context.findings.recommendedCommands);
  const newCommands = commands.filter((command) => !existingSet.has(command));

  context.findings.recommendedCommands = [
    ...context.findings.recommendedCommands,
    ...newCommands,
  ].slice(-20);

  context.updatedAt = new Date().toISOString();
  await saveSessionContext(context);

  logger.info(`[ContextStore] Added ${newCommands.length} recommended commands`);
}

export async function getContextSummary(sessionId: string): Promise<string | null> {
  const context = await getSessionContext(sessionId);
  if (!context) {
    return null;
  }

  const parts: string[] = [];

  if (context.handoffs.length > 0) {
    const lastHandoffs = context.handoffs.slice(-3);
    parts.push('## 이전 에이전트 핸드오프');
    for (const handoff of lastHandoffs) {
      parts.push(`- ${handoff.from} → ${handoff.to}: ${handoff.reason || '(no reason)'}`);
    }
  }

  if (context.findings.anomalies.length > 0) {
    parts.push('\n## 발견된 이상');
    const topAnomalies = context.findings.anomalies.slice(-5);
    for (const anomaly of topAnomalies) {
      parts.push(
        `- **${anomaly.serverName}** (${anomaly.metric}): ${anomaly.value}% (임계: ${anomaly.threshold}%) - ${anomaly.severity}`
      );
    }
  }

  if (context.findings.rootCause) {
    const rootCause = context.findings.rootCause;
    parts.push('\n## 근본 원인 분석');
    parts.push(`- **원인**: ${rootCause.cause}`);
    parts.push(`- **신뢰도**: ${(rootCause.confidence * 100).toFixed(0)}%`);
    parts.push(`- **제안**: ${rootCause.suggestedFix}`);
  }

  if (context.findings.affectedServers.length > 0) {
    parts.push('\n## 영향받은 서버');
    parts.push(
      `총 ${context.findings.affectedServers.length}대: ${context.findings.affectedServers
        .slice(0, 5)
        .join(', ')}${context.findings.affectedServers.length > 5 ? '...' : ''}`
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join('\n');
}
