/**
 * 🧠 ThinkingProcessVisualizer Component
 * AI 지능형 라우팅 및 사고 과정을 실시간으로 시각화
 */

import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  DollarSign,
  Loader2,
  Route,
  Search,
  TrendingDown,
  Zap,
} from 'lucide-react';
import {
  type ComponentType,
  type FC,
  Fragment,
  useEffect,
  useState,
} from 'react';
import type { ThinkingStep as AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';

interface ThinkingProcessVisualizerProps {
  steps: AIThinkingStep[];
  isActive?: boolean;
  className?: string;
}

// 단계별 아이콘 및 스타일 매핑
const stepIconMap: Record<string, ComponentType<{ className?: string }>> = {
  // Legacy steps
  '캐시 확인': Database,
  '의도 분석': Brain,
  '명령어 감지': Search,
  '복잡도 분석': Activity,
  '라우팅 결정': Route,
  '통합 파이프라인 준비': Cpu,

  // 🧠 Extended Thinking Tools (NEW - Phase 2)
  analyzeIntent: Brain,
  analyzeComplexity: Activity,
  selectRoute: Route,
  searchContext: Search,
  generateInsight: Zap,

  // 📊 Action Tools (Phase 1)
  getServerMetrics: Database,
  predictIncident: TrendingDown,
  searchKnowledgeBase: Search,
  analyzeServerHealth: CheckCircle2,
  getSystemStatus: Cpu,
  checkResourceUsage: Activity,
  analyzeLogs: Search,
};

// status별 스타일
const stepStatusConfig: Record<
  'pending' | 'processing' | 'completed' | 'failed',
  {
    icon: ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  pending: {
    icon: Loader2,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  processing: {
    icon: Cpu,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  failed: {
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

export const ThinkingProcessVisualizer: FC<ThinkingProcessVisualizerProps> = ({
  steps,
  isActive = false,
  className = '',
}: ThinkingProcessVisualizerProps) => {
  const [visibleSteps, setVisibleSteps] = useState<AIThinkingStep[]>([]);

  useEffect(() => {
    if (steps.length > visibleSteps.length) {
      const timer = setTimeout(() => {
        setVisibleSteps(steps);
      }, 100);
      return () => clearTimeout(timer);
    }
    setVisibleSteps(steps);
    return undefined;
  }, [steps, visibleSteps.length]);

  // 라우팅 결정 단계 찾기
  const routingStep = visibleSteps.find((s) => s.step === '라우팅 결정');
  const isLocalRouting =
    routingStep?.description?.includes('로컬') ||
    routingStep?.description?.includes('GCP Function');
  const isCostSaving =
    routingStep?.description?.includes('비용 절약') ||
    routingStep?.description?.includes('$0');

  return (
    <div
      className={`space-y-3 rounded-lg border border-gray-200 bg-white p-4 ${className}`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <span className="font-semibold text-gray-800">🤖 AI 처리 과정</span>
        </div>
        {isActive && (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-xs text-gray-500">분석 중...</span>
          </div>
        )}
      </div>

      {/* 라우팅 요약 (라우팅 결정 후 표시) */}
      {routingStep && (
        <div
          className={`rounded-lg border p-3 ${
            isLocalRouting
              ? 'border-green-200 bg-green-50'
              : 'border-blue-200 bg-blue-50'
          }`}
        >
          <div className="flex items-start space-x-3">
            <div
              className={`rounded-full p-2 ${
                isLocalRouting ? 'bg-green-100' : 'bg-blue-100'
              }`}
            >
              {isLocalRouting ? (
                <Database className="h-5 w-5 text-green-600" />
              ) : (
                <Cloud className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-sm font-semibold ${
                    isLocalRouting ? 'text-green-800' : 'text-blue-800'
                  }`}
                >
                  {isLocalRouting ? '💾 로컬 처리' : '🤖 Cloud AI 처리'}
                </span>
                {isCostSaving && (
                  <span className="flex items-center space-x-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <DollarSign className="h-3 w-3" />
                    <span>비용 절약</span>
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600">
                {routingStep.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 사고 단계 타임라인 */}
      <div className="space-y-2">
        {visibleSteps.map((step, index) => {
          const status: 'pending' | 'processing' | 'completed' | 'failed' =
            step.status || 'pending';
          const config = stepStatusConfig[status];
          const StepIcon = (step.step && stepIconMap[step.step]) || Activity;
          const StatusIcon = config.icon;
          const isLast = index === visibleSteps.length - 1;
          const isRouting = step.step === '라우팅 결정';

          return (
            <Fragment key={step.id || index}>
              <div
                className={`relative flex items-start space-x-3 rounded-lg border p-3 transition-all ${
                  config.borderColor
                } ${config.bgColor} ${
                  isLast && isActive ? 'ring-2 ring-blue-200' : ''
                }`}
              >
                {/* 아이콘 */}
                <div
                  className={`shrink-0 rounded-full p-2 ${
                    step.status === 'completed' ? 'bg-white' : 'bg-white/50'
                  }`}
                >
                  {step.status === 'processing' || (isLast && isActive) ? (
                    <Loader2
                      className={`h-4 w-4 animate-spin ${config.color}`}
                    />
                  ) : (
                    <StepIcon className={`h-4 w-4 ${config.color}`} />
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {step.step}
                    </span>
                    {step.duration !== undefined && (
                      <span className="text-xs text-gray-500">
                        {step.duration}ms
                      </span>
                    )}
                  </div>

                  {step.description && (
                    <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  )}

                  {/* 라우팅 결정 시 추가 정보 */}
                  {isRouting && step.status === 'completed' && (
                    <div className="mt-2 flex items-center space-x-2">
                      {isLocalRouting ? (
                        <>
                          <TrendingDown className="h-3 w-3 text-green-600" />
                          <span className="text-xs font-medium text-green-700">
                            API 호출 생략
                          </span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-medium text-blue-700">
                            고급 AI 분석
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 상태 아이콘 */}
                <div className="shrink-0">
                  <StatusIcon className={`h-4 w-4 ${config.color}`} />
                </div>
              </div>

              {/* 연결선 */}
              {!isLast && <div className="ml-6 h-4 w-0.5 bg-gray-200" />}
            </Fragment>
          );
        })}
      </div>

      {/* 진행 상태 표시 */}
      {isActive && (
        <div className="mt-3 flex items-center justify-center space-x-2 rounded-lg bg-blue-50 p-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="text-xs font-medium text-blue-700">
            AI가 최적의 답변을 생성하고 있습니다...
          </span>
        </div>
      )}

      {/* 완료 요약 */}
      {!isActive && visibleSteps.length > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
          <span>총 {visibleSteps.length}단계 완료</span>
          <span>
            {visibleSteps.reduce((sum, s) => sum + (s.duration || 0), 0)}ms
          </span>
        </div>
      )}
    </div>
  );
};
