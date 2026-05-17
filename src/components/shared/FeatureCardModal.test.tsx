/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_CARDS_DATA } from '@/data/feature-cards.data';
import { VIBE_CODING_DATA } from '@/data/tech-stacks/vibe-coding';
import type { FeatureCard } from '@/types/feature-card.types';
import FeatureCardModal from './FeatureCardModal';

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: (
    selector: (state: { aiAgent: { isEnabled: boolean } }) => unknown
  ) => selector({ aiAgent: { isEnabled: true } }),
}));

const vibeCard = FEATURE_CARDS_DATA.find((card) => card.id === 'vibe-coding');
const aiCard = FEATURE_CARDS_DATA.find((card) => card.id === 'ai-assistant');
const techCard = FEATURE_CARDS_DATA.find((card) => card.id === 'tech-stack');

if (!vibeCard) {
  throw new Error('vibe-coding feature card not found');
}

if (!aiCard) {
  throw new Error('ai-assistant feature card not found');
}

if (!techCard) {
  throw new Error('tech-stack feature card not found');
}

describe('FeatureCardModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = () => {
    const onClose = vi.fn();

    render(
      <FeatureCardModal
        selectedCard={vibeCard}
        onClose={onClose}
        renderTextWithAIGradient={(text) => text}
        modalRef={createRef<HTMLDivElement>()}
        isVisible
      />
    );

    return { onClose };
  };

  const renderAiModal = () => {
    render(
      <FeatureCardModal
        selectedCard={aiCard}
        onClose={vi.fn()}
        renderTextWithAIGradient={(text) => text}
        modalRef={createRef<HTMLDivElement>()}
        isVisible
      />
    );
  };

  const renderSwitchableModal = (
    selectedCard: FeatureCard | null = aiCard,
    isVisible = true
  ) => {
    const modalRef = createRef<HTMLDivElement>();
    const onClose = vi.fn();

    const view = render(
      <FeatureCardModal
        selectedCard={selectedCard}
        onClose={onClose}
        renderTextWithAIGradient={(text) => text}
        modalRef={modalRef}
        isVisible={isVisible}
      />
    );

    return {
      ...view,
      onClose,
      rerenderModal: (
        nextCard: FeatureCard | null,
        nextVisible = Boolean(nextCard)
      ) =>
        view.rerender(
          <FeatureCardModal
            selectedCard={nextCard}
            onClose={onClose}
            renderTextWithAIGradient={(text) => text}
            modalRef={modalRef}
            isVisible={nextVisible}
          />
        ),
    };
  };

  it('바이브 탭 전환 시 헤더와 본문이 함께 바뀐다', () => {
    renderModal();

    expect(screen.getByRole('button', { name: /현재 도구/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: /CI\/CD/i }));

    expect(screen.getByText('내가 구성한 GitLab CI/CD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /CI\/CD/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: /개발 환경 변화/i }));

    expect(
      screen.getByText(VIBE_CODING_DATA.history.stageMeta.stage1.title)
    ).toBeInTheDocument();
  });

  it('ESC 입력 시 onClose를 호출한다', () => {
    const { onClose } = renderModal();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('AI 어시스턴트 모달에 내부 지식 검색 구조를 설명한다', () => {
    renderAiModal();

    expect(screen.getByText('내부 지식 검색')).toBeInTheDocument();
    expect(
      screen.getAllByText(/Supabase Postgres Full Text Search/).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/repo 문서\/seed JSON을 원본 지식/)
    ).toBeInTheDocument();
    expect(screen.queryByText('RAG')).not.toBeInTheDocument();
  });

  it('카드 전환 시 이전 카드의 다이어그램 모드와 스크롤 위치를 공유하지 않는다', () => {
    const { rerenderModal } = renderSwitchableModal(aiCard);

    fireEvent.click(screen.getByRole('button', { name: /아키텍처 보기/i }));

    expect(
      screen.getByRole('img', {
        name: /AI 어시스턴트 런타임 아키텍처 다이어그램/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('다이어그램 요약')).toHaveTextContent(
      'AI 어시스턴트 런타임'
    );

    const scrollContainer = screen.getByTestId('feature-card-modal-scroll');
    scrollContainer.scrollTop = 320;

    rerenderModal(techCard);

    const nextScrollContainer = screen.getByTestId('feature-card-modal-scroll');
    expect(nextScrollContainer).toHaveAttribute('data-card-id', 'tech-stack');
    expect(nextScrollContainer).toHaveAttribute('data-view-mode', 'current');
    expect(nextScrollContainer.scrollTop).toBe(0);
    expect(
      screen.queryByRole('img', {
        name: /AI 어시스턴트 런타임 아키텍처 다이어그램/i,
      })
    ).not.toBeInTheDocument();
  });

  it('닫힌 뒤 다른 카드로 다시 열어도 이전 다이어그램 상태를 노출하지 않는다', () => {
    const { rerenderModal } = renderSwitchableModal(aiCard);

    fireEvent.click(screen.getByRole('button', { name: /아키텍처 보기/i }));
    expect(
      screen.getByRole('img', {
        name: /AI 어시스턴트 런타임 아키텍처 다이어그램/i,
      })
    ).toBeInTheDocument();

    rerenderModal(null, false);
    rerenderModal(techCard, true);

    expect(screen.getByTestId('feature-card-modal-scroll')).toHaveAttribute(
      'data-view-mode',
      'current'
    );
    expect(
      screen.queryByRole('img', {
        name: /AI 어시스턴트 런타임 아키텍처 다이어그램/i,
      })
    ).not.toBeInTheDocument();
  });
});
