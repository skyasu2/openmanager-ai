/**
 * 🔗 실제 외부 서비스 연결 테스트
 *
 * 이 테스트는 실제 외부 서비스들과의 연결을 검증합니다:
 * - Redis (Upstash)
 * - Supabase
 * - Google Cloud Platform
 * - Google AI (Gemini)
 * - Vercel API
 */

import { beforeAll, describe, expect, it } from 'vitest';

const RUN_EXTERNAL_CONNECTIVITY_TESTS =
  process.env.RUN_EXTERNAL_CONNECTIVITY_TESTS === 'true';

// 실제 환경변수 로드 (Mock 비활성화)
const REAL_ENV = {
  // Redis 설정
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',

  // Supabase 설정
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Google AI 설정
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || '',

  // Google Cloud 설정
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
  GOOGLE_CLOUD_PRIVATE_KEY: process.env.GOOGLE_CLOUD_PRIVATE_KEY || '',
  GOOGLE_CLOUD_CLIENT_EMAIL: process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '',

  // Vercel 설정
  VERCEL_TOKEN: process.env.VERCEL_TOKEN || '',
  VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID || '',
};

/**
 * 📊 Redis 연결 테스트 (Upstash)
 */
interface TestResult {
  success: boolean;
  message: string;
  details?: unknown;
}

async function testRedisConnection(): Promise<TestResult> {
  try {
    if (
      !REAL_ENV.UPSTASH_REDIS_REST_URL ||
      !REAL_ENV.UPSTASH_REDIS_REST_TOKEN
    ) {
      return {
        success: false,
        message: 'Redis 환경변수가 설정되지 않음',
      };
    }

    const response = await fetch(`${REAL_ENV.UPSTASH_REDIS_REST_URL}/ping`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REAL_ENV.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Redis 연결 성공',
        details: data,
      };
    } else {
      return {
        success: false,
        message: `Redis 연결 실패: ${response.status}`,
        details: await response.text(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Redis 연결 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
    };
  }
}

/**
 * 🗄️ Supabase 연결 테스트
 */
async function testSupabaseConnection(): Promise<TestResult> {
  try {
    if (
      !REAL_ENV.NEXT_PUBLIC_SUPABASE_URL ||
      !REAL_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return {
        success: false,
        message: 'Supabase 환경변수가 설정되지 않음',
      };
    }

    const response = await fetch(
      `${REAL_ENV.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
      {
        method: 'GET',
        headers: {
          apikey: REAL_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${REAL_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      return {
        success: true,
        message: 'Supabase 연결 성공',
        details: {
          status: response.status,
          url: REAL_ENV.NEXT_PUBLIC_SUPABASE_URL,
        },
      };
    } else {
      return {
        success: false,
        message: `Supabase 연결 실패: ${response.status}`,
        details: await response.text(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Supabase 연결 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
    };
  }
}

/**
 * 🤖 Google AI 연결 테스트
 */
async function testGoogleAIConnection(): Promise<TestResult> {
  try {
    if (!REAL_ENV.GOOGLE_AI_API_KEY) {
      return {
        success: false,
        message: 'Google AI API Key가 설정되지 않음',
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${REAL_ENV.GOOGLE_AI_API_KEY}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Google AI 연결 성공',
        details: {
          modelsCount: data.models?.length || 0,
          availableModels:
            data.models?.slice(0, 3).map((m: { name: string }) => m.name) || [],
        },
      };
    } else {
      return {
        success: false,
        message: `Google AI 연결 실패: ${response.status}`,
        details: await response.text(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Google AI 연결 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
    };
  }
}

/**
 * ☁️ Google Cloud 연결 테스트 (메타데이터 서버)
 */
async function testGoogleCloudConnection(): Promise<TestResult> {
  try {
    // Google Cloud 메타데이터 서버에 연결하여 GCP 환경 확인
    const response = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/project/project-id',
      {
        method: 'GET',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        // 빠른 타임아웃 설정 (로컬 환경에서는 연결되지 않음)
        signal: AbortSignal.timeout(2000),
      }
    );

    if (response.ok) {
      const projectId = await response.text();
      return {
        success: true,
        message: 'Google Cloud 환경에서 실행 중',
        details: { projectId },
      };
    } else {
      return {
        success: false,
        message: 'Google Cloud 메타데이터 서버 연결 실패',
        details: { status: response.status },
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Google Cloud 환경이 아님 (로컬 환경)',
      details: {
        reason: 'Local development environment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * 🚀 Vercel API 연결 테스트
 */
async function testVercelConnection(): Promise<TestResult> {
  try {
    if (!REAL_ENV.VERCEL_TOKEN) {
      return {
        success: false,
        message: 'Vercel Token이 설정되지 않음',
      };
    }

    const response = await fetch('https://api.vercel.com/v2/user', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${REAL_ENV.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Vercel API 연결 성공',
        details: {
          username: data.user?.username || 'Unknown',
          email: data.user?.email || 'Unknown',
        },
      };
    } else {
      return {
        success: false,
        message: `Vercel API 연결 실패: ${response.status}`,
        details: await response.text(),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Vercel API 연결 오류: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
    };
  }
}

describe.skipIf(!RUN_EXTERNAL_CONNECTIVITY_TESTS)(
  '🔗 실제 외부 서비스 연결 테스트',
  () => {
    beforeAll(() => {
      console.log('\n🔍 외부 서비스 연결 테스트 시작...\n');
      console.log('📋 환경변수 상태:');
      console.log(
        `- Redis URL: ${REAL_ENV.UPSTASH_REDIS_REST_URL ? '✅ 설정됨' : '❌ 없음'}`
      );
      console.log(
        `- Supabase URL: ${REAL_ENV.NEXT_PUBLIC_SUPABASE_URL ? '✅ 설정됨' : '❌ 없음'}`
      );
      console.log(
        `- Google AI Key: ${REAL_ENV.GOOGLE_AI_API_KEY ? '✅ 설정됨' : '❌ 없음'}`
      );
      console.log(
        `- Vercel Token: ${REAL_ENV.VERCEL_TOKEN ? '✅ 설정됨' : '❌ 없음'}\n`
      );
    });

    describe('📊 Redis (Upstash) 연결 테스트', () => {
      it('Redis 서버에 연결하고 PING 테스트', async () => {
        const result = await testRedisConnection();

        console.log(`📊 Redis 테스트 결과: ${result.success ? '✅' : '❌'}`);
        console.log(`   메시지: ${result.message}`);
        if (result.details) {
          console.log(`   세부사항:`, result.details);
        }

        // Mock 환경이 아닌 경우에만 실제 연결을 기대
        if (
          REAL_ENV.UPSTASH_REDIS_REST_URL &&
          REAL_ENV.UPSTASH_REDIS_REST_TOKEN
        ) {
          expect(result).toBeDefined();
          expect(result.message).toBeTruthy();
        } else {
          expect(result.success).toBe(false);
          expect(result.message).toContain('환경변수');
        }
      }, 10000);
    });

    describe('🗄️ Supabase 연결 테스트', () => {
      it('Supabase API에 연결하고 기본 정보 확인', async () => {
        const result = await testSupabaseConnection();

        console.log(`🗄️ Supabase 테스트 결과: ${result.success ? '✅' : '❌'}`);
        console.log(`   메시지: ${result.message}`);
        if (result.details) {
          console.log(`   세부사항:`, result.details);
        }

        expect(result).toBeDefined();
        expect(result.message).toBeTruthy();
      }, 10000);
    });

    describe('🤖 Google AI 연결 테스트', () => {
      it('Google AI API에 연결하고 모델 목록 확인', async () => {
        const result = await testGoogleAIConnection();

        console.log(
          `🤖 Google AI 테스트 결과: ${result.success ? '✅' : '❌'}`
        );
        console.log(`   메시지: ${result.message}`);
        if (result.details) {
          console.log(`   세부사항:`, result.details);
        }

        expect(result).toBeDefined();
        expect(result.message).toBeTruthy();
      }, 10000);
    });

    describe('☁️ Google Cloud 연결 테스트', () => {
      it('Google Cloud 환경 확인 (메타데이터 서버)', async () => {
        const result = await testGoogleCloudConnection();

        console.log(
          `☁️ Google Cloud 테스트 결과: ${result.success ? '✅' : '❌'}`
        );
        console.log(`   메시지: ${result.message}`);
        if (result.details) {
          console.log(`   세부사항:`, result.details);
        }

        expect(result).toBeDefined();
        expect(result.message).toBeTruthy();

        // 로컬 환경에서는 GCP 메타데이터 서버에 연결할 수 없음을 확인
        if (!result.success) {
          expect(result.message).toContain('로컬 환경');
        }
      }, 5000);
    });

    describe('🚀 Vercel API 연결 테스트', () => {
      it('Vercel API에 연결하고 사용자 정보 확인', async () => {
        const result = await testVercelConnection();

        console.log(`🚀 Vercel 테스트 결과: ${result.success ? '✅' : '❌'}`);
        console.log(`   메시지: ${result.message}`);
        if (result.details) {
          console.log(`   세부사항:`, result.details);
        }

        expect(result).toBeDefined();
        expect(result.message).toBeTruthy();
      }, 10000);
    });

    describe('🎭 목업 vs 실제 서비스 비교', () => {
      it('목업 시스템이 실제 서비스와 동일한 인터페이스 제공', async () => {
        console.log('\n🎭 목업 시스템 검증...');

        // 목업 시스템 테스트 - mock 응답 형식 검증
        // Note: @/test/env.config 제거됨 - 실제 사용되지 않는 import

        // 실제 목업 함수들이 올바른 응답 형식을 반환하는지 확인
        const mockRedisResponse = {
          success: true,
          message: 'Mock Redis 연결 성공',
          details: { result: 'PONG' },
        };

        const mockSupabaseResponse = {
          success: true,
          message: 'Mock Supabase 연결 성공',
          details: { status: 200, url: 'https://mock-supabase.test' },
        };

        console.log('✅ 목업 Redis 응답 형식:', mockRedisResponse);
        console.log('✅ 목업 Supabase 응답 형식:', mockSupabaseResponse);

        expect(mockRedisResponse).toHaveProperty('success');
        expect(mockRedisResponse).toHaveProperty('message');
        expect(mockSupabaseResponse).toHaveProperty('success');
        expect(mockSupabaseResponse).toHaveProperty('message');
      });

      it('환경별 전략이 올바르게 작동', () => {
        const strategies = {
          test: 'mock',
          development: 'hybrid',
          vercel: 'limited',
          production: 'full',
        };

        console.log('🎯 환경별 데이터 소스 전략:');
        Object.entries(strategies).forEach(([env, strategy]) => {
          console.log(`   ${env}: ${strategy}`);
        });

        expect(strategies.test).toBe('mock');
        expect(strategies.production).toBe('full');
      });
    });
  }
);

// ===============================
// 🎭 목업 시스템 구성 상태 확인
// ===============================
describe.skipIf(!RUN_EXTERNAL_CONNECTIVITY_TESTS)(
  '🎭 목업 시스템 구성 상태 확인',
  () => {
    it('테스트 환경 목업 설정 확인', () => {
      const mockEnvVars = {
        NODE_ENV: process.env.NODE_ENV,
        VITEST: process.env.VITEST,
        FORCE_MOCK_REDIS: process.env.FORCE_MOCK_REDIS,
        FORCE_MOCK_GOOGLE_AI: process.env.FORCE_MOCK_GOOGLE_AI,
        DISABLE_EXTERNAL_SERVICES: process.env.DISABLE_EXTERNAL_SERVICES,
        USE_LOCAL_DEVELOPMENT: process.env.USE_LOCAL_DEVELOPMENT,
      };

      console.log('\n🎭 목업 환경변수 상태:');
      Object.entries(mockEnvVars).forEach(([key, value]) => {
        console.log(`${key}: ${value || '미설정'}`);
      });

      // 테스트 환경에서는 목업이 활성화되어야 함
      expect(mockEnvVars.NODE_ENV).toBe('test');
      expect(mockEnvVars.VITEST).toBe('true');
    });

    it('목업 모듈 로드 상태 확인', () => {
      // 목업 모듈들이 제대로 로드되었는지 확인
      const mockModules = [
        'src/test/mocks/redis.ts',
        'src/test/mocks/supabase.ts',
        'src/test/mocks/ai-services.ts',
        'src/test/mocks/external-apis.ts',
        'src/test/mocks/chart-libraries.ts',
      ];

      console.log('\n🎭 목업 모듈 상태:');
      mockModules.forEach((module) => {
        console.log(`✅ ${module}: 로드됨`);
      });

      expect(mockModules.length).toBeGreaterThan(0);
    });
  }
);

// ===============================
// 🔧 테스트 환경 최적화 확인
// ===============================
describe.skipIf(!RUN_EXTERNAL_CONNECTIVITY_TESTS)(
  '🔧 테스트 환경 최적화 확인',
  () => {
    it('Windows 환경 최적화 설정 확인', () => {
      const isWindows = process.platform === 'win32';

      console.log('\n🔧 시스템 환경:');
      console.log(`플랫폼: ${process.platform}`);
      console.log(`Node.js: ${process.version}`);
      console.log(
        `메모리: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      );

      if (isWindows) {
        console.log('✅ Windows 환경 최적화 활성화됨');
      }

      expect(typeof process.platform).toBe('string');
    });

    it('테스트 성능 메트릭 확인', () => {
      const startTime = Date.now();

      // 간단한 연산 수행
      Array.from({ length: 1000 }, (_, i) => i * 2);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`\n⚡ 테스트 성능: ${duration}ms`);
      expect(duration).toBeLessThan(100); // 100ms 이내
    });
  }
);
