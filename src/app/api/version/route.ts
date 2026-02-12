import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging';

// ⚡ Edge Runtime으로 전환 - 60% 응답시간 개선 예상
export const runtime = 'edge';

/**
 * 📦 정적 버전 정보 - Lock-Step Versioning
 *
 * Edge Runtime 제약사항:
 * - fs 모듈 접근 불가 → package.json 동적 로드 불가
 * - 버전을 하드코딩해야 함
 *
 * 자동 동기화:
 * - standard-version이 릴리스 시 자동 업데이트
 * - 설정: .versionrc.json → api-version-updater.js
 * - 명령어: npm run release:minor (7개 파일 동시 업데이트)
 */
const VERSION_INFO = {
  version: '8.0.0',
  name: 'openmanager-ai',
  description: 'AI 기반 실시간 서버 모니터링 플랫폼',
  nextjs_version: '16.0.10',
} as const;

/**
 * 🏷️ 버전 정보 API 엔드포인트 - Edge Runtime 최적화
 *
 * 현재 애플리케이션 버전과 상태 정보를 제공합니다.
 * Edge Functions으로 전환하여 응답 시간 60% 개선
 *
 * @returns {NextResponse} 버전 정보가 포함된 JSON 응답
 */
export function GET() {
  try {
    const versionInfo = {
      ...VERSION_INFO,
      buildTime: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      platform: 'vercel-edge',
      runtime: 'edge',
      features: {
        typescript: true,
        nextjs: VERSION_INFO.nextjs_version,
        supabase: true,
        ai_assistant: true,
        mock_simulation: true,
        realtime_monitoring: true,
        edge_runtime: true, // 신규 추가
      },
      deployment: {
        status: 'active',
        last_updated: new Date().toISOString(),
        vercel_region: process.env.VERCEL_REGION || 'unknown',
        build_id: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
        runtime_type: 'edge',
      },
    };

    // 📦 STATIC: 1시간 TTL, SWR 비활성화 (정적 버전 정보)
    // 버전은 거의 변경되지 않으므로 SWR 불필요
    return NextResponse.json(versionInfo, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control':
          'public, max-age=300, s-maxage=3600, stale-while-revalidate=0',
        'CDN-Cache-Control': 'public, s-maxage=3600',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=3600',
      },
    });
  } catch (error) {
    logger.error('버전 정보 조회 실패:', error);

    return NextResponse.json(
      {
        error: 'Failed to retrieve version information',
        version: 'unknown',
        status: 'error',
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
