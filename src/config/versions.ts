/**
 * 🔢 OpenManager AI - 버전 관리 시스템
 *
 * AI 엔진과 주요 컴포넌트의 버전을 중앙에서 관리
 * - 버전 변경 시 자동 로깅
 * - 마이그레이션 스크립트 실행
 * - 호환성 검사
 */

// 🧠 AI 엔진 버전 정보
import { logger } from '@/lib/logging';
export const AI_ENGINE_VERSIONS = {
  master: '7.1.0',

  // 오픈소스 엔진 (6개)
  opensource: {
    anomaly: '4.0.0', // simple-statistics Z-score 이상 탐지
    prediction: '4.0.0', // TensorFlow.js LSTM 시계열 예측
    autoscaling: '4.0.0', // ml-regression 부하 기반 스케일링
    korean: '4.0.0', // hangul-js + korean-utils 한국어 NLP
    enhanced: '4.0.0', // Fuse.js + MiniSearch 하이브리드 검색
    integrated: '4.0.0', // compromise + natural 고급 NLP
  },

  // 커스텀 엔진 (5개)
  custom: {
    mcp: '4.0.0', // Context-Aware Query Processing
    mcpTest: '4.0.0', // Connection Testing & Validation
    hybrid: '4.0.0', // Multi-Engine Combination
    unified: '4.0.0', // Cross-Platform Integration
    customNlp: '4.0.0', // OpenManager Domain-Specific NLP
  },

  // 지원 시스템
  support: {
    thinking: '4.0.0', // 사고과정 로그 시스템
    routing: '4.0.0', // 엔진 라우팅 시스템
    fallback: '4.0.0', // 자동 폴백 시스템
    caching: '4.0.0', // 스마트 캐싱 시스템
  },
} as const;

// 📊 서버 데이터 생성기 버전 정보
export const DATA_GENERATOR_VERSIONS = {
  optimized: '3.0.0', // 최적화된 데이터 생성기 (베이스라인 방식)
  simulation: '2.5.0', // 기존 시뮬레이션 엔진
  real: '3.0.0', // 실시간 서버 데이터 생성기

  // 지원 모듈
  modules: {
    baseline: '3.0.0', // 베이스라인 최적화 시스템
    patterns: '3.0.0', // 패턴 생성 시스템
    variation: '3.0.0', // 실시간 변동 시스템
    compression: '3.0.0', // 데이터 압축 시스템
  },
} as const;

// 🔄 버전 호환성 매트릭스
export const VERSION_COMPATIBILITY = {
  ai_engine: {
    minimum_supported: '3.5.0',
    deprecated_versions: ['3.0.0', '3.1.0', '3.2.0'] as readonly string[],
    breaking_changes: ['4.0.0'] as readonly string[],
  },
  data_generator: {
    minimum_supported: '2.0.0',
    deprecated_versions: ['2.0.0', '2.1.0', '2.2.0'] as readonly string[],
    breaking_changes: ['3.0.0'] as readonly string[],
  },
} as const;

// 📝 버전 변경 로그 인터페이스
export interface VersionChangeLog {
  timestamp: string;
  component: string;
  previousVersion: string;
  newVersion: string;
  changeType: 'major' | 'minor' | 'patch';
  description: string;
  migration?: string;
  breakingChanges?: string[];
}

// 🔍 버전 비교 유틸리티
export class VersionManager {
  private static changeLog: VersionChangeLog[] = [];

  /**
   * 버전 비교 (semantic versioning)
   */
  static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  /**
   * 버전 업그레이드 기록
   */
  static recordVersionChange(log: VersionChangeLog): void {
    this.changeLog.push({
      ...log,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      `🔄 버전 변경 기록: ${log.component} ${log.previousVersion} → ${log.newVersion}`
    );

    // 파일 시스템에 기록 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      this.saveChangeLog();
    }
  }

  /**
   * 호환성 검사
   */
  static checkCompatibility(
    component: keyof typeof VERSION_COMPATIBILITY,
    version: string
  ): {
    isSupported: boolean;
    isDeprecated: boolean;
    hasBreakingChanges: boolean;
    message: string;
  } {
    const compat = VERSION_COMPATIBILITY[component];
    const isSupported =
      this.compareVersions(version, compat.minimum_supported) >= 0;
    const isDeprecated = compat.deprecated_versions.includes(version);
    const hasBreakingChanges = compat.breaking_changes.includes(version);

    let message = '';
    if (!isSupported) {
      message = `버전 ${version}은 지원되지 않습니다. 최소 ${compat.minimum_supported} 이상이 필요합니다.`;
    } else if (isDeprecated) {
      message = `버전 ${version}은 곧 지원이 중단됩니다. 업그레이드를 권장합니다.`;
    } else if (hasBreakingChanges) {
      message = `버전 ${version}에는 호환성을 깨는 변경사항이 있습니다. 마이그레이션이 필요합니다.`;
    } else {
      message = `버전 ${version}은 안전하게 사용할 수 있습니다.`;
    }

    return { isSupported, isDeprecated, hasBreakingChanges, message };
  }

  /**
   * 다음 버전 제안
   */
  static suggestNextVersion(
    currentVersion: string,
    changeType: 'major' | 'minor' | 'patch'
  ): string {
    const parts = currentVersion.split('.').map(Number);

    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;

    switch (changeType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return currentVersion;
    }
  }

  /**
   * 변경 로그 조회
   */
  static getChangeLog(): VersionChangeLog[] {
    return [...this.changeLog];
  }

  /**
   * 컴포넌트별 현재 버전 조회
   */
  static getCurrentVersions() {
    return {
      ai_engines: AI_ENGINE_VERSIONS,
      data_generators: DATA_GENERATOR_VERSIONS,
      system_version: '7.1.0', // 메인 시스템 버전
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * 변경 로그 파일 저장
   * 🚨 베르셀 환경에서 파일 저장 무력화 - 무료티어 최적화
   */
  private static saveChangeLog(): void {
    // 🚨 베르셀 환경에서 파일 저장 건너뛰기
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      logger.info(
        '⚠️ [VersionManager] 베르셀 환경에서 버전 변경 로그 파일 저장 무력화'
      );
      return;
    }

    // 개발 환경에서만 파일에 저장 (브라우저 환경에서는 실행하지 않음)
    if (typeof window !== 'undefined') return;

    try {
      // Node.js 환경에서만 실행
      void import('fs').then((fs) => {
        void import('path').then((path) => {
          const logPath = path.join(
            process.cwd(),
            'logs',
            'version-changes.json'
          );
          fs.writeFileSync(logPath, JSON.stringify(this.changeLog, null, 2));
        });
      });
    } catch (error) {
      logger.warn('⚠️ 버전 변경 로그 저장 실패:', error);
    }
  }

  /**
   * 시스템 버전 정보 출력
   */
  static printVersionInfo(): void {
    logger.info(`
🔢 OpenManager AI - 버전 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 AI 엔진 마스터: v${AI_ENGINE_VERSIONS.master}
📊 데이터 생성기: v${DATA_GENERATOR_VERSIONS.optimized}
🔄 변경 로그: ${this.changeLog.length}개 기록
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }
}

// 🚀 시스템 시작 시 버전 정보 출력 (빌드 중에는 스킵)
if (
  typeof window === 'undefined' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  VersionManager.printVersionInfo();
}

export default VersionManager;
