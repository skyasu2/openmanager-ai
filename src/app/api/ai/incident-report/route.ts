/**
 * 🚨 자동 장애 보고서 API
 *
 * Phase 2: Auto Incident Report Backend (Cloud Run Proxy)
 * - Vercel: Thin Proxy Layer
 * - Cloud Run: AI Analysis & Report Generation
 *
 * 🔄 v5.84.0: Local Fallback Removed (Cloud Run dependency enforced)
 * 🔄 v5.84.1: withAICache 추가 (중복 호출 방지, 1시간 TTL)
 */

import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { getHandler } from './get-handler';
import {
  createIncidentReportHandlerErrorResponse,
  createValidationErrorResponse,
  handleValidatedIncidentReportRequest,
} from './post-handler';
import { IncidentReportRequestSchema } from './route-helpers';

// ============================================================================
// ⚡ maxDuration - Vercel 빌드 타임 상수
// ============================================================================
// Next.js 정적 분석이 필요하므로 리터럴 값이 필수입니다.
// 실제 런타임 타임아웃은 src/config/ai-proxy.config.ts 에서 환경변수로 관리합니다.
// 복잡한 보고서 생성은 Job Queue 권장
// @see src/config/ai-proxy.config.ts (런타임 타임아웃 설정)
// ============================================================================
export const maxDuration = 60;

async function postHandler(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = IncidentReportRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return createValidationErrorResponse(parsed.error.flatten().fieldErrors);
    }

    return handleValidatedIncidentReportRequest(parsed.data);
  } catch (error) {
    return createIncidentReportHandlerErrorResponse(error);
  }
}

export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);
