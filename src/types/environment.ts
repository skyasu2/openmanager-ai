/**
 * 🌍 환경변수 타입 정의 (중앙집중화)
 *
 * 모든 환경변수 타입을 여기서 관리하여 일관성 보장
 */

// 🔧 기본 환경변수 타입 확장
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV: 'development' | 'production' | 'test';

      // 🚀 Next.js 및 Vercel 환경변수
      readonly NEXT_PHASE?: string;
      VERCEL?: '1'; // next-auth와의 타입 호환성을 위해 readonly 제거 및 리터럴 타입 사용
      readonly VERCEL_ENV?: 'development' | 'preview' | 'production';
      readonly VERCEL_URL?: string;
      readonly VERCEL_BRANCH_URL?: string;
      readonly VERCEL_PROJECT_PRODUCTION_URL?: string;

      // 🔐 Supabase 환경변수
      readonly NEXT_PUBLIC_SUPABASE_URL?: string;
      readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
      readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
      readonly SUPABASE_SERVICE_ROLE_KEY?: string;

      // 🤖 AI 관련 환경변수 (Cloud Run AI Engine)
      readonly CLOUD_RUN_AI_URL?: string;
      readonly CLOUD_RUN_AI_ENABLED?: string;
      readonly CLOUD_RUN_API_SECRET?: string;

      // 🔧 개발 및 테스트 환경변수
      readonly ENABLE_MOCK_DATA?: string;
      readonly DISABLE_EXTERNAL_CALLS?: string;
      readonly DISABLE_HEALTH_CHECK?: string;
      readonly HEALTH_CHECK_CONTEXT?: string;
      readonly MCP_SERVER_ENABLED?: string;
      readonly SKIP_ENV_VALIDATION?: string;

      // 🌐 애플리케이션 환경변수
      readonly NEXT_PUBLIC_APP_URL?: string;
      readonly NEXT_PUBLIC_APP_NAME?: string;
      readonly NEXT_PUBLIC_APP_VERSION?: string;

      // 🔒 보안 관련 환경변수 (게스트 모드 전용)
      readonly JWT_SECRET?: string;
      readonly ENCRYPTION_KEY?: string;
      readonly GUEST_LOGIN_BLOCKED_COUNTRIES?: string;
      readonly GUEST_LOGIN_PIN?: string;
      readonly NEXT_PUBLIC_GUEST_FULL_ACCESS?: string;
      readonly NEXT_PUBLIC_GUEST_MODE?: string;
      readonly TEST_SECRET_KEY?: string;

      // 📊 모니터링 및 로깅
      readonly ENABLE_LOGGING?: string;
      readonly LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
      readonly SENTRY_DSN?: string;
      readonly ANALYTICS_ID?: string;

      // 🛠️ 빌드 및 배포
      readonly npm_lifecycle_event?: string;
      readonly CI?: string;
      readonly GITHUB_ACTIONS?: string;

      // 🔍 기타 환경변수 (확장 가능)
      [key: string]: string | undefined;
    }
  }
}

// 📋 환경변수 그룹별 타입 정의
export interface SupabaseEnvConfig {
  url: string;
  publishableKey?: string;
  anonKey: string;
  serviceRoleKey?: string;
  isConfigured: boolean;
}

export interface CloudRunAIEnvConfig {
  enabled: boolean;
  quotaProtection: boolean;
  endpoint?: string;
  isConfigured: boolean;
}

export interface DeploymentEnvConfig {
  environment: 'development' | 'production' | 'test';
  isVercel: boolean;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  appUrl: string;
  appName: string;
  appVersion: string;
}

export interface SecurityEnvConfig {
  jwtSecret: string;
  encryptionKey: string;
  isConfigured: boolean;
}

export interface MonitoringEnvConfig {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  sentryDsn?: string;
  analyticsId?: string;
  isConfigured: boolean;
}

// 📊 전체 환경변수 구성 타입
export interface EnvironmentConfig {
  supabase: SupabaseEnvConfig;
  cloudRunAI: CloudRunAIEnvConfig;
  deployment: DeploymentEnvConfig;
  security: SecurityEnvConfig;
  monitoring: MonitoringEnvConfig;
}

// 🎯 환경변수 검증 결과 타입
export interface EnvironmentValidationResult {
  valid: boolean;
  missing?: string[];
  errors?: string[];
  warnings?: string[];
  reason?: string;
}

// 🔧 Mock 환경변수 설정 타입
export interface MockEnvironmentConfig {
  ENABLE_MOCK_DATA?: boolean;
  DISABLE_EXTERNAL_CALLS?: boolean;
  DISABLE_HEALTH_CHECK?: boolean;
  HEALTH_CHECK_CONTEXT?: boolean;
  CLOUD_RUN_AI_ENABLED?: boolean;
  MCP_SERVER_ENABLED?: boolean;
}

// 🌟 환경변수 유틸리티 타입들
export type EnvironmentName = 'development' | 'production' | 'test';
export type DeploymentPlatform = 'local' | 'vercel' | 'other';
export type ConfigurationStatus =
  | 'configured'
  | 'partial'
  | 'missing'
  | 'invalid';

// 🎨 환경변수 접근 패턴 타입
export interface SafeEnvironmentAccess {
  get<T = string>(key: keyof NodeJS.ProcessEnv, defaultValue?: T): T;
  getRequired<T = string>(key: keyof NodeJS.ProcessEnv): T;
  getBoolean(key: keyof NodeJS.ProcessEnv, defaultValue?: boolean): boolean;
  getNumber(key: keyof NodeJS.ProcessEnv, defaultValue?: number): number;
  getArray(key: keyof NodeJS.ProcessEnv, separator?: string): string[];
  validate(keys: (keyof NodeJS.ProcessEnv)[]): EnvironmentValidationResult;
}

// 🛡️ 타입 가드 함수들
function _isValidEnvironmentName(env: string): env is EnvironmentName {
  return ['development', 'production', 'test'].includes(env);
}

function _isValidDeploymentPlatform(
  platform: string
): platform is DeploymentPlatform {
  return ['local', 'vercel', 'other'].includes(platform);
}

function _isValidConfigurationStatus(
  status: string
): status is ConfigurationStatus {
  return ['configured', 'partial', 'missing', 'invalid'].includes(status);
}
