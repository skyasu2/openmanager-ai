/**
 * 📝 Server Logs API v2.0 (Supabase 영구 저장)
 *
 * ✅ 로그 조회 (GET) - Supabase에서 조회
 * ✅ 로그 추가 (POST) - Supabase에 저장
 * ✅ 로그 정리 (DELETE) - 7일 이상 오래된 로그 삭제
 *
 * @refactored 2026-01-03 - In-memory → Supabase 영구 저장
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAdminAuth, withAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logging';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/types/type-utils';

// 타입 정의
type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  id: string;
  server_id: string;
  level: LogLevel;
  message: string;
  source: string;
  context?: unknown;
  timestamp: string;
}

/**
 * 📝 GET - 로그 조회
 *
 * Query params:
 * - server_id: 특정 서버의 로그만 조회 (필수)
 * - levels: 로그 레벨 필터 (쉼표 구분, 예: 'warn,error')
 * - limit: 조회 개수 (기본 50)
 * - offset: 페이지네이션 오프셋
 */
async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('server_id');
    const levels = searchParams.get('levels');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!serverId) {
      return NextResponse.json(
        {
          success: false,
          error: 'server_id is required',
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 쿼리 빌드
    let query = supabase
      .from('server_logs')
      .select('*', { count: 'exact' })
      .eq('server_id', serverId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    // 레벨 필터 적용
    if (levels) {
      const levelArray = levels.split(',') as LogLevel[];
      query = query.in('level', levelArray);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('로그 조회 Supabase 오류:', error);
      return NextResponse.json(
        {
          success: false,
          error: '로그 조회 중 오류가 발생했습니다.',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: data || [],
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('로그 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '로그 조회 중 오류가 발생했습니다.',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 📊 POST - 로그 추가
 *
 * Body:
 * - server_id: 서버 ID (필수)
 * - level: 로그 레벨 (info, warn, error)
 * - message: 로그 메시지 (필수)
 * - source: 로그 소스 (기본: 'system')
 * - context: 추가 컨텍스트 (선택)
 */
async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      server_id,
      level = 'info',
      message,
      source = 'system',
      context,
    } = body;

    if (!server_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'server_id is required',
        },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: 'message is required',
        },
        { status: 400 }
      );
    }

    // 레벨 검증
    if (!['info', 'warn', 'error'].includes(level)) {
      return NextResponse.json(
        {
          success: false,
          error: 'level must be one of: info, warn, error',
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('server_logs')
      .insert({
        server_id,
        level,
        message,
        source,
        context: context || null,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('로그 추가 Supabase 오류:', error);
      return NextResponse.json(
        {
          success: false,
          error: '로그 추가 중 오류가 발생했습니다.',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('로그 추가 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '로그 추가 중 오류가 발생했습니다.',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 🗑️ DELETE - 오래된 로그 정리 (7일 보관)
 *
 * Query params:
 * - keepDays: 보관 기간 (기본: 7일)
 */
async function handleDELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keepDays = parseInt(searchParams.get('keepDays') || '7');

    const supabase = await createClient();

    // 7일 이전 로그 삭제
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    const { error, count } = await supabase
      .from('server_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      logger.error('로그 정리 Supabase 오류:', error);
      return NextResponse.json(
        {
          success: false,
          error: '로그 정리 중 오류가 발생했습니다.',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        deletedCount: count || 0,
        message: `${count || 0}개의 로그가 삭제되었습니다.`,
      },
    });
  } catch (error) {
    logger.error('로그 정리 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '로그 정리 중 오류가 발생했습니다.',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

// 인증 래핑: GET/POST는 일반 인증, DELETE는 관리자 인증
export const GET = withAuth(handleGET);
export const POST = withAuth(handlePOST);
export const DELETE = withAdminAuth(handleDELETE);
