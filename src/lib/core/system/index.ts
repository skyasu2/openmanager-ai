/**
 * 시스템 모듈 통합 Export
 *
 * 이벤트 버스 기반 ProcessManager + SystemWatchdog 시스템
 */

export type {
  ProcessConfig,
  ProcessState,
  SystemMetrics,
} from './ProcessManager';
// ProcessManager + split modules (re-exported via ProcessManager barrel)
export {
  HealthCheckManager,
  type HealthCheckContext,
  ProcessManager,
  SystemStabilityMonitor,
  type StabilityContext,
} from './ProcessManager';
// Process 설정
export * from './process-configs';
// SystemBootstrapper
export {
  getSystemBootstrapper,
  resetSystemBootstrapper,
  type SystemBootstrapConfig,
  SystemBootstrapper,
} from './SystemBootstrapper';
export type {
  SystemMetrics as WatchdogMetrics,
  WatchdogAlerts,
} from './SystemWatchdog';
// SystemWatchdog
export { SystemWatchdog } from './SystemWatchdog';

// 내부 사용을 위한 import
import {
  getSystemBootstrapper,
  type SystemBootstrapConfig,
} from './SystemBootstrapper';

/**
 * 시스템 초기화 헬퍼 함수
 */
export async function initializeSystem(config?: SystemBootstrapConfig) {
  const bootstrapper = getSystemBootstrapper(config);
  await bootstrapper.initialize();
  return bootstrapper;
}
