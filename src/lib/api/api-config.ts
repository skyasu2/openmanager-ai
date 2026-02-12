/**
 * API 환경별 설정 및 라우팅 관리
 *
 * 각 환경(development, test, production)에 맞는 API 설정 제공
 */

import 'server-only';
import { env, isDevelopment, isProduction, isTest } from '@/env';
import { logger } from '@/lib/logging';

// This logic is moved from the now-deleted env-config.ts
function getSiteUrl(): string {
  if (env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  if (isProduction) {
    return env.NEXT_PUBLIC_PROD_URL || 'https://openmanager-ai.vercel.app';
  }
  if (isTest) {
    return env.NEXT_PUBLIC_TEST_URL || 'https://openmanager-test.vercel.app';
  }
  return env.NEXT_PUBLIC_DEV_URL || 'http://localhost:3000';
}

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

/**
 * API 엔드포인트 빌더
 */
export class ApiEndpointBuilder {
  private config: ApiEndpointConfig;

  constructor() {
    this.config = getApiConfig();
  }

  internal(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.config.base}${cleanPath}`;
  }

  supabase(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.config.supabase}${cleanPath}`;
  }

  gcpFunction(functionName: string): string {
    return `${this.config.gcpFunctions}/${functionName}`;
  }

  vmApi(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.config.vmApi}${cleanPath}`;
  }

  getConfig(): ApiEndpointConfig {
    return this.config;
  }
}

export function createApiHeaders(
  options: { auth?: string; contentType?: string; cache?: boolean } = {}
): HeadersInit {
  const headers: HeadersInit = {};
  headers['Content-Type'] = options.contentType || 'application/json';
  if (options.auth) {
    headers.Authorization = `Bearer ${options.auth}`;
  }

  const config = getApiConfig();
  if (config.cache.enabled && options.cache !== false) {
    headers['Cache-Control'] = `max-age=${config.cache.ttl}`;
  } else {
    headers['Cache-Control'] = 'no-cache';
  }
  return headers;
}

export function createApiRequestOptions(
  options: {
    method?: string;
    body?: unknown;
    auth?: string;
    cache?: boolean;
    timeout?: number;
  } = {}
): RequestInit {
  const config = getApiConfig();
  const headers = createApiHeaders({
    auth: options.auth,
    cache: options.cache,
  });

  const requestOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    requestOptions.body =
      typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
  }

  if (!config.cache.enabled || options.cache === false) {
    requestOptions.cache = 'no-store';
  }

  if (options.timeout || config.timeout.default) {
    const timeoutMs = options.timeout || config.timeout.default;
    requestOptions.signal = AbortSignal.timeout(timeoutMs);
  }

  return requestOptions;
}

export async function apiCall<T = unknown>(
  endpoint: string,
  options: Parameters<typeof createApiRequestOptions>[0] = {}
): Promise<T> {
  const builder = new ApiEndpointBuilder();
  const url = endpoint.startsWith('http')
    ? endpoint
    : builder.internal(endpoint);
  const requestOptions = createApiRequestOptions(options);

  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (isDevelopment) {
      logger.error('API Call Error:', { endpoint, error, options });
    }
    throw error;
  }
}

export const apiEndpoint = new ApiEndpointBuilder();

export default {
  getApiConfig,
  ApiEndpointBuilder,
  createApiHeaders,
  createApiRequestOptions,
  apiCall,
  apiEndpoint,
};
