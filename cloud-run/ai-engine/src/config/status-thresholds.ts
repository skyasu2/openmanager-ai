/**
 * Server Status Thresholds
 * Single Source of Truth: Loaded from Frontend system-rules.json
 *
 * @see /src/config/rules/system-rules.json (Frontend SSOT)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../lib/logger';

interface ThresholdConfig {
  warning: number;
  critical: number;
}

interface SystemRulesThresholds {
  cpu: ThresholdConfig;
  memory: ThresholdConfig;
  disk: ThresholdConfig;
  network: ThresholdConfig;
  responseTime: ThresholdConfig;
}

/**
 * system-rules.json 경로 후보
 * Cloud Run 배포 환경과 로컬 개발 환경 모두 지원
 */
function getSystemRulesPaths(): string[] {
  return [
    // Cloud Run 배포 시 복사된 경로
    join(__dirname, '../../config/system-rules.json'),
    join(process.cwd(), 'config/system-rules.json'),
    // 로컬 개발 시 원본 경로
    join(process.cwd(), 'src/config/rules/system-rules.json'),
    join(process.cwd(), '../src/config/rules/system-rules.json'),
  ];
}

/**
 * system-rules.json에서 임계값 로드
 */
function loadThresholdsFromSystemRules(): SystemRulesThresholds | null {
  for (const filePath of getSystemRulesPaths()) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const rules = JSON.parse(content);
        if (rules?.thresholds) {
          logger.info(`[StatusThresholds] system-rules.json 로드: ${filePath}`);
          return {
            cpu: { warning: rules.thresholds.cpu.warning, critical: rules.thresholds.cpu.critical },
            memory: { warning: rules.thresholds.memory.warning, critical: rules.thresholds.memory.critical },
            disk: { warning: rules.thresholds.disk.warning, critical: rules.thresholds.disk.critical },
            network: { warning: rules.thresholds.network.warning, critical: rules.thresholds.network.critical },
            responseTime: { warning: rules.thresholds.responseTime?.warning ?? 2000, critical: rules.thresholds.responseTime?.critical ?? 5000 },
          };
        }
      } catch (e) {
        logger.warn(`[StatusThresholds] system-rules.json 파싱 실패: ${filePath}`, e);
      }
    }
  }
  return null;
}

/**
 * 임계값 정의 - Single Source of Truth
 * @see /src/config/rules/system-rules.json
 *
 * 우선순위:
 * 1. system-rules.json에서 로드
 * 2. 폴백: 업계 표준 기본값 (JSON과 동일한 값)
 */
const loadedThresholds = loadThresholdsFromSystemRules();

export const STATUS_THRESHOLDS = loadedThresholds ?? {
  // 폴백 기본값 (system-rules.json과 동일)
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 80, critical: 90 },
  disk: { warning: 80, critical: 90 },
  network: { warning: 70, critical: 85 },
  responseTime: { warning: 2000, critical: 5000 },
};

export type MetricType = keyof Omit<typeof STATUS_THRESHOLDS, 'responseTime'>;
export type ServerStatus = 'online' | 'warning' | 'critical';

/**
 * Determine server status based on multi-metric thresholds
 * Logic matches Dashboard's RulesLoader.getServerStatus()
 *
 * Priority Rules (equivalent to Frontend RulesLoader):
 * - P1: CPU >= critical AND Memory >= critical → critical (subset of P2)
 * - P2: ANY metric >= critical → critical
 * - P3: 2+ metrics >= warning → warning (subset of P4)
 * - P4: ANY metric >= warning → warning
 * - P99: ALL metrics < warning → online
 *
 * Note: P1 is a special case of P2, P3 is a special case of P4.
 * This simplified logic produces identical results to the full priority chain.
 *
 * @param metrics - Server metrics object
 * @returns ServerStatus - 'online' | 'warning' | 'critical'
 */
export function determineServerStatus(metrics: {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
  responseTimeMs?: number;
}): ServerStatus {
  const { cpu = 0, memory = 0, disk = 0, network = 0, responseTimeMs } = metrics;

  // Rule 1: ANY metric >= critical → critical
  if (
    cpu >= STATUS_THRESHOLDS.cpu.critical ||
    memory >= STATUS_THRESHOLDS.memory.critical ||
    disk >= STATUS_THRESHOLDS.disk.critical ||
    network >= STATUS_THRESHOLDS.network.critical ||
    (responseTimeMs !== undefined && responseTimeMs >= STATUS_THRESHOLDS.responseTime.critical)
  ) {
    return 'critical';
  }

  // Rule 2: ANY metric >= warning → warning
  if (
    cpu >= STATUS_THRESHOLDS.cpu.warning ||
    memory >= STATUS_THRESHOLDS.memory.warning ||
    disk >= STATUS_THRESHOLDS.disk.warning ||
    network >= STATUS_THRESHOLDS.network.warning ||
    (responseTimeMs !== undefined && responseTimeMs >= STATUS_THRESHOLDS.responseTime.warning)
  ) {
    return 'warning';
  }

  // Rule 3: ALL metrics < warning → online
  return 'online';
}

/**
 * Get individual metric status
 */
export function getMetricStatus(
  metricType: MetricType,
  value: number
): 'normal' | 'warning' | 'critical' {
  const thresholds = STATUS_THRESHOLDS[metricType];

  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'normal';
}
