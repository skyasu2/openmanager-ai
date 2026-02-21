/**
 * MSW Request Handlers Registry
 *
 * 모든 API 모킹 핸들러를 중앙에서 관리합니다.
 * 핸들러는 각 서비스별로 분리되어 있으며, 여기서 통합됩니다.
 *
 * @architecture
 * - handlers/ai/       - OpenAI, Cohere API 핸들러
 * - handlers/vercel/   - Vercel Platform API 핸들러
 * - handlers/supabase/ - Supabase PostgreSQL API 핸들러
 *
 * ## v5.84.0: Removed Google AI handlers (migrated to Mistral)
 */

import type { RequestHandler } from 'msw';
import { cohereHandlers } from './ai/cohere';
import { externalResourceHandlers } from './external/time-and-otel';
// AI 서비스 핸들러 (OpenAI, Cohere)
import { openAIHandlers } from './ai/openai';
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

  // AI 서비스 핸들러
  ...openAIHandlers,
  ...cohereHandlers,

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

  // 개발 환경: AI API만 모킹 (선택적)
  return process.env.MOCK_AI_APIS === 'true'
    ? [...openAIHandlers, ...cohereHandlers]
    : [];
};
