/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FeatureCardsGrid from './FeatureCardsGrid';

vi.mock('@/components/shared/FeatureCardModal', () => ({
  default: () => null,
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: (selector: (state: unknown) => unknown) =>
    selector({
      aiAgent: { isEnabled: true },
    }),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FeatureCardsGrid a11y labels', () => {
  it('카드 버튼은 제목과 설명을 보조기술에 연결한다', () => {
    render(<FeatureCardsGrid />);

    const detailButtons = screen.getAllByRole('button', {
      name: /상세 정보 보기$/,
    });
    expect(detailButtons.length).toBeGreaterThanOrEqual(4);

    detailButtons.forEach((button) => {
      const description = button.querySelector('p');
      expect(description).not.toBeNull();
      expect(description).not.toHaveAttribute('aria-hidden');
      expect(description).toHaveAttribute('id');
      expect(button).toHaveAttribute(
        'aria-describedby',
        description?.getAttribute('id')
      );
    });
  });
});
