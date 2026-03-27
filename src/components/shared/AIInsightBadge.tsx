/**
 * AI Insight Badge v1.0
 *
 * 서버 메트릭 기반 AI 분석 결과를 배지로 표시
 * - Stable: 모든 메트릭 정상
 * - Warning: 현재 수치 주의 필요
 * - Rising: 사용량 증가 추세
 * - Unusual: 비정상 패턴 감지
 * - Critical: 즉시 조치 필요
 */

import { Brain, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';

export type InsightType =
  | 'stable'
  | 'warning'
  | 'rising'
  | 'declining'
  | 'unusual'
  | 'critical';

interface AIInsightBadgeProps {
  cpu: number;
  memory: number;
  disk?: number;
  status?: string;
  historyData?: Array<{ cpu: number; memory: number }>;
  className?: string;
}

interface InsightResult {
  type: InsightType;
  label: string;
  description: string;
  icon: React.ReactNode;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
}

/**
 * 메트릭 트렌드 분석 (최근 데이터 기준)
 */
function analyzeTrend(data: number[]): 'rising' | 'declining' | 'stable' {
  if (!data || data.length < 3) return 'stable';

  const recent = data.slice(-5);
  const first = recent[0] ?? 0;
  const last = recent[recent.length - 1] ?? 0;
  const diff = last - first;

  if (diff > 10) return 'rising';
  if (diff < -10) return 'declining';
  return 'stable';
}

/**
 * AI 인사이트 결정 로직
 */
function determineInsight(
  cpu: number,
  memory: number,
  disk: number,
  status: string | undefined,
  historyData?: Array<{ cpu: number; memory: number }>
): InsightResult {
  const cpuCritical = cpu >= 85;
  const memoryCritical = memory >= 90;
  const diskCritical = disk >= 95;
  const cpuWarning = cpu >= 70;
  const memoryWarning = memory >= 80;
  const diskWarning = disk >= 80;

  // 서버 상태가 이미 critical/offline이면 카드의 핵심 상태와 모순되지 않게 맞춘다.
  if (
    status === 'critical' ||
    status === 'offline' ||
    cpuCritical ||
    memoryCritical ||
    diskCritical
  ) {
    return {
      type: 'critical',
      label: 'Critical',
      description: '즉시 조치 필요',
      icon: <Zap className="h-3 w-3" />,
      colors: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
      },
    };
  }

  // 트렌드 분석
  const cpuTrend = analyzeTrend(historyData?.map((h) => h.cpu) || []);
  const memoryTrend = analyzeTrend(historyData?.map((h) => h.memory) || []);
  const hasWarningLevel =
    status === 'warning' || cpuWarning || memoryWarning || diskWarning;

  // Unusual: Warning 임계치 + 상승 추세
  if (hasWarningLevel && (cpuTrend === 'rising' || memoryTrend === 'rising')) {
    return {
      type: 'unusual',
      label: 'Unusual',
      description: '비정상 부하 증가',
      icon: <Brain className="h-3 w-3" />,
      colors: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-300',
      },
    };
  }

  if (hasWarningLevel) {
    return {
      type: 'warning',
      label: 'Warning',
      description: '주의 필요',
      icon: <Brain className="h-3 w-3" />,
      colors: {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-300',
      },
    };
  }

  // Rising: 정상 범위이지만 상승 추세
  if (cpuTrend === 'rising' || memoryTrend === 'rising') {
    return {
      type: 'rising',
      label: 'Rising',
      description: '사용량 증가 추세',
      icon: <TrendingUp className="h-3 w-3" />,
      colors: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-300',
      },
    };
  }

  // Declining: 하락 추세
  if (cpuTrend === 'declining' && memoryTrend === 'declining') {
    return {
      type: 'declining',
      label: 'Declining',
      description: '사용량 감소 추세',
      icon: <TrendingDown className="h-3 w-3" />,
      colors: {
        bg: 'bg-teal-100',
        text: 'text-teal-700',
        border: 'border-teal-300',
      },
    };
  }

  // Stable: 기본 상태
  return {
    type: 'stable',
    label: 'Stable',
    description: '정상 운영 중',
    icon: <Brain className="h-3 w-3" />,
    colors: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-300',
    },
  };
}

export const AIInsightBadge: React.FC<AIInsightBadgeProps> = ({
  cpu,
  memory,
  disk = 30,
  status,
  historyData,
  className = '',
}) => {
  const insight = useMemo(
    () => determineInsight(cpu, memory, disk, status, historyData),
    [cpu, memory, disk, status, historyData]
  );

  return (
    <output
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all duration-200 hover:scale-105 ${insight.colors.bg} ${insight.colors.text} ${insight.colors.border} ${className}`}
      title={insight.description}
      aria-label={`AI 분석: ${insight.label} - ${insight.description}`}
    >
      {insight.icon}
      <span>{insight.label}</span>
    </output>
  );
};
