/**
 * 🤖 AI 어시스턴트 기능 아이콘 패널 v3.1
 *
 * 사이드바 오른쪽에 세로로 배치되는 AI 기능 아이콘들
 * - AI Chat: 자연어로 시스템 질의 및 대화 (NLQ Agent + Advisor Agent)
 * - 자동 장애 보고서: AI 기반 장애 분석 보고서 생성 (Reporter Agent)
 * - 이상감지/예측: AI Supervisor 분석 + 예측 분석 (Analyst Agent)
 *
 * v3.1 변경사항 (2026-01-15):
 * - 문서 정리: Advisor Agent는 NLQ의 하위 기능 (Orchestrator 자동 라우팅)
 *
 * v3.0 변경사항 (2025-12-23):
 * - AI 상태관리 탭 제거 (Coming Soon 상태로 미구현)
 */

'use client';

import { FileText, Maximize2, MessageSquare, Monitor } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ComponentType, memo, useCallback } from 'react';

export type AIAssistantFunction =
  | 'chat'
  | 'auto-report'
  | 'intelligent-monitoring';

interface AIAssistantIcon {
  id: AIAssistantFunction;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

// 기능 전환 메뉴는 engine 상태와 분리된 navigation surface로 유지한다.
const AI_ASSISTANT_ICONS: AIAssistantIcon[] = [
  {
    id: 'chat',
    icon: MessageSquare,
    label: 'AI Chat',
    description: '서버 질의, 트러블슈팅, 명령어 추천',
  },
  {
    id: 'auto-report',
    icon: FileText,
    label: '자동장애 보고서',
    description: 'Reporter Agent 장애 분석 보고서 생성',
  },
  {
    id: 'intelligent-monitoring',
    icon: Monitor,
    label: '이상감지/예측',
    description: 'Analyst Agent 이상탐지, 근본원인, 예측분석',
  },
];

interface AIAssistantIconPanelProps {
  selectedFunction: AIAssistantFunction;
  onFunctionChange: (func: AIAssistantFunction) => void;
  onOpenFullscreen?: () => void;
  showFullscreenButton?: boolean;
  className?: string;
  isMobile?: boolean;
}

// 툴팁 위치 계산 유틸리티 추가
const getTooltipPosition = (index: number, total: number) => {
  const middle = Math.floor(total / 2);
  if (index < middle) {
    return 'top-0'; // 상단 아이템들은 위쪽 정렬
  } else if (index > middle) {
    return 'bottom-0'; // 하단 아이템들은 아래쪽 정렬
  } else {
    return 'top-1/2 transform -translate-y-1/2'; // 중간은 중앙 정렬
  }
};

// 🔧 P3: 메모이제이션된 아이콘 버튼 컴포넌트 (map 내 인라인 핸들러 최적화)
interface IconButtonProps {
  item: AIAssistantIcon;
  isSelected: boolean;
  onSelect: (id: AIAssistantFunction) => void;
  index?: number;
  isMobile?: boolean;
}

const IconButton = memo(function IconButton({
  item,
  isSelected,
  onSelect,
  index = 0,
  isMobile = false,
}: IconButtonProps) {
  const Icon = item.icon;

  // 🔧 useCallback으로 핸들러 메모이제이션
  const handleClick = useCallback(() => {
    onSelect(item.id);
  }, [onSelect, item.id]);

  if (isMobile) {
    return (
      <button
        type="button"
        key={item.id}
        data-testid={`ai-function-${item.id}`}
        aria-label={item.label}
        aria-pressed={isSelected}
        onClick={handleClick}
        className={`group relative h-12 w-12 shrink-0 rounded-xl border transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
          isSelected
            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        } `}
      >
        <Icon className="mx-auto h-5 w-5" aria-hidden="true" />
        {/* 모바일 툴팁 (상단 표시) - 화이트 모드 */}
        <div className="pointer-events-none absolute bottom-full left-1/2 z-60 mb-2 -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
          {item.label}
          <div className="absolute left-1/2 top-full -translate-x-1/2 transform">
            <div className="border-2 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      key={item.id}
      data-testid={`ai-function-${item.id}`}
      aria-label={item.label}
      aria-pressed={isSelected}
      onClick={handleClick}
      className={`animate-fade-in group relative h-12 w-12 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${
        isSelected
          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      } `}
      title={`${item.label}\n${item.description}`}
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <Icon className="mx-auto h-5 w-5" aria-hidden="true" />
      {/* 선택 표시 */}
      {isSelected && (
        <div className="animate-fade-in absolute -left-1 top-1/2 h-6 w-1 -translate-y-1/2 transform rounded-r-full bg-slate-900" />
      )}
      {/* 호버 툴팁 - 왼쪽으로 위치 변경 (화이트 모드) */}
      <div
        className={`absolute right-full mr-3 ${getTooltipPosition(index, AI_ASSISTANT_ICONS.length)} pointer-events-none z-60 min-w-max max-w-tooltip whitespace-nowrap rounded-lg bg-gray-800 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100`}
      >
        <div className="font-medium">{item.label}</div>
        <div className="mt-1 text-xs text-gray-300">{item.description}</div>
        {/* 툴팁 화살표 - 왼쪽 표시용으로 변경 */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 transform">
          <div className="border-4 border-transparent border-l-gray-800"></div>
        </div>
      </div>
    </button>
  );
});

IconButton.displayName = 'IconButton';

export default function AIAssistantIconPanel({
  selectedFunction,
  onFunctionChange,
  onOpenFullscreen,
  showFullscreenButton = true,
  className = '',
  isMobile = false,
}: AIAssistantIconPanelProps) {
  const router = useRouter();

  // 🔧 P3: useCallback으로 네비게이션 핸들러 메모이제이션
  const handleFullscreen = useCallback(() => {
    onOpenFullscreen?.();
    if (!onOpenFullscreen) {
      router.push('/dashboard/ai-assistant');
    }
  }, [onOpenFullscreen, router]);

  if (isMobile) {
    return (
      <div
        className={`flex flex-row space-x-2 overflow-x-auto pb-2 ${className}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {AI_ASSISTANT_ICONS.map((item) => (
          <IconButton
            key={item.id}
            item={item}
            isSelected={selectedFunction === item.id}
            onSelect={onFunctionChange}
            isMobile
          />
        ))}

        {/* 전체 화면 이동 버튼 (Mobile) */}
        {showFullscreenButton && (
          <button
            type="button"
            onClick={handleFullscreen}
            data-testid="ai-fullscreen-button"
            aria-label="전체 화면으로 열기"
            className="group relative h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 transition-all duration-200 active:scale-95 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <Maximize2 className="mx-auto h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col space-y-2 border-l border-gray-200 bg-white p-3 ${className}`}
    >
      {/* 헤더 */}
      <div className="mb-2 text-center">
        <p className="text-xs font-medium text-gray-600">AI 기능</p>
      </div>

      {/* 아이콘 버튼들 - 🔧 P3: 메모이제이션된 IconButton 사용 */}
      <div className="space-y-1">
        {AI_ASSISTANT_ICONS.map((item, index) => (
          <IconButton
            key={item.id}
            item={item}
            isSelected={selectedFunction === item.id}
            onSelect={onFunctionChange}
            index={index}
          />
        ))}
      </div>

      {/* 전체 화면 이동 버튼 (Desktop - 하단 분리) */}
      {showFullscreenButton && (
        <div className="mt-4 border-t border-gray-200 pt-2">
          <button
            type="button"
            onClick={handleFullscreen}
            data-testid="ai-fullscreen-button"
            aria-label="전체 화면으로 열기"
            className="group relative h-12 w-12 rounded-xl border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:scale-105 hover:bg-slate-50 hover:text-slate-900 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            title="전체 화면으로 열기"
          >
            <Maximize2 className="mx-auto h-5 w-5" aria-hidden="true" />

            {/* 툴팁 */}
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 pointer-events-none z-60 min-w-max whitespace-nowrap rounded-lg bg-gray-800 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
              전체 화면으로 보기
              <div className="absolute left-full top-1/2 -translate-y-1/2 transform">
                <div className="border-4 border-transparent border-l-gray-800"></div>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export type { AIAssistantIcon };
export { AI_ASSISTANT_ICONS };
