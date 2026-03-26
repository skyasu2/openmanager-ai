/**
 * 🔐 환경변수 타입 안전성 보장 시스템
 *
 * @description
 * 이 파일은 프로젝트의 모든 환경변수를 중앙에서 관리하고 검증합니다.
 * Zod를 사용하여 런타임에 환경변수의 존재 여부와 타입을 검증하며,
 * 타입스크립트 프로젝트 전반에 타입 안전성을 제공합니다.
 *
 * @best_practice
 * - `process.env`를 직접 사용하지 마세요.
 * - 항상 이 파일에서 export된 `env` 객체를 사용하세요.
 * - 새로운 환경변수 추가 시, 반드시 이 파일의 `envSchema`에 정의해야 합니다.
 */

import 'server-only';
import * as z from 'zod';
import { logger } from '@/lib/logging';

// 환경변수 스키마 정의
const envSchema = z.object({
  // App Info
  APP_VERSION: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_PROJECT_ID: z.string().min(1).optional(),

  // Caching
  MEMORY_CACHE_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  MEMORY_CACHE_MAX_SIZE: z
    .string()
    .transform((val) => parseInt(val, 10) || 100)
    .optional(),
  MEMORY_CACHE_TTL_SECONDS: z
    .string()
    .transform((val) => parseInt(val, 10) || 900)
    .optional(),

  // GCP & Cloud Run
  GCP_PROJECT_ID: z.string().min(1).optional(),
  GCP_MCP_SERVER_URL: z.string().url().optional(),
  GCP_FUNCTIONS_URL: z.string().url().optional(), // Legacy - use CLOUD_RUN_AI_URL
  ENABLE_GCP_MCP_INTEGRATION: z.string().optional(),
  CLOUD_RUN_AI_URL: z.string().url().optional(),
  CLOUD_RUN_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  CLOUD_RUN_API_SECRET: z.string().min(1).optional(),

  // GitHub
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_TOKEN: z.string().startsWith('ghp_').optional(),

  // AI Services (Cloud Run based - v5.84.0)
  // Note: AI processing now handled by Cloud Run (Mistral/Cerebras/Groq)
  TAVILY_API_KEY: z.string().startsWith('tvly-').optional(),
  ENABLE_MCP: z
    .string()
    .transform((val) => val === 'true')
    .optional(),

  // Next.js & Vercel
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  VERCEL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_REGION: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  // Vercel이 자동 설정하는 URL은 프로토콜 없이 제공될 수 있음 (예: "app.vercel.app")
  NEXT_PUBLIC_VERCEL_URL: z
    .string()
    .transform((val) => {
      if (!val) return val;
      // 프로토콜이 없으면 https:// 추가
      return val.startsWith('http') ? val : `https://${val}`;
    })
    .pipe(z.string().url())
    .optional(),
  NEXT_PUBLIC_PROD_URL: z.string().url().optional(),
  NEXT_PUBLIC_TEST_URL: z.string().url().optional(),
  NEXT_PUBLIC_DEV_URL: z.string().url().optional(),

  // APIs & Services
  VM_API_URL: z.string().url().optional(),

  // Debug & Features
  NEXT_PUBLIC_DEBUG: z.string().optional(),
  MOCK_MODE: z.string().optional(),
  NEXT_PUBLIC_GUEST_FULL_ACCESS: z.string().optional(),
  NEXT_PUBLIC_GUEST_MODE: z.string().optional(),
  GUEST_LOGIN_BLOCKED_COUNTRIES: z.string().optional(),
  GUEST_LOGIN_PIN: z.string().optional(),
});

// 환경변수 타입 추출
export type Env = z.infer<typeof envSchema>;

// 환경변수 파싱 및 검증
function parseEnv(): Env {
  try {
    const currentEnv = typeof process !== 'undefined' ? process.env : {};
    const result = envSchema.safeParse(currentEnv);

    if (!result.success) {
      logger.error('환경변수 검증 실패:', result.error.format());

      const nodeEnv =
        (currentEnv as Record<string, string | undefined>).NODE_ENV ||
        process.env.NODE_ENV;
      const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

      if (nodeEnv === 'development' || isBuild) {
        logger.warn(
          '개발/빌드 환경: 필수 환경변수 누락 시 일부 기능이 제한될 수 있습니다.'
        );
        return {} as Env;
      }

      throw new Error(`환경변수 검증 실패: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    logger.error('환경변수 파싱 오류:', error);
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
    if (
      typeof process !== 'undefined' &&
      (process.env.NODE_ENV === 'development' || isBuild)
    ) {
      return {} as Env;
    }

    throw error;
  }
}

// 타입 안전한 환경변수 익스포트
export const env = parseEnv();

// 환경별 검증 헬퍼
const _isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
const _isTest = env.NODE_ENV === 'test';
const _isVercel = !!env.VERCEL;
const _isVercelProduction = env.VERCEL_ENV === 'production';

// 특정 기능 활성화 검사
export const features = {
  supabase:
    !!env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  github: !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET,
  gcp: !!env.GCP_PROJECT_ID,
  ai: !!env.CLOUD_RUN_AI_URL || !!env.CLOUD_RUN_ENABLED, // Cloud Run AI Engine
  search: !!env.TAVILY_API_KEY,
  cache: env.MEMORY_CACHE_ENABLED ?? true,
} as const;

// 개발용 환경변수 상태 로깅
if (isDevelopment) {
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'development'
  ) {
    logger.info('환경변수 기능 상태:', features);
  }
}
