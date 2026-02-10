import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging';
import { getErrorMessage } from '@/types/type-utils';

// 간단한 하이브리드 메트릭 응답
interface HybridAnalysis {
  timestamp: string;
  summary: {
    totalServers: number;
    healthyServers: number;
    warningServers: number;
    criticalServers: number;
  };
  recommendations: string[];
  insights: string[];
}

// GET: 실시간 분석 결과 조회
export function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    // 기본 분석 결과 생성
    const analysis: HybridAnalysis = {
      timestamp: new Date().toISOString(),
      summary: {
        totalServers: 10,
        healthyServers: 7,
        warningServers: 2,
        criticalServers: 1,
      },
      recommendations: [
        '서버 #3의 메모리 사용량이 높습니다. 모니터링이 필요합니다.',
        '서버 #7의 디스크 공간이 부족합니다. 정리가 필요합니다.',
      ],
      insights: [
        '전체 시스템 성능이 안정적입니다.',
        '피크 시간대 트래픽 패턴이 정상적입니다.',
      ],
    };

    if (serverId) {
      analysis.insights.push(`서버 ${serverId}의 상태가 정상입니다.`);
    }

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('하이브리드 메트릭 브리지 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '분석 중 오류가 발생했습니다.',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

// POST: 실시간 분석 트리거
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, serverId } = body;

    if (action === 'analyze') {
      // 간단한 분석 시뮬레이션
      return NextResponse.json({
        success: true,
        message: `서버 ${serverId || '전체'}의 분석이 시작되었습니다.`,
        taskId: `task-${Date.now()}`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: '지원하지 않는 작업입니다.',
      },
      { status: 400 }
    );
  } catch (error) {
    logger.error('하이브리드 메트릭 브리지 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '처리 중 오류가 발생했습니다.',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
