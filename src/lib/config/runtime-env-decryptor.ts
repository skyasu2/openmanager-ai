/**
 * 🔓 런타임 환경변수 복호화 시스템
 * OpenManager AI - 프로덕션에서 암호화된 환경변수 자동 복호화
 */

import CryptoJS from 'crypto-js';
import { logger } from '@/lib/logging';

export interface EncryptedEnvVar {
  encrypted: string;
  salt: string;
  iv: string;
  timestamp: string;
  originalName: string;
  isPublic: boolean;
  rotateSchedule: string;
}

// 암호화된 환경변수 설정 (하드코딩 - Git 안전)
const ENCRYPTED_REDIS_CONFIG = {
  teamPasswordHash:
    '7e346817b5382d72b3860a1aa9d6abc0263e2ddcea9e78c18724dfa2c1f575f5',
  variables: {
    UPSTASH_REDIS_REST_URL: {
      encrypted:
        '9c86DAVxwMmum1CRTGQlzE1/0QtUm2T+DvNTnPfetl02W9BxBb17cJm4TCvQNYTM',
      salt: 'd0047e315f3329b269ef15f8eb135207',
      iv: '457777a8bb1ebd422ed559b208dcf20d',
      timestamp: '2025-06-18T23:24:08.083Z',
      originalName: 'UPSTASH_REDIS_REST_URL',
      isPublic: false,
      rotateSchedule: 'manual',
    },
    UPSTASH_REDIS_REST_TOKEN: {
      encrypted:
        '6loFOt/I0HlBaB6Ds0hL0T0OJVw8TZQhXZDZXzyPSpY0frDsGg4+IvqEKojVgFybmAI3//5uSOtDu3RfuVe5og==',
      salt: 'e7ebd6ee2e53b72bc027a7598768109a',
      iv: 'd89bda01209941992d5f6b9516abefe8',
      timestamp: '2025-06-18T23:24:08.183Z',
      originalName: 'UPSTASH_REDIS_REST_TOKEN',
      isPublic: false,
      rotateSchedule: 'quarterly',
    },
  },
};

/**
 * 값 복호화
 */
function decryptValue(
  encryptedData: EncryptedEnvVar,
  password: string
): string {
  try {
    const { encrypted, salt, iv } = encryptedData;

    // ⚠️ 보안 개선 필요: OWASP는 100,000 iterations 권장
    // 현재 10,000 유지 (기존 암호화 데이터와 호환성 유지)
    // 새로 암호화 시 100,000으로 증가 권장
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 10000,
    });

    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedText) {
      throw new Error('복호화 결과가 비어있습니다.');
    }

    return decryptedText;
  } catch (error: unknown) {
    throw new Error(
      `복호화 실패: ${
        error instanceof Error
          ? error.message
          : (() => {
              try {
                return JSON.stringify(error);
              } catch {
                return typeof error === 'string' ? error : 'Unknown error';
              }
            })()
      }`
    );
  }
}

/**
 * 캐시된 복호화 결과
 */
let decryptedCache: { [key: string]: string } | null = null;

/**
 * Redis 환경변수 런타임 복호화
 */
export function getDecryptedRedisConfig(): {
  url: string;
  token: string;
} | null {
  try {
    // 🚫 테스트 환경에서는 Redis 연결 차단
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.TEST_CONTEXT === 'true' ||
      process.env.FORCE_MOCK_REDIS === 'true' ||
      process.env.REDIS_CONNECTION_DISABLED === 'true'
    ) {
      logger.info('🎭 테스트 환경 - Redis 복호화 건너뜀 (목업 모드)');
      return null;
    }

    // 🛡️ 헬스체크 컨텍스트에서는 연결 제한
    if (
      process.env.HEALTH_CHECK_CONTEXT === 'true' ||
      process.env.DISABLE_HEALTH_CHECK === 'true'
    ) {
      logger.info('🏥 헬스체크 컨텍스트 - Redis 복호화 제한 (차단 방지)');
      return null;
    }

    // 이미 환경변수가 설정되어 있으면 그것을 사용
    if (
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      return {
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      };
    }

    // 캐시된 결과가 있으면 반환
    if (decryptedCache) {
      return {
        url: decryptedCache.UPSTASH_REDIS_REST_URL ?? '',
        token: decryptedCache.UPSTASH_REDIS_REST_TOKEN ?? '',
      };
    }

    // 팀 비밀번호 (환경변수 필수)
    const teamPassword = process.env.TEAM_DECRYPT_PASSWORD;

    if (!teamPassword) {
      if (process.env.NODE_ENV === 'production') {
        logger.error(
          '❌ TEAM_DECRYPT_PASSWORD required in production - Redis disabled'
        );
        return null;
      }
      logger.warn(
        '⚠️ TEAM_DECRYPT_PASSWORD not set - Redis disabled (development)'
      );
      return null;
    }

    // 비밀번호 검증
    // ⚠️ 보안 개선 권장: SHA256 → PBKDF2로 업그레이드 (새로 암호화 시)
    const passwordHash = CryptoJS.SHA256(teamPassword).toString();
    if (passwordHash !== ENCRYPTED_REDIS_CONFIG.teamPasswordHash) {
      logger.warn('⚠️ 팀 비밀번호 불일치 - Redis 복호화 실패');
      return null;
    }

    // Redis 환경변수 복호화
    const redisUrl = decryptValue(
      ENCRYPTED_REDIS_CONFIG.variables.UPSTASH_REDIS_REST_URL,
      teamPassword
    );
    const redisToken = decryptValue(
      ENCRYPTED_REDIS_CONFIG.variables.UPSTASH_REDIS_REST_TOKEN,
      teamPassword
    );

    // 캐시에 저장
    decryptedCache = {
      UPSTASH_REDIS_REST_URL: redisUrl,
      UPSTASH_REDIS_REST_TOKEN: redisToken,
    };

    logger.info('🔓 Redis 환경변수 런타임 복호화 성공');

    return {
      url: redisUrl,
      token: redisToken,
    };
  } catch (error) {
    logger.error(
      '❌ Redis 환경변수 복호화 실패:',
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * 특정 환경변수 복호화
 */
export function getDecryptedEnvVar(varName: string): string | null {
  try {
    // 이미 환경변수가 설정되어 있으면 그것을 사용
    if (process.env[varName]) {
      return process.env[varName];
    }

    // 캐시된 결과가 있으면 반환
    if (decryptedCache && decryptedCache[varName]) {
      return decryptedCache[varName];
    }

    // Redis 설정만 지원
    if (
      !ENCRYPTED_REDIS_CONFIG.variables[
        varName as keyof typeof ENCRYPTED_REDIS_CONFIG.variables
      ]
    ) {
      return null;
    }

    const config = getDecryptedRedisConfig();
    if (!config) return null;

    return varName === 'UPSTASH_REDIS_REST_URL' ? config.url : config.token;
  } catch (error) {
    logger.error(
      `❌ ${varName} 복호화 실패:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * 복호화 캐시 초기화
 */
export function clearDecryptionCache(): void {
  decryptedCache = null;
}
