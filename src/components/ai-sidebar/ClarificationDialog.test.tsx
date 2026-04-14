/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClarificationDialog } from './ClarificationDialog';

const clarification = {
  question: '대상 서버를 선택해주세요',
  reason: '서버 범위가 모호합니다',
  options: [
    {
      id: 'opt-1',
      text: '전체 서버 현황',
      category: 'scope' as const,
      suggestedQuery: '현재 서버 상태를 한 줄로 요약해줘. (전체 서버)',
    },
  ],
  originalQuery: '현재 서버 상태를 한 줄로 요약해줘.',
};

describe('ClarificationDialog', () => {
  it('첫 번째 옵션에 초기 포커스를 두고 dialog semantics를 노출한다', () => {
    render(
      <ClarificationDialog
        clarification={clarification}
        onSelectOption={vi.fn()}
        onSubmitCustom={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(
      screen.getByRole('dialog', { name: '조금 더 구체적으로 알려주세요' })
    ).toHaveAttribute('aria-describedby');
    expect(
      screen.getByRole('button', { name: /전체 서버 현황/ })
    ).toHaveFocus();
  });

  it('건너뛰고 바로 실행 버튼 클릭 시 onSkip을 호출한다', () => {
    const onSkip = vi.fn();

    render(
      <ClarificationDialog
        clarification={clarification}
        onSelectOption={vi.fn()}
        onSubmitCustom={vi.fn()}
        onSkip={onSkip}
      />
    );

    fireEvent.click(screen.getByTestId('clarification-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('직접 입력하기를 누르면 입력창으로 포커스를 이동하고 Enter로 제출한다', () => {
    const onSubmitCustom = vi.fn();

    render(
      <ClarificationDialog
        clarification={clarification}
        onSelectOption={vi.fn()}
        onSubmitCustom={onSubmitCustom}
        onSkip={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '직접 입력하기' }));

    const input = screen.getByPlaceholderText('추가 정보를 입력하세요...');
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: 'CPU 높은 서버만' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmitCustom).toHaveBeenCalledWith('CPU 높은 서버만');
  });

  it('Escape를 누르면 onDismiss를 우선 호출한다', () => {
    const onDismiss = vi.fn();
    const onSkip = vi.fn();

    render(
      <ClarificationDialog
        clarification={clarification}
        onSelectOption={vi.fn()}
        onSubmitCustom={vi.fn()}
        onSkip={onSkip}
        onDismiss={onDismiss}
      />
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });
});
