/**
 * 보안 로깅 유틸리티
 * 로그 폭증 방지를 위한 샘플링 로직 포함
 */

import { SECURITY } from '@/config/constants';
import { logger } from '@/lib/logging';

interface SecurityLogEntry {
  ip: string;
  timestamp: number;
}

/**
 * Rate-limited 보안 로거
 * 동일 IP에서의 반복된 실패 시도를 샘플링하여 로그 폭증 방지
 */
class SecurityLogger {
  private failureLog = new Map<string, SecurityLogEntry>();
  private readonly sampleWindow = SECURITY.LOGGER.SAMPLE_WINDOW_MS;
  private readonly maxLogSize = SECURITY.LOGGER.MAX_LOG_SIZE;

  /**
   * 인증 실패 로그 (샘플링 적용)
   * 동일 IP의 경우 1분에 최대 1번만 로깅
   */
  logAuthFailure(ip: string, reason: string): void {
    const now = Date.now();
    const lastLog = this.failureLog.get(ip);

    // 1분 이내 동일 IP의 로그가 있으면 스킵 (샘플링)
    if (lastLog && now - lastLog.timestamp < this.sampleWindow) {
      return;
    }

    // 새로운 로그 기록
    logger.warn(
      `[Security] Authentication failure | IP: ${ip} | Reason: ${reason} | Time: ${new Date(now).toISOString()}`
    );

    // 로그 맵 업데이트
    this.failureLog.set(ip, { ip, timestamp: now });

    // 맵 크기 제한 (메모리 보호)
    if (this.failureLog.size > this.maxLogSize) {
      // 가장 오래된 항목 제거
      const oldestKey = this.failureLog.keys().next().value;
      if (oldestKey) {
        this.failureLog.delete(oldestKey);
      }
    }
  }

  /**
   * 구조화된 보안 이벤트 로그
   * 중요한 보안 이벤트는 항상 로깅 (샘플링 없음)
   */
  logSecurityEvent(event: {
    type: 'invalid_key' | 'config_error' | 'buffer_error';
    ip?: string;
    details?: string;
  }): void {
    logger.error(
      `[Security Event] Type: ${event.type} | IP: ${event.ip || 'N/A'} | Details: ${event.details || 'N/A'} | Time: ${new Date().toISOString()}`
    );
  }

  /**
   * 주기적인 통계 로그 (옵션)
   * 1시간마다 요약 통계 출력
   */
  getStatistics(): { totalIPs: number; oldestTimestamp: number | null } {
    const timestamps = Array.from(this.failureLog.values()).map(
      (entry) => entry.timestamp
    );
    const oldestTimestamp =
      timestamps.length > 0 ? Math.min(...timestamps) : null;

    return {
      totalIPs: this.failureLog.size,
      oldestTimestamp,
    };
  }

  /**
   * 오래된 로그 항목 정리 (1시간 이상 경과)
   */
  cleanup(): void {
    const now = Date.now();
    const hourAgo = now - 3600000; // 1시간

    for (const [ip, entry] of this.failureLog.entries()) {
      if (entry.timestamp < hourAgo) {
        this.failureLog.delete(ip);
      }
    }
  }
}

// 싱글톤 인스턴스
export const securityLogger = new SecurityLogger();

// 1시간마다 자동 정리 (서버 환경에서만, 단일 등록 보장)
let cleanupTimerId: NodeJS.Timeout | null = null;

if (typeof window === 'undefined' && !cleanupTimerId) {
  cleanupTimerId = setInterval(() => {
    securityLogger.cleanup();
  }, SECURITY.LOGGER.CLEANUP_INTERVAL_MS);

  // 서버리스 환경에서 setInterval이 이벤트 루프를 계속 활성 상태로 유지하는 것을 방지하여,
  // 의도치 않은 동작이나 추가 비용 발생을 막습니다.
  // unref()를 호출하면 타이머가 Node.js 프로세스 종료를 막지 않습니다.
  cleanupTimerId.unref();
}
