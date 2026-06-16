'use client';

/**
 * WelcomePromptCards - AI 채팅 웰컴 화면 제안 프롬프트
 *
 * @description
 * - ChatGPT 스타일 제안 프롬프트 카드 컴포넌트
 * - 2열 그리드 레이아웃
 * - EnhancedAIChat에서 분리하여 재사용 가능
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Bot,
  FileText,
  Server,
  Terminal,
  TrendingUp,
} from 'lucide-react';
import { memo } from 'react';
import type { ServerStatus } from '@/types/server';

type ResourceMetricKey = 'CPU' | 'MEM' | 'DISK';

export interface WelcomeServerMetric {
  id: string;
  name: string;
  status: ServerStatus;
  cpu?: number;
  memory?: number;
  disk?: number;
}

/**
 * 제안 프롬프트 타입
 */
export interface StarterPrompt {
  icon: LucideIcon;
  title: string;
  prompt: string;
  description?: string;
  iconBg: string;
  iconColor: string;
  tone?: 'alert' | 'healthy' | 'analysis' | 'report';
}

interface WelcomeSystemSnapshot {
  total: number;
  online: number;
  warning: number;
  critical: number;
  offline: number;
  cpuAverage: number;
  topRisk?: {
    serverName: string;
    metricLabel: ResourceMetricKey;
    metricValue: number;
  };
}

const OPS_PROCEDURE_STARTER_PROMPT: StarterPrompt = {
  icon: Terminal,
  title: '운영 스크립트',
  prompt: '🔧 CPU 알림 bash 스크립트 짜줘',
  description: 'CPU 알림 bash/runbook/alert-rule 생성',
  iconBg: 'bg-slate-100',
  iconColor: 'text-slate-600',
  tone: 'analysis',
};

/**
 * 기본 제안 프롬프트 목록
 * - 서버 모니터링 도메인에 최적화
 * - slate/blue 단색 아이콘 (무지개 그라데이션 제거)
 */
export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    icon: Server,
    title: '전체 서버 상태',
    prompt: '현재 모든 서버의 상태를 요약해줘',
    description: '상태·리소스·알림을 한 번에 확인',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    tone: 'healthy',
  },
  {
    icon: AlertTriangle,
    title: '리스크 서버 분석',
    prompt: 'CPU 사용률이 높은 서버를 찾아줘',
    description: '임계값에 가까운 서버 우선 점검',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
    tone: 'alert',
  },
  {
    icon: TrendingUp,
    title: '성능 추세',
    prompt: '최근 추세 기준으로 다음 24시간 리스크를 요약해줘',
    description: '24시간 추세와 예측 리스크',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    tone: 'analysis',
  },
  {
    icon: FileText,
    title: '보고서 생성',
    prompt: '오늘의 시스템 요약 보고서를 만들어줘',
    description: '운영 공유용 요약 보고서',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    tone: 'report',
  },
  {
    icon: Activity,
    title: '이상 징후 요약',
    prompt: '지난 1시간 동안 이상 징후를 요약해줘',
    description: '최근 알림과 메트릭 변화 확인',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    tone: 'analysis',
  },
  OPS_PROCEDURE_STARTER_PROMPT,
];

function toFinitePercent(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getHighestResource(server: WelcomeServerMetric): {
  metricLabel: ResourceMetricKey;
  metricValue: number;
} {
  const metrics = [
    { metricLabel: 'CPU' as const, metricValue: toFinitePercent(server.cpu) },
    {
      metricLabel: 'MEM' as const,
      metricValue: toFinitePercent(server.memory),
    },
    { metricLabel: 'DISK' as const, metricValue: toFinitePercent(server.disk) },
  ];

  return metrics.reduce((highest, current) =>
    current.metricValue > highest.metricValue ? current : highest
  );
}

export function buildWelcomeSystemSnapshot(
  servers: readonly WelcomeServerMetric[] | undefined
): WelcomeSystemSnapshot | null {
  if (!servers?.length) {
    return null;
  }

  const activeServers = servers.filter((server) => server.status !== 'offline');
  const averageSource = activeServers.length > 0 ? activeServers : servers;
  const cpuAverage = Math.round(
    averageSource.reduce(
      (total, server) => total + toFinitePercent(server.cpu),
      0
    ) / averageSource.length
  );
  const topRisk = servers
    .map((server) => {
      const topResource = getHighestResource(server);
      const statusWeight =
        server.status === 'critical'
          ? 1000
          : server.status === 'warning'
            ? 500
            : server.status === 'offline'
              ? 250
              : 0;
      return {
        serverName: server.name,
        ...topResource,
        score: statusWeight + topResource.metricValue,
      };
    })
    .sort((a, b) => b.score - a.score)[0];

  return {
    total: servers.length,
    online: servers.filter((server) => server.status === 'online').length,
    warning: servers.filter((server) => server.status === 'warning').length,
    critical: servers.filter((server) => server.status === 'critical').length,
    offline: servers.filter((server) => server.status === 'offline').length,
    cpuAverage,
    topRisk: topRisk
      ? {
          serverName: topRisk.serverName,
          metricLabel: topRisk.metricLabel,
          metricValue: Math.round(topRisk.metricValue),
        }
      : undefined,
  };
}

function buildDynamicPrompts(snapshot: WelcomeSystemSnapshot | null) {
  if (!snapshot?.topRisk) {
    return STARTER_PROMPTS.slice(0, 4);
  }

  const alertCount = snapshot.warning + snapshot.critical;
  const firstPrompt: StarterPrompt =
    alertCount > 0 || snapshot.topRisk.metricValue >= 70
      ? {
          icon: AlertTriangle,
          title: `${snapshot.topRisk.serverName} ${snapshot.topRisk.metricLabel} ${snapshot.topRisk.metricValue}%`,
          prompt: `${snapshot.topRisk.serverName} 서버의 ${snapshot.topRisk.metricLabel} ${snapshot.topRisk.metricValue}% 원인과 즉시 조치 우선순위를 분석해줘`,
          description: '현재 데이터 기준 최우선 점검 대상',
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-700',
          tone: 'alert',
        }
      : {
          icon: Server,
          title: '정상 상태 유지 점검',
          prompt: '현재 정상 상태를 유지하기 위한 예방 점검 항목을 요약해줘',
          description: '현재 리소스 기준 예방 점검',
          iconBg: 'bg-emerald-50',
          iconColor: 'text-emerald-700',
          tone: 'healthy',
        };

  return [
    firstPrompt,
    {
      icon: TrendingUp,
      title: '오늘 성능 추세',
      prompt: '오늘 성능 추세와 다음 24시간 리스크를 요약해줘',
      description: 'CPU·메모리·디스크 변화 확인',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      tone: 'analysis',
    },
    {
      icon: Activity,
      title: '지난 1시간 이상 징후',
      prompt: '지난 1시간 동안 이상 징후와 우선 조치 대상을 요약해줘',
      description: '최근 알림과 리소스 급등 확인',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-700',
      tone: 'analysis',
    },
    {
      icon: FileText,
      title: '장애 보고서 생성',
      prompt: '현재 상태 기준 장애 보고서 초안을 생성해줘',
      description: '공유 가능한 운영 보고서 작성',
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-700',
      tone: 'report',
    },
    OPS_PROCEDURE_STARTER_PROMPT,
  ];
}

interface WelcomePromptCardsProps {
  /** 프롬프트 클릭 시 호출되는 핸들러 */
  onPromptClick: (prompt: string) => void;
  /** 커스텀 프롬프트 목록 (선택적) */
  prompts?: StarterPrompt[];
  /** 현재 서버 상태 데이터 */
  servers?: readonly WelcomeServerMetric[];
}

/**
 * 웰컴 화면 컴포넌트
 * - 빈 채팅 상태에서 표시
 * - 제안 프롬프트 카드 그리드
 */
export const WelcomePromptCards = memo(function WelcomePromptCards({
  onPromptClick,
  prompts,
  servers,
}: WelcomePromptCardsProps) {
  const snapshot = buildWelcomeSystemSnapshot(servers);
  const promptCards = prompts ?? buildDynamicPrompts(snapshot);
  const alertCount = (snapshot?.warning ?? 0) + (snapshot?.critical ?? 0);
  const summaryText = snapshot
    ? `${snapshot.total}대 중 ${snapshot.online}대 온라인 · 경고 ${alertCount}건${
        snapshot.offline > 0 ? ` · 오프라인 ${snapshot.offline}대` : ''
      } · CPU 평균 ${snapshot.cpuAverage}%`
    : '18대 관측 서버의 최신 상태를 불러오는 중';

  return (
    <div className="flex h-full flex-col items-center justify-center py-10">
      {/* 로고 및 인사말 */}
      <div className="mb-5 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 shadow-sm">
          <Bot className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          운영 상태를 어디부터 볼까요?
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          현재 관측 데이터를 기준으로 바로 분석할 수 있습니다
        </p>
      </div>

      <div className="mb-4 flex w-full max-w-xl items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            시스템 스냅샷
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {summaryText}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            alertCount > 0
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {alertCount > 0 ? '점검 필요' : '정상 관측'}
        </span>
      </div>

      {/* 제안 프롬프트 카드 그리드 */}
      <div className="grid max-w-xl grid-cols-1 gap-3 px-4 sm:grid-cols-2">
        {promptCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <button
              type="button"
              key={card.title}
              data-testid="ai-starter-prompt-card"
              data-prompt-index={index}
              data-prompt-title={card.title}
              onClick={() => onPromptClick(card.prompt)}
              className="group rounded-lg border border-gray-200 bg-white p-4 text-left
                         transition-all hover:border-slate-300 hover:shadow-sm
                         active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:outline-hidden"
            >
              <div
                className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                <Icon
                  className={`h-4 w-4 ${card.iconColor}`}
                  aria-hidden="true"
                />
              </div>
              <h4 className="font-medium text-gray-900 group-hover:text-blue-700">
                {card.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                {card.description ?? card.prompt}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
});

WelcomePromptCards.displayName = 'WelcomePromptCards';
