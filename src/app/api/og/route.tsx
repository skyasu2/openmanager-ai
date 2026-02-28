/**
 * 🖼️ Dynamic OG Image Generator
 *
 * OpenGraph 및 Twitter Card용 동적 이미지 생성 API
 * Next.js ImageResponse API 사용
 *
 * Query Parameters:
 * - title: 커스텀 제목 (선택)
 * - description: 커스텀 설명 (선택)
 */

import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logging';
import { getSiteUrl } from '@/lib/site-url';

// MIGRATED: Removed export const runtime = 'edge';

// 기본값 상수
const DEFAULTS = {
  title: 'OpenManager AI',
  description: 'AI Native Server Monitoring Platform',
  tags: ['Next.js 16', 'React 19', 'Vercel AI SDK', '5-Agent System'],
} as const;

export async function GET(request: NextRequest) {
  try {
    // 쿼리 파라미터에서 커스텀 값 추출
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || DEFAULTS.title;
    const description = searchParams.get('description') || DEFAULTS.description;

    // 제목 길이 제한 (너무 길면 이미지가 깨질 수 있음)
    const safeTitle = title.length > 50 ? `${title.slice(0, 47)}...` : title;
    const safeDescription =
      description.length > 100 ? `${description.slice(0, 97)}...` : description;
    const siteHost = new URL(getSiteUrl()).host;

    return new ImageResponse(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1e1b4b 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* 배경 패턴 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
                               radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)`,
          }}
        />

        {/* 메인 콘텐츠 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
          }}
        >
          {/* 로고/아이콘 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              borderRadius: '24px',
              marginBottom: '32px',
              boxShadow: '0 20px 40px rgba(59, 130, 246, 0.3)',
            }}
          >
            <span style={{ fontSize: '48px' }}>🚀</span>
          </div>

          {/* 타이틀 */}
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              background:
                'linear-gradient(90deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              margin: 0,
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {safeTitle}
          </h1>

          {/* 서브타이틀 */}
          <p
            style={{
              fontSize: '28px',
              color: '#94a3b8',
              margin: 0,
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            {safeDescription}
          </p>

          {/* 기술 스택 태그 */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {DEFAULTS.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  borderRadius: '9999px',
                  color: '#93c5fd',
                  fontSize: '18px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#64748b',
            fontSize: '16px',
          }}
        >
          <span>{siteHost}</span>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    logger.error('Error generating OG image:', error);

    // 에러 발생 시 간단한 폴백 이미지 반환
    return new ImageResponse(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <span style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</span>
        <h1 style={{ color: '#60a5fa', fontSize: '48px', margin: 0 }}>
          OpenManager AI
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '24px' }}>
          AI Native Server Monitoring
        </p>
      </div>,
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
