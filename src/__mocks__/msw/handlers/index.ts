/**
 * MSW Request Handlers Registry
 *
 * 모든 API 모킹 핸들러를 중앙에서 관리합니다.
 * 핸들러는 각 서비스별로 분리되어 있으며, 여기서 통합됩니다.
 *
 * @architecture
 * - handlers/nextjs/   - Next.js API route 핸들러
 * - handlers/vercel/   - Vercel Platform API 핸들러
 * - handlers/supabase/ - Supabase PostgreSQL API 핸들러
 */

import type { RequestHandler } from 'msw';
import { externalResourceHandlers } from './external/time-and-otel';
// Next.js API Routes 핸들러
import { nextJsApiHandlers } from './nextjs/api-routes';
// Supabase 핸들러
import { supabaseHandlers } from './supabase/supabase-api';
// Vercel 플랫폼 핸들러
import { vercelHandlers } from './vercel/vercel-api';

/**
 * 전체 핸들러 레지스트리
 *
 * 모든 외부 API 모킹 핸들러를 통합합니다.
 * 테스트 환경과 개발 환경 모두에서 사용됩니다.
 */
export const handlers: RequestHandler[] = [
  // Next.js API Routes (최우선 - 테스트용)
  ...nextJsApiHandlers,

  // 외부 리소스 핸들러 (time api, otel static data)
  ...externalResourceHandlers,

  // 인프라 핸들러
  ...vercelHandlers,
  ...supabaseHandlers,
];

/**
 * 환경별 핸들러 필터링
 *
 * 특정 환경에서만 활성화할 핸들러를 선택합니다.
 */
export const getHandlersByEnvironment = (env: 'test' | 'development') => {
  if (env === 'test') {
    // 테스트 환경: 모든 외부 API 모킹
    return handlers;
  }

  // 개발 환경: legacy provider-direct AI mocks are intentionally disabled.
  return [];
};
