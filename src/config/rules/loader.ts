/**
 * 🎯 RulesLoader - 시스템 규칙 로더 (Phase 2: Supabase 연동)
 *
 * 외부화된 규칙을 로드하고 접근하는 서비스.
 * Singleton 패턴으로 구현하여 앱 전체에서 동일한 규칙 참조.
 *
 * **Data Source Priority:**
 * 1. Supabase `system_rules` 테이블 (동적 설정)
 * 2. JSON 파일 (system-rules.json) - Supabase 실패 시 폴백
 *
 * @example
 * ```typescript
 * import { rulesLoader, getThreshold, isCritical } from '@/config/rules';
 *
 * // 임계값 조회
 * const cpuThreshold = getThreshold('cpu');
 * logger.info(cpuThreshold.critical); // 85
 *
 * // 상태 판정
 * if (isCritical('cpu', 90)) {
 *   logger.info('CPU 심각 상태!');
 * }
 *
 * // Supabase에서 최신 규칙 로드 (비동기)
 * await rulesLoader.refresh();
 * ```
 */

import type {
  SystemRules,
  MetricThreshold,
  IRulesLoader,
  AlertRule,
} from './types';
import { logger } from '@/lib/logging';
import { MetricThresholdSchema, SystemRuleRecord, SystemRulesSchema } from './schema';
import systemRulesJson from './system-rules.json';

/**
 * 시스템 규칙 로더 클래스
 */
class RulesLoader implements IRulesLoader {
  private rules: SystemRules;
  private static instance: RulesLoader;
  private lastRefreshTime: number = 0;
  private refreshTtlMs: number = 5 * 60 * 1000; // 5분 캐시 TTL
  private dataSource: 'json' | 'supabase' = 'json';

  private constructor() {
    this.rules = this.loadFromJson();
  }

  /**
   * Singleton 인스턴스 반환
   */
  static getInstance(): RulesLoader {
    if (!RulesLoader.instance) {
      RulesLoader.instance = new RulesLoader();
    }
    return RulesLoader.instance;
  }

  /** 테스트 격리용: 싱글톤 인스턴스 리셋 */
  static resetForTesting(): void {
    if (process.env.NODE_ENV !== 'test') return;
    // @ts-expect-error -- 테스트 격리를 위한 의도적 리셋
    RulesLoader.instance = undefined;
  }

  /**
   * JSON 파일에서 규칙 로드 (Zod schema validation)
   */
  private loadFromJson(): SystemRules {
    this.dataSource = 'json';
    const parsed = SystemRulesSchema.safeParse(systemRulesJson);
    if (!parsed.success) {
      logger.error(
        '❌ system-rules.json 스키마 검증 실패:',
        parsed.error.message
      );
      throw new Error(
        `system-rules.json schema validation failed: ${parsed.error.message}`
      );
    }
    return parsed.data;
  }

  /**
   * Supabase에서 규칙 로드 (서버 사이드 전용)
   */
  private async loadFromSupabase(): Promise<SystemRules | null> {
    // 클라이언트 사이드에서는 JSON 폴백만 사용
    if (typeof window !== 'undefined') {
      logger.info('ℹ️ 클라이언트에서 JSON 규칙 사용');
      return null;
    }

    try {
      // 동적 import로 서버 전용 모듈 로드
      const { supabaseAdmin } = await import('@/lib/supabase/admin');

      const { data, error } = await supabaseAdmin
        .from('system_rules')
        .select('category, key, value, description, enabled')
        .eq('enabled', true);

      if (error) {
        logger.warn('⚠️ Supabase 규칙 로드 실패:', error.message);
        return null;
      }

      if (!data || data.length === 0) {
        logger.warn('⚠️ Supabase에 규칙 데이터 없음');
        return null;
      }

      // Supabase 데이터를 SystemRules 형식으로 변환
      const records = data.map((row) => ({
        category: String(row.category),
        key: String(row.key),
        value: row.value as MetricThreshold | AlertRule | string,
        description: row.description ? String(row.description) : undefined,
        enabled: row.enabled != null ? Boolean(row.enabled) : undefined,
      })) satisfies SystemRuleRecord[];
      const rules = this.transformSupabaseData(records);
      this.dataSource = 'supabase';
      logger.info(`✅ Supabase에서 ${data.length}개 규칙 로드됨`);
      return rules;
    } catch (err) {
      logger.warn('⚠️ Supabase 연결 실패, JSON 폴백 사용:', err);
      return null;
    }
  }

  /**
   * Supabase 데이터를 SystemRules 형식으로 변환
   */
  private transformSupabaseData(records: SystemRuleRecord[]): SystemRules {
    // 기본값으로 시작 (JSON 폴백 데이터)
    const rules = this.loadFromJson();

    for (const record of records) {
      if (record.category === 'thresholds') {
        const key = record.key as keyof SystemRules['thresholds'];
        if (key in rules.thresholds) {
          const validated = MetricThresholdSchema.safeParse(record.value);
          if (validated.success) {
            rules.thresholds[key] = validated.data;
          } else {
            logger.warn(
              `⚠️ Supabase threshold '${key}' 스키마 불일치, JSON 폴백 유지`
            );
          }
        }
      } else if (record.category === 'alerts' && record.enabled !== false) {
        // Alert rules - 향후 구현
      } else if (
        record.category === 'ai_instructions' &&
        typeof record.value === 'string'
      ) {
        rules.metadata.aiInstructions = record.value;
      }
    }

    return rules;
  }

  /**
   * 전체 규칙 반환
   */
  getRules(): SystemRules {
    return this.rules;
  }

  /**
   * 특정 메트릭의 임계값 조회
   */
  getThreshold(metric: keyof SystemRules['thresholds']): MetricThreshold {
    return this.rules.thresholds[metric];
  }

  /**
   * 모든 임계값 조회
   */
  getAllThresholds(): SystemRules['thresholds'] {
    return this.rules.thresholds;
  }

  /**
   * 값이 경고 수준인지 확인 (warning <= value < critical)
   */
  isWarning(metric: keyof SystemRules['thresholds'], value: number): boolean {
    const threshold = this.getThreshold(metric);
    return value >= threshold.warning && value < threshold.critical;
  }

  /**
   * 값이 심각 수준인지 확인 (value >= critical)
   */
  isCritical(metric: keyof SystemRules['thresholds'], value: number): boolean {
    const threshold = this.getThreshold(metric);
    return value >= threshold.critical;
  }

  /**
   * 값에 따른 상태 결정
   */
  getStatus(
    metric: keyof SystemRules['thresholds'],
    value: number
  ): 'normal' | 'warning' | 'critical' {
    if (this.isCritical(metric, value)) return 'critical';
    if (this.isWarning(metric, value)) return 'warning';
    return 'normal';
  }

  /**
   * 서버 메트릭 전체로 상태 결정
   * @param metrics - 서버 메트릭 (responseTime은 ms 단위)
   */
  getServerStatus(metrics: {
    cpu?: number;
    memory?: number;
    disk?: number;
    network?: number;
    responseTime?: number;
  }): 'online' | 'warning' | 'critical' {
    const statuses: Record<string, 'normal' | 'warning' | 'critical'> = {};

    if (metrics.cpu !== undefined) {
      statuses['cpu'] = this.getStatus('cpu', metrics.cpu);
    }
    if (metrics.memory !== undefined) {
      statuses['memory'] = this.getStatus('memory', metrics.memory);
    }
    if (metrics.disk !== undefined) {
      statuses['disk'] = this.getStatus('disk', metrics.disk);
    }
    if (metrics.network !== undefined) {
      statuses['network'] = this.getStatus('network', metrics.network);
    }
    // 🆕 Response Time 상태 판정 (ms 단위)
    if (metrics.responseTime !== undefined) {
      statuses['responseTime'] = this.getStatus('responseTime', metrics.responseTime);
    }

    const values = Object.values(statuses);
    const criticalCount = values.filter((s) => s === 'critical').length;
    const warningCount = values.filter((s) => s === 'warning').length;

    // statusRules 기반 판정 (system-rules.json priority 순서)
    // P1: CPU >= critical AND Memory >= critical
    if (statuses['cpu'] === 'critical' && statuses['memory'] === 'critical') {
      return 'critical';
    }
    // P2: ANY metric >= critical (including responseTime)
    if (criticalCount > 0) return 'critical';
    // P3: 2+ metrics >= warning
    if (warningCount >= 2) return 'warning';
    // P4: ANY metric >= warning
    if (warningCount > 0) return 'warning';
    // P99: ALL metrics < warning
    return 'online';
  }

  /**
   * 활성화된 알림 규칙 조회
   */
  getActiveAlertRules(): AlertRule[] {
    return this.rules.alertRules.filter((rule) => rule.enabled);
  }

  /**
   * 특정 메트릭의 알림 규칙 조회
   */
  getAlertRulesForMetric(
    metricType: AlertRule['metricType']
  ): AlertRule[] {
    return this.rules.alertRules.filter(
      (rule) => rule.metricType === metricType && rule.enabled
    );
  }

  /**
   * AI 지시사항 조회 (RAG 연동용)
   */
  getAIInstructions(): string {
    return this.rules.metadata.aiInstructions;
  }

  /**
   * 규칙 버전 조회
   */
  getVersion(): string {
    return this.rules.version;
  }

  /**
   * 규칙 새로고침 (Supabase 연동)
   *
   * Supabase에서 최신 규칙을 로드하고, 실패 시 JSON 폴백 사용.
   * 캐시 TTL (5분) 내에는 새로고침하지 않음.
   *
   * @param force - true면 캐시 TTL 무시하고 강제 새로고침
   */
  async refresh(force: boolean = false): Promise<void> {
    const now = Date.now();
    const cacheAge = now - this.lastRefreshTime;

    // 캐시가 유효하면 스킵 (강제 새로고침 아닌 경우)
    if (!force && cacheAge < this.refreshTtlMs) {
      return;
    }

    // Supabase에서 로드 시도
    const supabaseRules = await this.loadFromSupabase();

    if (supabaseRules) {
      this.rules = supabaseRules;
      this.lastRefreshTime = now;
      logger.info('✅ 규칙 새로고침 완료 (Supabase)');
    } else {
      // Supabase 실패 시 JSON 폴백
      this.rules = this.loadFromJson();
      this.lastRefreshTime = now;
      logger.info('⚠️ 규칙 새로고침 완료 (JSON 폴백)');
    }
  }

  /**
   * 현재 데이터 소스 확인
   */
  getDataSource(): 'json' | 'supabase' {
    return this.dataSource;
  }

  /**
   * 캐시 상태 확인
   */
  getCacheStatus(): { age: number; isValid: boolean; source: string } {
    const age = Date.now() - this.lastRefreshTime;
    return {
      age,
      isValid: age < this.refreshTtlMs,
      source: this.dataSource,
    };
  }

  /**
   * 🔔 웹 알림 발송 조건 확인
   *
   * @param currentStatus 현재 상태
   * @param previousStatus 이전 상태 (상태 변화 감지용)
   * @returns 웹 알림 발송 여부
   */
  shouldSendWebNotification(
    currentStatus: 'online' | 'warning' | 'critical' | 'offline',
    previousStatus?: 'online' | 'warning' | 'critical' | 'offline'
  ): boolean {
    // Critical 또는 Offline 상태는 항상 알림
    if (currentStatus === 'critical' || currentStatus === 'offline') {
      return true;
    }

    // Online에서 Warning으로 변화한 경우 알림
    if (currentStatus === 'warning' && previousStatus === 'online') {
      return true;
    }

    // 복구 알림: Critical/Offline에서 Warning/Online으로 변화
    if (
      (previousStatus === 'critical' || previousStatus === 'offline') &&
      (currentStatus === 'warning' || currentStatus === 'online')
    ) {
      return true;
    }

    return false;
  }

  /**
   * AI 친화적인 규칙 요약 생성
   */
  getSummaryForAI(): string {
    const t = this.rules.thresholds;
    const statusLines = this.rules.statusRules
      .map((r) => `| ${r.name} | ${r.condition} | ${r.resultStatus} | P${r.priority} | ${r.for ?? '즉시'} |`)
      .join('\n');

    return `
## 현재 시스템 모니터링 임계값 (v${this.rules.version})

| 메트릭 | 경고(Warning) | 심각(Critical) | 복구(Recovery) |
|--------|--------------|----------------|----------------|
| CPU | ${t.cpu.warning}% | ${t.cpu.critical}% | ${t.cpu.recovery ?? '-'}% |
| Memory | ${t.memory.warning}% | ${t.memory.critical}% | ${t.memory.recovery ?? '-'}% |
| Disk | ${t.disk.warning}% | ${t.disk.critical}% | ${t.disk.recovery ?? '-'}% |
| Network | ${t.network.warning}% | ${t.network.critical}% | ${t.network.recovery ?? '-'}% |
| Response Time | ${t.responseTime.warning}ms | ${t.responseTime.critical}ms | ${t.responseTime.recovery ?? '-'}ms |

### 상태 결정 규칙 (Prometheus alerting 스타일)
| 규칙 | 조건 | 상태 | 우선순위 | 지속시간(for) |
|------|------|------|---------|-------------|
${statusLines}

> 참고: \`for\` 값은 Prometheus alerting의 지속시간 조건입니다. 조건이 해당 기간 동안 연속 충족되어야 상태가 전환됩니다.

${this.rules.metadata.aiInstructions}
    `.trim();
  }
}

// Singleton 인스턴스
export const rulesLoader = RulesLoader.getInstance();

// 편의 함수들 (직접 import 가능)
export const getRules = () => rulesLoader.getRules();
export const getThreshold = (metric: keyof SystemRules['thresholds']) =>
  rulesLoader.getThreshold(metric);
export const getAllThresholds = () => rulesLoader.getAllThresholds();
export const isWarning = (
  metric: keyof SystemRules['thresholds'],
  value: number
) => rulesLoader.isWarning(metric, value);
export const isCritical = (
  metric: keyof SystemRules['thresholds'],
  value: number
) => rulesLoader.isCritical(metric, value);
export const getStatus = (
  metric: keyof SystemRules['thresholds'],
  value: number
) => rulesLoader.getStatus(metric, value);
export const getServerStatus = (metrics: {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
  responseTime?: number;
}) => rulesLoader.getServerStatus(metrics);
export const shouldSendWebNotification = (
  currentStatus: 'online' | 'warning' | 'critical' | 'offline',
  previousStatus?: 'online' | 'warning' | 'critical' | 'offline'
) => rulesLoader.shouldSendWebNotification(currentStatus, previousStatus);
export const getActiveAlertRules = () => rulesLoader.getActiveAlertRules();
export const getAIInstructions = () => rulesLoader.getAIInstructions();
export const getSummaryForAI = () => rulesLoader.getSummaryForAI();
