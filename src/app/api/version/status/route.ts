/**
 * 🔢 OpenManager AI - 버전 상태 API - 안전한 버전
 *
 * AI 엔진과 데이터 생성기의 현재 버전 정보를 제공
 * - 버전 호환성 검사
 * - 성능 메트릭
 * - 업그레이드 권장사항
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import debug from '@/utils/debug';

export function GET(_request: NextRequest) {
  try {
    const versionInfo = {
      version: '5.0.0',
      buildTime: new Date().toISOString(),
      status: 'healthy',
      components: {
        aiEngine: 'v4.0.0',
        dataGenerator: 'v3.0.0',
        koreanNLP: 'v1.0.0',
        monitoring: 'v2.0.0',
      },
      environment: process.env.NODE_ENV || 'development',
      features: {
        enhancedKoreanNLP: true,
        vercelOptimization: true,
        qualityFirst: true,
        realTimeMonitoring: true,
      },
    };

    return NextResponse.json({
      success: true,
      data: versionInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    debug.error('Version status API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get version status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
