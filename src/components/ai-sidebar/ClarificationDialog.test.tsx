/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClarificationDialog } from './ClarificationDialog';

describe('ClarificationDialog', () => {
  it('건너뛰고 바로 실행 버튼 클릭 시 onSkip을 호출한다', () => {
    const onSkip = vi.fn();

    render(
      <ClarificationDialog
        clarification={{
          question: '대상 서버를 선택해주세요',
          reason: '서버 범위가 모호합니다',
          options: [
            {
              id: 'opt-1',
              text: '전체 서버 현황',
              category: 'scope',
              suggestedQuery: '현재 서버 상태를 한 줄로 요약해줘. (전체 서버)',
            },
          ],
          originalQuery: '현재 서버 상태를 한 줄로 요약해줘.',
        }}
        onSelectOption={vi.fn()}
        onSubmitCustom={vi.fn()}
        onSkip={onSkip}
      />
    );

    fireEvent.click(screen.getByTestId('clarification-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
