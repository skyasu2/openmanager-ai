import { tool } from 'ai';
import { z } from 'zod';
import type {
  DashboardType,
  FocusArea,
  ScreenshotAnalysisResult,
} from './vision-types';

export const analyzeScreenshot = tool({
  description: `대시보드 스크린샷 분석 결과를 구조화합니다.

중요: 이미지는 메시지 content로 전달됩니다. 이 도구는 시각적 분석 결과를 구조화하는 데 사용됩니다.

이 도구를 호출하기 전에:
1. 사용자가 보낸 이미지를 먼저 분석하세요
2. 발견한 이상 징후, 트렌드, 문제점을 파악하세요
3. 그 결과를 이 도구의 파라미터로 전달하세요`,

  inputSchema: z.object({
    dashboardType: z
      .enum([
        'grafana',
        'cloudwatch',
        'datadog',
        'prometheus',
        'newrelic',
        'custom',
        'unknown',
      ])
      .optional()
      .default('unknown')
      .describe('감지된 대시보드 유형'),
    focusArea: z
      .enum(['cpu', 'memory', 'disk', 'network', 'latency', 'errors', 'all'])
      .optional()
      .default('all')
      .describe('주요 분석 영역'),
    timeRange: z.string().optional().describe('대시보드에 표시된 시간 범위'),
    anomalies: z.array(z.string()).describe('발견된 이상 징후 목록'),
    trends: z.array(z.string()).optional().default([]).describe('관찰된 트렌드'),
    thresholdBreaches: z
      .array(z.string())
      .optional()
      .default([])
      .describe('임계값 초과 항목 (빨간/노란 영역)'),
    metrics: z
      .array(
        z.object({
          name: z.string().describe('메트릭 이름'),
          currentValue: z.string().describe('현재 값'),
          status: z.enum(['normal', 'warning', 'critical']).describe('상태'),
          trend: z.enum(['up', 'down', 'stable']).describe('추세'),
        }),
      )
      .optional()
      .default([])
      .describe('감지된 메트릭 목록'),
    recommendations: z.array(z.string()).optional().default([]).describe('권장 조치'),
    summary: z.string().describe('분석 요약 (1-2문장)'),
  }),

  execute: async ({
    dashboardType,
    focusArea,
    timeRange,
    anomalies,
    trends,
    thresholdBreaches,
    metrics,
    recommendations,
    summary,
  }: {
    dashboardType?: DashboardType;
    focusArea?: FocusArea;
    timeRange?: string;
    anomalies: string[];
    trends?: string[];
    thresholdBreaches?: string[];
    metrics?: {
      name: string;
      currentValue: string;
      status: 'normal' | 'warning' | 'critical';
      trend: 'up' | 'down' | 'stable';
    }[];
    recommendations?: string[];
    summary: string;
  }) => {
    if (!anomalies || anomalies.length === 0) {
      if (!summary) {
        return {
          success: false,
          error:
            '분석 결과가 제공되지 않았습니다. 이미지를 먼저 분석한 후 결과를 전달해주세요.',
          dashboardType: dashboardType || 'unknown',
          findings: {
            anomalies: [],
            trends: [],
            thresholdBreaches: [],
            recommendations: [],
          },
          metrics: [],
          summary: '분석 실패: 결과 없음',
        };
      }
    }

    const result: ScreenshotAnalysisResult = {
      success: true,
      dashboardType: dashboardType || 'unknown',
      focusArea,
      findings: {
        anomalies: anomalies || [],
        trends: trends || [],
        thresholdBreaches: thresholdBreaches || [],
        recommendations: recommendations || [],
      },
      metrics: metrics || [],
      timeRange,
      summary,
    };

    const hasCritical =
      metrics?.some((m) => m.status === 'critical') ||
      (thresholdBreaches && thresholdBreaches.length > 0);
    const hasWarning =
      metrics?.some((m) => m.status === 'warning') ||
      (anomalies && anomalies.length > 0);
    const severity = hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal';

    return {
      ...result,
      severity,
      analysisComplete: true,
    };
  },
});
