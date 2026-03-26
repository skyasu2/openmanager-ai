/**
 * GET handler - Incident Report 조회 (Read Only)
 *
 * 지원 파라미터:
 * - id: 특정 보고서 ID
 * - page: 페이지 번호 (기본 1)
 * - limit: 페이지당 개수 (기본 10)
 * - severity: 심각도 필터 (critical, high, medium, low)
 * - status: 상태 필터 (open, investigating, resolved, closed)
 * - dateRange: 기간 필터 (7d, 30d, 90d, all)
 * - search: 검색어
 */

import { type NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getErrorMessage } from '@/types/type-utils';
import { debug } from '@/utils/debug';

export async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // 특정 보고서 조회
      const { data, error } = await supabaseAdmin
        .from('incident_reports')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        report: data,
        timestamp: new Date().toISOString(),
      });
    }

    // 페이지네이션 파라미터
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('limit') || '10', 10))
    );
    const offset = (page - 1) * limit;

    // 필터 파라미터
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const dateRange = searchParams.get('dateRange');
    const search = searchParams.get('search');

    // 쿼리 빌더
    let query = supabaseAdmin
      .from('incident_reports')
      .select('*', { count: 'exact' });

    // 필터 적용
    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let fromDate: Date;
      switch (dateRange) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(0);
      }
      query = query.gte('created_at', fromDate.toISOString());
    }

    if (search) {
      // SQL LIKE 와일드카드 이스케이프 (%, _ → \%, \_)
      const escapedSearch = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      query = query.or(
        `title.ilike.%${escapedSearch}%,pattern.ilike.%${escapedSearch}%`
      );
    }

    // 정렬 및 페이지네이션
    const {
      data: reports,
      error,
      count,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      reports: reports || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      total,
      totalPages,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    debug.error('Get incident reports error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve reports',
        message: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
