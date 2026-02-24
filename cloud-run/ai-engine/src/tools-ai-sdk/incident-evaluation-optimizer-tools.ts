import { tool } from 'ai';
import { z } from 'zod';
import { getCurrentState, getRecentHistory } from '../data/precomputed-state';
import { logger } from '../lib/logger';
import { COMMAND_TEMPLATES } from './incident-evaluation-helpers';
import type { EnhancedAction } from './incident-evaluation-types';

export const refineRootCauseAnalysis = tool({
  description:
    '낮은 신뢰도의 근본원인 분석을 심화합니다. 추가 메트릭 분석과 서버 간 상관관계를 통해 신뢰도를 향상시킵니다.',
  inputSchema: z.object({
    serverId: z.string().describe('분석 대상 서버 ID'),
    currentCause: z.string().describe('현재 추정 원인'),
    currentConfidence: z.number().describe('현재 신뢰도'),
  }),
  execute: async ({ serverId, currentCause, currentConfidence }) => {
    logger.info(`[Optimizer] Refining root cause for ${serverId}`);

    const state = getCurrentState();
    const server = state.servers.find((s) => s.id === serverId);

    if (!server) {
      return {
        success: false,
        error: `Server not found: ${serverId}`,
      };
    }

    const additionalEvidence: string[] = [];
    let refinedCause = currentCause;
    let confidenceBoost = 0;

    if (server.cpu > 90) {
      additionalEvidence.push(`현재 CPU ${server.cpu.toFixed(1)}% (임계값 90% 초과)`);
      confidenceBoost += 0.1;
      if (!currentCause.toLowerCase().includes('cpu')) {
        refinedCause = `CPU 과부하 (${server.cpu.toFixed(1)}%) - ${currentCause}`;
      }
    }

    if (server.memory > 90) {
      additionalEvidence.push(
        `현재 Memory ${server.memory.toFixed(1)}% (임계값 90% 초과)`,
      );
      confidenceBoost += 0.1;
    }

    if (server.disk > 95) {
      additionalEvidence.push(
        `현재 Disk ${server.disk.toFixed(1)}% (임계값 95% 초과)`,
      );
      confidenceBoost += 0.1;
    }

    const history = getRecentHistory(6);
    if (history.length > 0) {
      const cpuTrend = history
        .map((h) => h.servers.find((s) => s.id === serverId)?.cpu)
        .filter((v): v is number => v !== undefined);

      if (cpuTrend.length > 0) {
        const avgCpu = cpuTrend.reduce((a, b) => a + b, 0) / cpuTrend.length;
        if (avgCpu > 85) {
          additionalEvidence.push(
            `최근 1시간 평균 CPU ${avgCpu.toFixed(1)}% (지속적 고부하)`,
          );
          confidenceBoost += 0.05;
        }

        const maxCpu = Math.max(...cpuTrend);
        const minCpu = Math.min(...cpuTrend);
        if (maxCpu - minCpu > 30) {
          additionalEvidence.push(
            `CPU 변동폭 ${(maxCpu - minCpu).toFixed(1)}% (불안정 패턴 감지)`,
          );
          confidenceBoost += 0.05;
        }
      }
    }

    const relatedServers = state.servers.filter(
      (s) => s.id !== serverId && (s.status === 'warning' || s.status === 'critical'),
    );

    if (relatedServers.length > 0) {
      additionalEvidence.push(
        `연관 이상 서버 ${relatedServers.length}대 감지 (복합 장애 가능성)`,
      );
      confidenceBoost += 0.05;
    }

    const improvedConfidence = Math.min(currentConfidence + confidenceBoost, 0.95);

    return {
      success: true,
      serverId,
      refinedCause,
      originalConfidence: currentConfidence,
      improvedConfidence,
      confidenceBoost,
      additionalEvidence,
      summary:
        improvedConfidence >= 0.75
          ? `✅ 신뢰도 향상: ${(currentConfidence * 100).toFixed(0)}% → ${(improvedConfidence * 100).toFixed(0)}%`
          : `⚠️ 추가 분석 필요: ${(improvedConfidence * 100).toFixed(0)}%`,
      timestamp: new Date().toISOString(),
    };
  },
});

export const enhanceSuggestedActions = tool({
  description:
    '일반적인 권장 조치를 CLI 명령어 포함 구체적 조치로 개선합니다. 실행 가능한 구체적 단계를 제공합니다.',
  inputSchema: z.object({
    actions: z.array(z.string()).describe('현재 권장 조치 목록'),
    focusArea: z
      .enum(['cpu', 'memory', 'disk', 'network', 'general'])
      .default('general')
      .describe('주요 문제 영역'),
  }),
  execute: async ({ actions, focusArea }) => {
    logger.info(`[Optimizer] Enhancing actions for ${focusArea}`);

    const commands = COMMAND_TEMPLATES[focusArea] || COMMAND_TEMPLATES.general;
    const enhancedActions: EnhancedAction[] = actions.map((action: string) => {
      let priority: EnhancedAction['priority'] = 'medium';
      if (/긴급|즉시|critical/i.test(action)) priority = 'critical';
      else if (/확인|점검/i.test(action)) priority = 'high';
      else if (/모니터링|관찰/i.test(action)) priority = 'low';

      const relevantCommands = commands.slice(0, 2);

      return {
        description: action,
        commands: relevantCommands,
        priority,
        estimatedImpact:
          priority === 'critical'
            ? '즉각적 문제 해결'
            : priority === 'high'
              ? '단기간 내 개선'
              : '점진적 개선',
      };
    });

    if (enhancedActions.length < 3) {
      enhancedActions.push({
        description: '시스템 로그 분석으로 추가 원인 파악',
        commands: COMMAND_TEMPLATES.general.slice(0, 2),
        priority: 'medium',
        estimatedImpact: '근본 원인 파악에 도움',
      });
    }

    return {
      success: true,
      originalCount: actions.length,
      enhancedCount: enhancedActions.length,
      enhancedActions,
      focusArea,
      summary: `✅ ${actions.length}개 조치를 CLI 명령어 포함 ${enhancedActions.length}개로 개선`,
      timestamp: new Date().toISOString(),
    };
  },
});

export const extendServerCorrelation = tool({
  description:
    '서버 간 연관성 분석을 확장합니다. 추가 패턴 감지와 cascade 영향 분석을 수행합니다.',
  inputSchema: z.object({
    primaryServerId: z.string().describe('주요 장애 서버 ID'),
    existingCorrelations: z
      .array(
        z.object({
          serverId: z.string(),
          correlatedWith: z.string(),
          correlationType: z.string(),
        }),
      )
      .default([])
      .describe('기존 연관 분석 결과'),
  }),
  execute: async ({ primaryServerId, existingCorrelations }) => {
    logger.info(`[Optimizer] Extending correlation from ${primaryServerId}`);

    const state = getCurrentState();
    const primaryServer = state.servers.find((s) => s.id === primaryServerId);

    if (!primaryServer) {
      return {
        success: false,
        error: `Server not found: ${primaryServerId}`,
      };
    }

    const newCorrelations: Array<{
      serverId: string;
      correlatedWith: string;
      correlationType: 'cascade' | 'simultaneous' | 'periodic';
      confidence: number;
      affectedMetric: string;
      description: string;
    }> = [];

    const similarServers = state.servers.filter(
      (s) => s.id !== primaryServerId && s.status === primaryServer.status,
    );

    for (const server of similarServers) {
      const alreadyCorrelated = existingCorrelations.some(
        (c: { serverId: string; correlatedWith: string; correlationType: string }) =>
          (c.serverId === primaryServerId && c.correlatedWith === server.id) ||
          (c.serverId === server.id && c.correlatedWith === primaryServerId),
      );

      if (alreadyCorrelated) continue;

      let correlationType: 'cascade' | 'simultaneous' | 'periodic' = 'simultaneous';
      let affectedMetric = 'cpu';
      let confidence = 0.6;

      if (primaryServer.cpu > 80 && server.cpu > 80) {
        affectedMetric = 'cpu';
        confidence = 0.75;
        if (Math.abs(primaryServer.cpu - server.cpu) < 10) {
          correlationType = 'simultaneous';
        } else {
          correlationType = 'cascade';
        }
      } else if (primaryServer.memory > 80 && server.memory > 80) {
        affectedMetric = 'memory';
        confidence = 0.7;
      } else if (primaryServer.disk > 85 && server.disk > 85) {
        affectedMetric = 'disk';
        confidence = 0.65;
      }

      newCorrelations.push({
        serverId: primaryServerId,
        correlatedWith: server.id,
        correlationType,
        confidence,
        affectedMetric,
        description: `${primaryServer.name}과 ${server.name}의 ${affectedMetric} 연관 (${correlationType})`,
      });
    }

    return {
      success: true,
      primaryServerId,
      existingCount: existingCorrelations.length,
      newCorrelationsCount: newCorrelations.length,
      newCorrelations,
      totalCorrelations: existingCorrelations.length + newCorrelations.length,
      summary:
        newCorrelations.length > 0
          ? `✅ ${newCorrelations.length}개의 새로운 서버 연관성 발견`
          : '새로운 연관성 없음',
      timestamp: new Date().toISOString(),
    };
  },
});
