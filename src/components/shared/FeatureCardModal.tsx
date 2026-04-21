'use client';

import { Bot, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getDiagramByCardId } from '@/data/architecture-diagrams.data';
import { logger } from '@/lib/logging';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import type { FeatureCardModalProps } from '@/types/feature-card.types';
import { parseMarkdownLinks } from '@/utils/markdown-parser';
import {
  buildCategorizedTechData,
  getSafeCardData,
  sanitizeModalText,
} from './FeatureCardModal.utils';
import { FeatureCardModalHeader } from './FeatureCardModalHeader';
import type { ReactFlowDiagramProps } from './ReactFlowDiagram';
import { TechStackSection } from './TechStackSection';
import { VibeCiCdSection } from './VibeCiCdSection';
import { VibeHistorySection } from './VibeHistorySection';

// React Flow는 클라이언트 사이드에서만 렌더링 (SSR 비활성화)
const ReactFlowDiagram = dynamic<ReactFlowDiagramProps>(
  () => import('./ReactFlowDiagram'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-card-lg items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-purple-500" />
      </div>
    ),
  }
);

export default function FeatureCardModal({
  selectedCard,
  onClose,
  renderTextWithAIGradient,
  modalRef,
  variant = 'home',
  isVisible,
}: FeatureCardModalProps) {
  // 모달은 항상 다크 테마로 고정
  // 바이브 코딩 카드 전용 모드 상태
  const [vibeView, setVibeView] = React.useState<
    'current' | 'history' | 'cicd'
  >('current');
  // 아키텍처 다이어그램 뷰 상태 (모든 카드에 적용)
  const [showDiagram, setShowDiagram] = React.useState(false);
  const selectedCardId = selectedCard?.id ?? null;

  // 모달이 열릴 때 기본 상세보기 모드로 초기화
  useEffect(() => {
    if (isVisible) {
      setShowDiagram(false);
      setVibeView('current');
    }
  }, [isVisible]);

  // 카드 전환 시 기본 상세보기 모드로 초기화
  useEffect(() => {
    if (!isVisible || !selectedCardId) return;
    setShowDiagram(false);
    setVibeView('current');
  }, [isVisible, selectedCardId]);

  // AI 상태 확인 (AI 제한 처리용)
  const aiAgentEnabled = useUnifiedAdminStore(
    (state) => state.aiAgent.isEnabled
  );

  // 내부 ref (외부 modalRef가 없을 경우 대체)
  const internalRef = useRef<HTMLDivElement>(null);
  const actualModalRef = modalRef || internalRef;

  // 🔧 P0: 통합 키보드 핸들러 (ESC 닫기 + Tab 포커스 트래핑)
  useEffect(() => {
    if (!isVisible) return;

    const modal =
      actualModalRef && 'current' in actualModalRef
        ? actualModalRef.current
        : null;

    // 이전 활성 요소 저장 (모달 닫을 때 복원용)
    const previousActiveElement = document.activeElement as HTMLElement | null;

    // 포커스 가능 요소 조회
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusableElements = () =>
      modal
        ? modal.querySelectorAll<HTMLElement>(focusableSelector)
        : ([] as unknown as NodeListOf<HTMLElement>);

    // 모달 열릴 때 첫 포커스 가능한 요소로 이동
    getFocusableElements()[0]?.focus();

    // 🔧 단일 이벤트 리스너로 ESC + Tab 모두 처리 (성능 최적화)
    // Tab 핸들러는 매 keydown마다 DOM을 재조회하여 showDiagram/vibeView 전환 후에도 stale 방지
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC: 모달 닫기
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Tab: 포커스 트래핑 (현재 DOM 기준으로 재조회)
      if (e.key === 'Tab') {
        const els = getFocusableElements();
        const firstFocusable = els[0];
        const lastFocusable = els[els.length - 1];
        if (!firstFocusable || !lastFocusable) return;

        if (e.shiftKey) {
          // Shift + Tab: 첫 요소에서 마지막으로 순환
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab: 마지막 요소에서 첫 요소로 순환
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // 모달 닫힐 때 이전 포커스 복원
      previousActiveElement?.focus();
    };
  }, [isVisible, actualModalRef, onClose]);

  // 🎯 Gemini 제안: 타입 안전성 강화 + 의존성 최적화
  const cardData = React.useMemo(() => {
    return getSafeCardData(selectedCard);
  }, [selectedCard]); // selectedCard 전체 객체 의존성

  // 일관된 구조분해 할당 (Hook 순서에 영향 없음)
  const { title, icon: Icon, gradient, detailedContent, requiresAI } = cardData;

  // 다이어그램 데이터 조회
  const diagramData = React.useMemo(() => {
    if (!cardData.id) return null;
    return getDiagramByCardId(cardData.id);
  }, [cardData.id]);

  // 🎯 Qwen 제안: 메모리 효율성 개선 - 단일 순회로 모든 중요도별 분류 처리
  const categorizedTechData = React.useMemo(() => {
    return buildCategorizedTechData(cardData.id, vibeView === 'history');
  }, [cardData.id, vibeView]);

  // 기술 스택 배열 추출 (항상 배열)
  const {
    critical: criticalTech,
    high: highTech,
    medium: mediumTech,
    low: lowTech,
  } = categorizedTechData.categorized;

  // 바이브 히스토리 스테이지 추출
  const vibeHistoryStages = categorizedTechData.historyStages;

  // 🛡️ Codex 제안: 런타임 안전성 검증
  const renderModalSafely = () => {
    try {
      if (!cardData.id && isVisible) {
        return (
          <div className="p-6 text-center text-white">
            <p>모달을 불러올 수 없습니다.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded bg-red-600 px-4 py-2"
            >
              닫기
            </button>
          </div>
        );
      }
      return mainContent;
    } catch (error) {
      logger.error('Modal rendering error:', error);
      return (
        <div className="p-6 text-center text-white">
          <p>모달을 불러오는 중 오류가 발생했습니다.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded bg-red-600 px-4 py-2"
          >
            닫기
          </button>
        </div>
      );
    }
  };

  const mainContent = (
    <div
      className={
        showDiagram ? 'px-3 pb-3 pt-2 text-white sm:px-4' : 'p-6 text-white'
      }
    >
      {/* 아키텍처 다이어그램 뷰 (React Flow 기반) */}
      {/* 🔧 key prop: showDiagram 전환 시 ReactFlow 완전 재마운트 (fitView 재계산 보장) */}
      {showDiagram && diagramData ? (
        <ReactFlowDiagram
          key={`diagram-${cardData.id}`}
          diagram={diagramData}
          compact
          showControls
          showHeader={false}
          showLegend={false}
          maximizeViewport
        />
      ) : (
        <>
          {/* 헤더 섹션 — CI/CD 탭은 compact (아이콘·설명 축소) */}
          {vibeView === 'cicd' ? (
            <div className="mb-4 flex items-center justify-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${gradient}`}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-lg font-bold">
                {renderTextWithAIGradient(title)}
                <span className="ml-2 text-base font-medium text-amber-400">
                  • CI/CD
                </span>
              </h3>
              <p id="modal-description" className="sr-only">
                로컬 검증 뒤에 GitLab CI가 검사와 배포를 나눠 실행하고,
                production 배포를 한 번에 하나씩만 진행하는 흐름을 보여줍니다.
              </p>
            </div>
          ) : (
            <div className="mb-8 text-center">
              <div
                className={`mx-auto mb-4 h-16 w-16 rounded-2xl bg-linear-to-br ${gradient} flex items-center justify-center`}
              >
                <Icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-3 text-2xl font-bold">
                {renderTextWithAIGradient(title)}
                {/* 바이브 코딩 카드 전용 뷰 표시 */}
                {cardData.id === 'vibe-coding' && (
                  <span className="ml-2 text-lg font-medium text-amber-400">
                    {vibeView === 'history'
                      ? '• 개발 환경 변화'
                      : '• 현재 도구'}
                  </span>
                )}
              </h3>
              <p
                id="modal-description"
                className="mx-auto max-w-2xl text-sm text-gray-300"
              >
                {cardData.id === 'vibe-coding'
                  ? vibeView === 'history'
                    ? '바이브 코딩 여정: 초기(ChatGPT 개별 페이지) → 중기(Cursor + Vercel + Supabase) → 후기(Claude Code + WSL)로 이어진 개발 환경의 변화를 시간 순서대로 보여줍니다.'
                    : parseMarkdownLinks(
                        sanitizeModalText(detailedContent.overview)
                      )
                  : parseMarkdownLinks(
                      sanitizeModalText(detailedContent.overview)
                    )}
              </p>
            </div>
          )}

          {/* AI Sub-Sections (Grid Layout) */}
          {cardData.subSections && (
            <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {cardData.subSections.map((section) => (
                <div
                  key={section.title}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:shadow-xl"
                >
                  {/* Gradient Border/Glow effect on hover */}
                  <div
                    className={`absolute inset-0 bg-linear-to-br ${section.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-10`}
                  />

                  <div className="relative z-10">
                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br ${section.gradient}`}
                    >
                      <section.icon className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="mb-2 text-base font-bold text-white">
                      {section.title}
                    </h4>
                    <p className="mb-4 text-xs leading-relaxed text-gray-300">
                      {section.description}
                    </p>
                    <ul className="space-y-1.5">
                      {section.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-gray-400"
                        >
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-white/40" />
                          <span>{parseMarkdownLinks(feature)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI 제한 경고 배너 */}
          {requiresAI && !aiAgentEnabled && (
            <div className="mb-8 rounded-xl border-2 border-orange-500/30 bg-linear-to-r from-orange-500/20 via-amber-500/15 to-orange-500/20 p-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/30">
                    <Bot className="h-5 w-5 text-orange-300" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="mb-2 font-semibold text-orange-300">
                    🤖 AI 어시스턴트 모드 필요
                  </h4>
                  <p className="text-sm leading-relaxed text-orange-200/90">
                    이 기능을 사용하려면 AI 어시스턴트 모드를 활성화해야 합니다.
                    메인 페이지로 돌아가서 AI 모드를 켜주세요.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-orange-300/80">
                    <Zap className="h-4 w-4" />
                    <span>AI 모드는 항상 무료로 사용할 수 있습니다</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 바이브 코딩 히스토리 섹션 또는 중요도별 기술 스택 섹션 */}
          {cardData.id === 'vibe-coding' &&
          vibeView === 'history' &&
          vibeHistoryStages ? (
            <VibeHistorySection historyStages={vibeHistoryStages} />
          ) : cardData.id === 'vibe-coding' && vibeView === 'cicd' ? (
            <VibeCiCdSection diagram={diagramData} />
          ) : (
            <TechStackSection
              criticalTech={criticalTech}
              highTech={highTech}
              mediumTech={mediumTech}
              lowTech={lowTech}
            />
          )}
        </>
      )}
    </div>
  );

  // ✅ Portal 기반 모달 렌더링 (AI 교차검증 기반 개선)
  // 클라이언트 사이드에서만 Portal 렌더링하고, isVisible과 selectedCard로 가시성 제어

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2 ${
        isVisible && selectedCard
          ? 'pointer-events-auto opacity-100'
          : 'pointer-events-none opacity-0'
      } transition-opacity duration-300 motion-reduce:transition-none`}
      data-modal-version="v4.0-ai-cross-verified"
      aria-hidden={!isVisible || !selectedCard}
      role="presentation"
      onMouseDown={(event) => {
        // 모달 컨텐츠 외부(backdrop) 클릭만 닫기 처리
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {/* 개선된 배경 블러 효과 */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        aria-hidden
      />

      {/* 모달 컨텐츠 - Hook 안정화를 위해 항상 렌더링 */}
      {/* 🔧 P1: dvh 단위로 모바일 주소바 문제 해결, motion-reduce 지원 */}
      <div
        ref={actualModalRef}
        className={`relative z-10 w-full transform overflow-hidden rounded-2xl border border-gray-600/50 bg-linear-to-br from-gray-900 via-gray-900 to-gray-800 shadow-2xl transition-all duration-300 motion-reduce:transition-none ${
          showDiagram
            ? 'max-h-[92dvh] max-w-[72vw] sm:max-w-[68vw] lg:max-w-4xl xl:max-w-5xl'
            : 'max-h-[80dvh] max-w-[92vw] sm:max-w-lg md:max-w-xl lg:max-w-3xl'
        } ${!cardData.id ? 'hidden' : ''}`}
        data-modal-content="portal-unified-v4-ai-cross-verified"
        style={{
          transform: isVisible && cardData.id ? 'scale(1)' : 'scale(0.95)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        tabIndex={-1}
      >
        {/* Hook 안정화: 조건부 렌더링 제거, CSS로 가시성 제어 */}

        <div
          className={`absolute left-0 right-0 top-0 h-48 bg-linear-to-b ${gradient} opacity-20 blur-3xl`}
        ></div>
        <div className="relative z-10 flex h-full flex-col">
          <FeatureCardModalHeader
            title={title}
            Icon={Icon}
            showDiagram={showDiagram}
            diagramData={diagramData}
            cardId={cardData.id ?? undefined}
            vibeView={vibeView}
            variant={variant ?? 'home'}
            onToggleDiagram={() => setShowDiagram(!showDiagram)}
            onSetVibeView={setVibeView}
            onClose={onClose}
          />
          <div
            className="overflow-y-auto scroll-smooth"
            style={{
              maxHeight: showDiagram
                ? 'calc(92dvh - 62px)' // 다이어그램 모드: 상단 헤더 압축 + 모달 높이 확장
                : 'calc(80dvh - 70px)', // 상세 모드: 모달 max-h-[80dvh]에 맞춤
            }}
          >
            {renderModalSafely()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
