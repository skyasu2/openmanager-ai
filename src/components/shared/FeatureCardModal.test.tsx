/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_CARDS_DATA } from '@/data/feature-cards.data';
import { VIBE_CODING_DATA } from '@/data/tech-stacks/vibe-coding';
import FeatureCardModal from './FeatureCardModal';

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: (
    selector: (state: { aiAgent: { isEnabled: boolean } }) => unknown
  ) => selector({ aiAgent: { isEnabled: true } }),
}));

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockDynamicComponent() {
      return <div data-testid="mock-react-flow-diagram" />;
    },
}));

const vibeCard = FEATURE_CARDS_DATA.find((card) => card.id === 'vibe-coding');

if (!vibeCard) {
  throw new Error('vibe-coding feature card not found');
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
});
