/**
 * 🎯 시스템 규칙 모듈 (Knowledge Externalization)
 *
 * 하드코딩된 임계값 대신 외부 설정을 사용하여:
 * - Single Source of Truth 확보
 * - 배포 없이 동적 변경 가능
 * - AI가 규칙을 참조하여 정확한 답변 제공
 *
 * @example
 * ```typescript
 * import { getThreshold, isCritical, getServerStatus } from '@/config/rules';
 *
 * // 임계값 조회
 * const cpuThreshold = getThreshold('cpu');
 *
 * // 상태 판정
 * const status = getServerStatus({ cpu: 90, memory: 75 });
 * ```
 */

// Types
export type {
  SystemRules,
  MetricThreshold,
  ServerStatusRule,
  AlertRule,
  IRulesLoader,
} from './types';

// Loader & Functions
export {
  rulesLoader,
  getRules,
  getThreshold,
  getAllThresholds,
  isWarning,
  isCritical,
  getStatus,
  getServerStatus,
  getActiveAlertRules,
  getSummaryForAI,
} from './loader';
