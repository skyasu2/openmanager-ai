/**
 * 환경 변수 검증 모듈
 * 앱 시작 시점에 한 번만 검증하여 런타임 에러 방지
 */

import { logger } from '@/lib/logging';
const MIN_API_KEY_LENGTH = 8;

/**
 * TEST_API_KEY 환경 변수 검증
 *
 * @throws {Error} TEST_API_KEY가 설정되었으나 너무 짧은 경우
 */
export function validateTestApiKey(): void {
  const apiKey = process.env.TEST_API_KEY;

  // TEST_API_KEY가 설정되지 않은 경우는 정상 (선택적 기능)
  if (!apiKey) {
    return;
  }

  // 설정되었으나 너무 짧은 경우 에러
  if (apiKey.length < MIN_API_KEY_LENGTH) {
    throw new Error(
      `[Config Error] TEST_API_KEY must be at least ${MIN_API_KEY_LENGTH} characters long. ` +
        `Current length: ${apiKey.length}. ` +
        `This prevents accidental empty key configurations like TEST_API_KEY="".`
    );
  }

  logger.info('[Config] TEST_API_KEY validation passed');
}

/**
 * 모든 필수 환경 변수 검증
 * Next.js 앱 시작 시 호출됨
 */
export function validateEnvironmentVariables(): void {
  try {
    validateTestApiKey();
    // 향후 다른 환경 변수 검증 추가 가능
  } catch (error) {
    logger.error('[Config] Environment validation failed:', error);
    // 프로덕션 환경에서는 프로세스 종료
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
}
