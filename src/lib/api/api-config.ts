/**
 * API 환경별 설정 및 라우팅 관리
 *
 * 각 환경(development, test, production)에 맞는 API 설정 제공
 */

import 'server-only';
import { env } from '@/env';
import { getSiteUrl } from '@/lib/site-url';

/**
 * API 엔드포인트 설정
 */
export interface ApiEndpointConfig {
  base: string;
  supabase: string;
  gcpFunctions: string;
  vmApi: string;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  timeout: {
    default: number;
    long: number;
    stream: number;
  };
  cache: {
    enabled: boolean;
    ttl: number;
  };
}

/**
 * 환경별 API 설정
 */
const API_CONFIGS: Record<string, Partial<ApiEndpointConfig>> = {
  development: {
    rateLimit: { maxRequests: 100, windowMs: 60000 },
    timeout: { default: 30000, long: 120000, stream: 300000 },
    cache: { enabled: false, ttl: 0 },
  },
  test: {
    rateLimit: { maxRequests: 60, windowMs: 60000 },
    timeout: { default: 15000, long: 60000, stream: 180000 },
    cache: { enabled: true, ttl: 300 },
  },
  production: {
    rateLimit: { maxRequests: 60, windowMs: 60000 },
    timeout: { default: 10000, long: 30000, stream: 120000 },
    cache: { enabled: true, ttl: 600 },
  },
};

/**
 * 현재 환경에 맞는 API 설정 가져오기
 */
export function getApiConfig(): ApiEndpointConfig {
  const environment = env.NODE_ENV;
  const siteUrl = getSiteUrl();

  const baseConfig: ApiEndpointConfig = {
    base: `${siteUrl}/api`,
    supabase: env.NEXT_PUBLIC_SUPABASE_URL || '',
    gcpFunctions: env.GCP_FUNCTIONS_URL || '',
    vmApi: env.VM_API_URL || '',
    rateLimit: { maxRequests: 60, windowMs: 60000 },
    timeout: { default: 10000, long: 30000, stream: 120000 },
    cache: { enabled: true, ttl: 300 },
  };

  const envSpecificConfig = API_CONFIGS[environment] || {};

  return {
    ...baseConfig,
    ...envSpecificConfig,
    rateLimit: { ...baseConfig.rateLimit, ...envSpecificConfig.rateLimit },
    timeout: { ...baseConfig.timeout, ...envSpecificConfig.timeout },
    cache: { ...baseConfig.cache, ...envSpecificConfig.cache },
  };
}
