/**
 * @vitest-environment jsdom
 */

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AutoResizeTextarea } from './AutoResizeTextarea';

/**
 * jsdom에서 scrollHeight는 항상 0 (레이아웃 엔진 없음).
 * Object.defineProperty로 stub하여 실제 리사이즈 로직을 검증한다.
 */
describe('AutoResizeTextarea', () => {
  let originalDescriptor: PropertyDescriptor | undefined;
  let stubbedScrollHeight = 0;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollHeight'
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      get: () => stubbedScrollHeight,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollHeight',
        originalDescriptor
      );
    }
    stubbedScrollHeight = 0;
  });

  it('초기 렌더 시 minHeight로 높이가 설정된다', () => {
    stubbedScrollHeight = 0;

    render(<AutoResizeTextarea value="" minHeight={48} maxHeight={200} />);

    const textarea = document.querySelector('textarea')!;
    // scrollHeight=0 → Math.max(48, Math.min(2, 200)) = 48
    expect(textarea.style.height).toBe('48px');
  });

  it('긴 텍스트 입력 시 scrollHeight 기반으로 높이가 확장된다', async () => {
    stubbedScrollHeight = 150;

    await act(async () => {
      render(
        <AutoResizeTextarea
          value="긴 텍스트 내용입니다"
          minHeight={48}
          maxHeight={200}
        />
      );
    });

    const textarea = document.querySelector('textarea')!;
    // scrollHeight=150 → Math.max(48, Math.min(152, 200)) = 152
    expect(textarea.style.height).toBe('152px');
  });

  it('value가 clear되면 minHeight로 높이가 복귀한다 (전송 후 초기화 회귀 방지)', async () => {
    // Given: 긴 텍스트로 높이가 확장된 상태
    stubbedScrollHeight = 150;

    const { rerender } = render(
      <AutoResizeTextarea
        value="긴 텍스트 입력입니다 여러 줄에 걸쳐서"
        minHeight={48}
        maxHeight={200}
      />
    );

    const textarea = document.querySelector('textarea')!;
    expect(textarea.style.height).toBe('152px');

    // When: value=""로 변경 (메시지 전송 후 초기화)
    stubbedScrollHeight = 0;

    await act(async () => {
      rerender(<AutoResizeTextarea value="" minHeight={48} maxHeight={200} />);
    });

    // Then: minHeight(48)로 복귀
    // scrollHeight=0 → Math.max(48, Math.min(2, 200)) = 48
    expect(textarea.style.height).toBe('48px');
  });

  it('maxHeight를 초과하는 콘텐츠는 maxHeight로 clamp된다', async () => {
    stubbedScrollHeight = 500;

    await act(async () => {
      render(
        <AutoResizeTextarea
          value="매우 긴 텍스트"
          minHeight={48}
          maxHeight={200}
          maxHeightVh={100}
        />
      );
    });

    const textarea = document.querySelector('textarea')!;
    // scrollHeight=500 → Math.max(48, Math.min(502, 200)) = 200
    expect(textarea.style.height).toBe('200px');
    expect(textarea.style.overflowY).toBe('auto');
  });
});
