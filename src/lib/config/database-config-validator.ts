/**
 * 🔐 데이터베이스 설정 검증기 v1.0
 *
 * Upstash Redis + Supabase PostgreSQL 환경변수 검증 및 보안 강화
 * - 환경변수 존재성 검증
 * - 연결 테스트 자동화
 * - 보안 설정 체크
 * - 무료 티어 최적 설정 가이드
 */

import * as z from 'zod';
import { logger } from '@/lib/logging';

// 환경변수 스키마 정의
const DatabaseConfigSchema = z.object({
  // Supabase 설정
  supabase: z.object({
    url: z.string().url('올바른 Supabase URL이 아닙니다'),
    anonKey: z.string().min(100, 'Supabase Anon Key가 너무 짧습니다'),
    serviceRoleKey: z
      .string()
      .min(100, 'Supabase Service Role Key가 너무 짧습니다'),
    jwtSecret: z.string().min(32, 'JWT Secret은 최소 32자 이상이어야 합니다'),
    projectRef: z
      .string()
      .regex(/^[a-z]{20}$/, '올바른 Supabase Project Reference가 아닙니다'),
  }),

  // Upstash Redis 설정 (이중화)
  redis: z.object({
    // 메인 Upstash Redis 설정
    upstashUrl: z.string().url('올바른 Upstash Redis URL이 아닙니다'),
    upstashToken: z.string().min(50, 'Upstash Redis Token이 너무 짧습니다'),

    // KV 호환 설정 (Vercel KV)
    kvUrl: z.string().url('올바른 KV URL이 아닙니다').optional(),
    kvToken: z.string().min(50, 'KV Token이 너무 짧습니다').optional(),
    kvReadOnlyToken: z.string().optional(),
  }),

  // 환경별 설정
  environment: z.object({
    nodeEnv: z.enum(['development', 'production', 'test']),
    isVercel: z.boolean(),
    isProduction: z.boolean(),
  }),
});

type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/**
 * 🔍 환경변수에서 데이터베이스 설정 추출
 */
function extractDatabaseConfig(): DatabaseConfig {
  return {
    supabase: {
      url:
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
      anonKey:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
      projectRef: process.env.SUPABASE_PROJECT_REF || '',
    },
    redis: {
      upstashUrl: process.env.UPSTASH_REDIS_REST_URL || '',
      upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
      kvUrl: process.env.KV_REST_API_URL,
      kvToken: process.env.KV_REST_API_TOKEN,
      kvReadOnlyToken: process.env.KV_REST_API_READ_ONLY_TOKEN,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      isVercel: !!process.env.VERCEL,
      isProduction: process.env.NODE_ENV === 'production',
    },
  };
}

/**
 * 🛡️ 데이터베이스 설정 검증 결과
 */
export interface DatabaseValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  config?: DatabaseConfig;
  security: {
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  };
}

/**
 * ✅ 데이터베이스 설정 검증 메인 함수
 */
export async function validateDatabaseConfig(): Promise<DatabaseValidationResult> {
  const result: DatabaseValidationResult = {
    isValid: false,
    errors: [],
    warnings: [],
    recommendations: [],
    security: {
      score: 0,
      issues: [],
      recommendations: [],
    },
  };

  try {
    // 1. 환경변수 추출 및 기본 검증
    const config = extractDatabaseConfig();
    const validation = DatabaseConfigSchema.safeParse(config);

    if (!validation.success) {
      result.errors = validation.error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      return result;
    }

    result.config = validation.data;
    result.isValid = true;

    // 2. 보안 검증
    const securityCheck = await performSecurityCheck(result.config);
    result.security = securityCheck;

    // 3. 연결 테스트
    const connectionTests = await performConnectionTests(result.config);
    result.warnings.push(...connectionTests.warnings);
    result.recommendations.push(...connectionTests.recommendations);

    // 4. 무료 티어 최적화 체크
    const freeTierCheck = performFreeTierOptimizationCheck(result.config);
    result.recommendations.push(...freeTierCheck);

    // 5. 종합 점수 계산
    if (result.errors.length === 0) {
      result.isValid = true;
    }
  } catch (error) {
    result.errors.push(`설정 검증 중 오류: ${error}`);
  }

  return result;
}

/**
 * 🔒 보안 검증
 */
async function performSecurityCheck(config: DatabaseConfig): Promise<{
  score: number;
  issues: string[];
  recommendations: string[];
}> {
  const security = {
    score: 100,
    issues: [] as string[],
    recommendations: [] as string[],
  };

  // Supabase 보안 체크
  if (config.supabase.serviceRoleKey.length < 200) {
    security.score -= 10;
    security.issues.push('Service Role Key가 너무 짧습니다');
  }

  if (config.supabase.jwtSecret.length < 64) {
    security.score -= 15;
    security.issues.push('JWT Secret이 권장 길이보다 짧습니다');
    security.recommendations.push('JWT Secret을 64자 이상으로 설정하세요');
  }

  // Redis 보안 체크
  if (!config.redis.upstashUrl.includes('upstash.io')) {
    security.score -= 5;
    security.issues.push('Upstash Redis URL이 공식 도메인이 아닙니다');
  }

  // 환경별 보안 체크
  if (config.environment.isProduction) {
    if (!config.supabase.url.includes('supabase.co')) {
      security.score -= 20;
      security.issues.push('프로덕션에서 비공식 Supabase URL 사용');
    }

    if (!process.env.NEXTAUTH_SECRET) {
      security.score -= 25;
      security.issues.push('프로덕션에서 NEXTAUTH_SECRET 누락');
      security.recommendations.push('NextAuth SECRET을 설정하세요');
    }
  }

  // Service Role Key나 JWT Secret이 public 접두사를 가지면 안됨
  if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    security.score -= 50;
    security.issues.push('🚨 CRITICAL: Service Role Key가 public으로 노출됨');
    security.recommendations.push(
      'NEXT_PUBLIC_ 접두사를 제거하고 서버 전용으로 사용하세요'
    );
  }

  return security;
}

/**
 * 🔌 연결 테스트
 */
async function performConnectionTests(config: DatabaseConfig): Promise<{
  warnings: string[];
  recommendations: string[];
}> {
  const result = {
    warnings: [] as string[],
    recommendations: [] as string[],
  };

  try {
    // Supabase 연결 테스트
    const supabaseTest = await testSupabaseConnection(config.supabase);
    if (!supabaseTest.success) {
      result.warnings.push(`Supabase 연결 실패: ${supabaseTest.error}`);
      result.recommendations.push(
        'Supabase 환경변수와 네트워크 연결을 확인하세요'
      );
    }

    // Redis 연결 테스트
    const redisTest = await testRedisConnection(config.redis);
    if (!redisTest.success) {
      result.warnings.push(`Redis 연결 실패: ${redisTest.error}`);
      result.recommendations.push(
        'Upstash Redis 환경변수와 네트워크 연결을 확인하세요'
      );
    }
  } catch (error) {
    result.warnings.push(`연결 테스트 중 오류: ${error}`);
  }

  return result;
}

/**
 * 💰 무료 티어 최적화 체크
 */
function performFreeTierOptimizationCheck(config: DatabaseConfig): string[] {
  const recommendations: string[] = [];

  // Supabase 무료 티어 최적화
  recommendations.push(
    '📊 Supabase 500MB 제한: RLS 정책으로 불필요한 데이터 접근 차단'
  );
  recommendations.push(
    '🔄 자동 데이터 정리: 90일 이상 된 임베딩 데이터 정리 활성화'
  );
  recommendations.push('📈 인덱스 최적화: 사용되지 않는 벡터 인덱스 정리');

  // Upstash Redis 무료 티어 최적화
  recommendations.push('🔴 Redis 256MB 제한: TTL 설정으로 메모리 누수 방지');
  recommendations.push('📦 데이터 압축: 1KB 이상 데이터 자동 압축');
  recommendations.push('⏰ 스마트 캐싱: 컨텍스트별 TTL 전략 적용');

  // 환경별 최적화
  if (config.environment.isProduction) {
    recommendations.push(
      '🚀 프로덕션 최적화: Connection pooling 및 캐시 최적화 활성화'
    );
  }

  return recommendations;
}

/**
 * 🧪 개별 연결 테스트 함수들
 */
async function testSupabaseConnection(
  supabaseConfig: DatabaseConfig['supabase']
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 간단한 Supabase 연결 테스트
    const response = await fetch(`${supabaseConfig.url}/rest/v1/`, {
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
      },
    });

    return { success: response.ok };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function testRedisConnection(
  redisConfig: DatabaseConfig['redis']
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Upstash Redis REST API 테스트
    const response = await fetch(`${redisConfig.upstashUrl}/ping`, {
      headers: {
        Authorization: `Bearer ${redisConfig.upstashToken}`,
      },
    });

    const result = await response.text();
    return { success: result.includes('PONG') };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * 📋 설정 상태 리포트 생성
 */
export function generateConfigReport(
  validation: DatabaseValidationResult
): string {
  const lines: string[] = [];

  lines.push('🔐 데이터베이스 설정 검증 리포트');
  lines.push('='.repeat(50));
  lines.push('');

  // 전체 상태
  lines.push(`✅ 전체 상태: ${validation.isValid ? '정상' : '오류 있음'}`);
  lines.push(`🛡️ 보안 점수: ${validation.security.score}/100`);
  lines.push('');

  // 오류
  if (validation.errors.length > 0) {
    lines.push('❌ 오류:');
    validation.errors.forEach((error) => lines.push(`  - ${error}`));
    lines.push('');
  }

  // 경고
  if (validation.warnings.length > 0) {
    lines.push('⚠️ 경고:');
    validation.warnings.forEach((warning) => lines.push(`  - ${warning}`));
    lines.push('');
  }

  // 보안 이슈
  if (validation.security.issues.length > 0) {
    lines.push('🚨 보안 이슈:');
    validation.security.issues.forEach((issue) => lines.push(`  - ${issue}`));
    lines.push('');
  }

  // 권장사항
  if (validation.recommendations.length > 0) {
    lines.push('💡 권장사항:');
    validation.recommendations.forEach((rec) => lines.push(`  - ${rec}`));
    lines.push('');
  }

  lines.push(
    `생성 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
  );

  return lines.join('\n');
}

/**
 * 🚀 시작 시 자동 검증 (개발 모드에서만)
 */
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  validateDatabaseConfig()
    .then((result) => {
      if (!result.isValid || result.security.score < 80) {
        logger.warn('⚠️ 데이터베이스 설정 검증 결과:');
        logger.warn(generateConfigReport(result));
      } else {
        logger.info('✅ 데이터베이스 설정 검증 통과');
      }
    })
    .catch((error: unknown) => logger.error('데이터베이스 설정 검증 실패:', error));
}

export default validateDatabaseConfig;
