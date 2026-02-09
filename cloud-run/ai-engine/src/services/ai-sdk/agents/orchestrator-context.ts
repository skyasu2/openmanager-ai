/**
 * Context Store Integration for Orchestrator
 * Parses agent responses and saves findings to session context.
 *
 * @version 4.0.0
 */

import {
  appendAffectedServers,
  appendAnomalies,
  appendMetrics,
  updateSessionContext,
} from './context-store';
import { isVisionQuery } from './vision-agent';
import type { PreFilterResult } from './orchestrator-types';
import { logger } from '../../../lib/logger';

// ============================================================================
// Context Store Integration - Parse and Save Agent Findings
// ============================================================================

/**
 * Server name extraction patterns
 * Matches common server naming conventions
 */
const SERVER_NAME_PATTERNS = [
  /(?:서버|server)[:\s]+([a-zA-Z0-9-_]+(?:-\d+)?)/gi,
  /\b(web-server-\d+)\b/gi,
  /\b(api-server-\d+)\b/gi,
  /\b(db-(?:master|slave)-\d+)\b/gi,
  /\b(cache-\d+)\b/gi,
  /\b([a-z]+-[a-z]+-\d{2})\b/gi,
];

/**
 * Anomaly indicator keywords for detection
 */
const ANOMALY_INDICATORS = [
  '높은 CPU', 'CPU 사용률', 'CPU 과부하', 'CPU 급등',
  '메모리 부족', '메모리 사용률', 'OOM', 'OutOfMemory',
  '디스크 부족', '디스크 사용률', '스토리지',
  '네트워크 지연', '레이턴시', 'latency',
  '장애', '에러', '오류', 'error', 'failure',
  '임계값 초과', 'threshold', '알림', 'alert',
];

/**
 * Parse agent response and save findings to context store
 */
export async function saveAgentFindingsToContext(
  sessionId: string,
  agentName: string,
  response: string
): Promise<void> {
  try {
    const normalizedAgent = agentName.toLowerCase();

    // NLQ Agent: Extract affected servers
    if (normalizedAgent.includes('nlq')) {
      const servers = extractServerNames(response);
      if (servers.length > 0) {
        await appendAffectedServers(sessionId, servers);
        console.log(`💾 [Context] NLQ Agent saved ${servers.length} servers: [${servers.slice(0, 3).join(', ')}${servers.length > 3 ? '...' : ''}]`);
      }
    }

    // Analyst Agent: Extract anomalies
    if (normalizedAgent.includes('analyst')) {
      const anomalies = extractAnomalies(response);
      if (anomalies.length > 0) {
        await appendAnomalies(sessionId, anomalies);
        console.log(`💾 [Context] Analyst Agent saved ${anomalies.length} anomalies`);
      }
    }

    // Reporter Agent: Extract metrics and root cause
    if (normalizedAgent.includes('reporter')) {
      const metrics = extractMetrics(response);
      if (metrics.length > 0) {
        await appendMetrics(sessionId, metrics);
        console.log(`💾 [Context] Reporter Agent saved ${metrics.length} metrics`);
      }
    }

    // Advisor Agent: Save recommendations (via lastAgent update)
    if (normalizedAgent.includes('advisor')) {
      await updateSessionContext(sessionId, { lastAgent: agentName });
      console.log(`💾 [Context] Advisor Agent updated lastAgent`);
    }
  } catch (error) {
    // Non-critical: log but don't throw
    logger.warn(`⚠️ [Context] Failed to save findings for ${agentName}:`, error);
  }
}

/**
 * Extract server names from response text
 */
function extractServerNames(text: string): string[] {
  const servers = new Set<string>();

  for (const pattern of SERVER_NAME_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match[1]) {
        servers.add(match[1].toLowerCase());
      }
    }
  }

  return Array.from(servers);
}

/**
 * Extract anomaly information from response text
 */
function extractAnomalies(text: string): Array<{
  serverId: string;
  serverName: string;
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  detectedAt: string;
}> {
  const anomalies: Array<{
    serverId: string;
    serverName: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network';
    value: number;
    threshold: number;
    severity: 'warning' | 'critical';
    detectedAt: string;
  }> = [];

  const servers = extractServerNames(text);
  const lines = text.split('\n');

  for (const line of lines) {
    const hasAnomalyIndicator = ANOMALY_INDICATORS.some(ind =>
      line.toLowerCase().includes(ind.toLowerCase())
    );

    if (hasAnomalyIndicator) {
      const percentMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
      const value = percentMatch ? parseFloat(percentMatch[1]) : 0;

      let metric: 'cpu' | 'memory' | 'disk' | 'network' = 'cpu';
      if (/cpu/i.test(line)) metric = 'cpu';
      else if (/메모리|memory|mem/i.test(line)) metric = 'memory';
      else if (/디스크|disk|storage/i.test(line)) metric = 'disk';
      else if (/네트워크|network|latency/i.test(line)) metric = 'network';

      const severity: 'warning' | 'critical' =
        (value >= 90 || /critical|심각|긴급/i.test(line)) ? 'critical' : 'warning';

      const targetServers = servers.length > 0 ? servers : ['unknown'];
      for (const serverId of targetServers.slice(0, 3)) {
        anomalies.push({
          serverId,
          serverName: serverId,
          metric,
          value,
          threshold: metric === 'cpu' ? 80 : 85,
          severity,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  return anomalies.slice(0, 10);
}

/**
 * Extract metric snapshots from response text
 */
function extractMetrics(text: string): Array<{
  serverId: string;
  serverName: string;
  cpu: number;
  memory: number;
  disk: number;
  status: 'normal' | 'warning' | 'critical';
  timestamp: string;
}> {
  const metrics: Array<{
    serverId: string;
    serverName: string;
    cpu: number;
    memory: number;
    disk: number;
    status: 'normal' | 'warning' | 'critical';
    timestamp: string;
  }> = [];

  const servers = extractServerNames(text);
  const timestamp = new Date().toISOString();

  const cpuMatch = text.match(/CPU[:\s]+(\d+(?:\.\d+)?)\s*%/i);
  const memMatch = text.match(/(?:메모리|Memory)[:\s]+(\d+(?:\.\d+)?)\s*%/i);
  const diskMatch = text.match(/(?:디스크|Disk)[:\s]+(\d+(?:\.\d+)?)\s*%/i);

  const cpu = cpuMatch ? parseFloat(cpuMatch[1]) : 0;
  const memory = memMatch ? parseFloat(memMatch[1]) : 0;
  const disk = diskMatch ? parseFloat(diskMatch[1]) : 0;

  const maxValue = Math.max(cpu, memory, disk);
  const status: 'normal' | 'warning' | 'critical' =
    maxValue >= 90 ? 'critical' : maxValue >= 70 ? 'warning' : 'normal';

  if (cpu > 0 || memory > 0 || disk > 0) {
    const targetServers = servers.length > 0 ? servers : ['unknown'];
    for (const serverId of targetServers.slice(0, 5)) {
      metrics.push({
        serverId,
        serverName: serverId,
        cpu,
        memory,
        disk,
        status,
        timestamp,
      });
    }
  }

  return metrics;
}

// ============================================================================
// Pre-filter (Rule-based Fast Path)
// ============================================================================

const GREETING_PATTERNS = [
  /^(안녕하세요|안녕|하이|헬로|hi|hello|hey|반가워|좋은\s*(아침|오후|저녁))[\s!?.]*$/i,
  /^(고마워|감사합니다|감사|ㄱㅅ|수고|잘가|바이|bye|thanks)[\s!?.]*$/i,
];

const GENERAL_PATTERNS = [
  /^(오늘|지금)\s*(날씨|몇\s*일|몇\s*시|요일|며칠)[\s?]*$/i,
  /^(넌|너는?|뭐야|누구|뭘\s*할\s*수|도움말|help|도와줘)[\s?]*$/i,
  /^(테스트|ping|echo)[\s?]*$/i,
];

const SERVER_KEYWORDS = [
  '서버', 'cpu', '메모리', '디스크', 'memory', 'disk', '상태',
  '이상', '분석', '예측', '트렌드', '장애', '보고서', '리포트',
  '해결', '명령어', '요약', '모니터링', 'server', '알람', '경고',
  '평균', '최대', '최소', '지난', '시간', '전체',
  '사례', '이력', '과거', '유사', '인시던트', 'incident',
  '스크린샷', 'screenshot', '이미지', 'image', '대시보드', 'dashboard',
  '로그 분석', '대용량', '최신 문서', 'grafana', 'cloudwatch',
  '높은', '낮은', '상승', '하강', '급증', '급감',
  '오프라인', '온라인', '다운', 'down', 'offline', 'online',
  '부하', 'load', '사용량', 'usage',
  '응답시간', 'response', 'latency', '대역폭', 'bandwidth',
  '장비',
];

/**
 * Fast pre-filter before LLM routing
 * Handles simple queries without LLM call
 */
export function preFilterQuery(query: string): PreFilterResult {
  const normalized = query.trim().toLowerCase();

  // 1. Check greeting patterns - direct response
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(query)) {
      return {
        shouldHandoff: false,
        directResponse: '안녕하세요! 서버 모니터링 AI입니다. 서버 상태, 이상 탐지, 장애 분석 등을 도와드립니다. 무엇을 도와드릴까요?',
        confidence: 0.95,
      };
    }
  }

  // 2. Check general patterns - direct response
  for (const pattern of GENERAL_PATTERNS) {
    if (pattern.test(query)) {
      if (/날짜|몇\s*일|며칠/.test(query)) {
        const today = new Date().toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        });
        return {
          shouldHandoff: false,
          directResponse: `오늘은 ${today}입니다.`,
          confidence: 0.95,
        };
      }
      if (/몇\s*시/.test(query)) {
        const now = new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return {
          shouldHandoff: false,
          directResponse: `현재 시간은 ${now}입니다.`,
          confidence: 0.95,
        };
      }
      if (/넌|너는?|뭐야|누구/.test(query)) {
        return {
          shouldHandoff: false,
          directResponse: '저는 OpenManager 서버 모니터링 AI입니다. 서버 상태 조회, 이상 탐지, 트렌드 예측, 장애 보고서 생성 등을 지원합니다.',
          confidence: 0.95,
        };
      }
      if (/도움말|help|뭘\s*할\s*수/.test(query)) {
        return {
          shouldHandoff: false,
          directResponse: `다음과 같은 기능을 제공합니다:
• **서버 상태 조회**: "서버 상태 알려줘", "CPU 높은 서버"
• **이상 탐지**: "이상 있어?", "문제 서버 찾아줘"
• **트렌드 분석**: "트렌드 예측해줘"
• **장애 보고서**: "장애 보고서 만들어줘"
• **해결 방법**: "메모리 부족 해결 방법"`,
          confidence: 0.95,
        };
      }
      if (/테스트|ping|echo/.test(query)) {
        return {
          shouldHandoff: false,
          directResponse: 'Pong! 서버 모니터링 AI가 정상 동작 중입니다.',
          confidence: 0.95,
        };
      }
    }
  }

  // 3. Check for server-related keywords - needs handoff
  const hasServerKeyword = SERVER_KEYWORDS.some(kw => normalized.includes(kw));

  if (hasServerKeyword) {
    let suggestedAgent = 'NLQ Agent';

    if (isVisionQuery(query)) {
      suggestedAgent = 'Vision Agent';
    } else if (/이상|분석|예측|트렌드|패턴|원인|왜/.test(query)) {
      suggestedAgent = 'Analyst Agent';
    } else if (/보고서|리포트|타임라인|인시던트/.test(query)) {
      suggestedAgent = 'Reporter Agent';
    } else if (/해결|방법|명령어|가이드|어떻게|과거.*사례|사례.*찾|이력|유사/.test(query)) {
      suggestedAgent = 'Advisor Agent';
    }

    return {
      shouldHandoff: true,
      suggestedAgent,
      confidence: 0.8,
    };
  }

  // 4. Unknown - let LLM decide
  return {
    shouldHandoff: true,
    confidence: 0.5,
  };
}
