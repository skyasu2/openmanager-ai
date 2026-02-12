import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging';

/**
 * GitHub OAuth 토큰 무효화 API
 * GitHub OAuth 앱에서 발급한 토큰을 안전하게 무효화하고 완전 로그아웃 구현
 */
export async function POST(request: NextRequest) {
  try {
    const { access_token } = await request.json();

    if (!access_token) {
      return NextResponse.json(
        { error: 'access_token이 필요합니다' },
        { status: 400 }
      );
    }

    logger.info('🔐 GitHub OAuth 토큰 무효화 시작');

    // GitHub API를 사용하여 OAuth 토큰 무효화
    // DELETE /applications/{client_id}/token
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.warn('⚠️ GitHub OAuth 설정 없음 - 토큰 무효화 스킵');
      return NextResponse.json(
        { message: 'GitHub OAuth 설정이 없어 토큰 무효화를 스킵합니다' },
        { status: 200 }
      );
    }

    // GitHub API에 토큰 무효화 요청
    const response = await fetch(
      `https://api.github.com/applications/${clientId}/token`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'OpenManager-AI-v8',
        },
        body: JSON.stringify({
          access_token,
        }),
      }
    );

    if (response.ok) {
      logger.info('✅ GitHub OAuth 토큰 무효화 성공');
      return NextResponse.json({
        success: true,
        message: 'GitHub OAuth 토큰이 성공적으로 무효화되었습니다.',
      });
    } else {
      const errorText = await response.text();
      logger.warn('⚠️ GitHub OAuth 토큰 무효화 실패:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      // GitHub API 호출 실패 - 502 반환하되 로그아웃 자체는 완료 상태로 표시
      return NextResponse.json(
        {
          success: false,
          logoutCompleted: true,
          message: 'GitHub 토큰 무효화에 실패했으나 로그아웃은 완료되었습니다',
          error: errorText,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    logger.error('❌ GitHub OAuth 토큰 무효화 오류:', error);

    // 서버 내부 오류 - 500 반환하되 로그아웃 자체는 완료 상태로 표시
    return NextResponse.json(
      {
        success: false,
        logoutCompleted: true,
        message:
          '서버 오류로 GitHub 토큰 무효화에 실패했으나 로그아웃은 완료되었습니다',
        error: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}
