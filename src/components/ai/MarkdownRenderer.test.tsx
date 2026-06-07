/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  const targetVariable = '$' + '{target}';
  const originalInnerTextDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'innerText'
  );

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() {
        return this.textContent ?? '';
      },
      set(value: string) {
        this.textContent = value;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    if (originalInnerTextDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'innerText',
        originalInnerTextDescriptor
      );
      return;
    }

    delete (HTMLElement.prototype as HTMLElement & { innerText?: string })
      .innerText;
  });

  it('code block copy timer를 unmount 시 정리해야 한다', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = render(
      <MarkdownRenderer content={'```ts\nconst answer = 42;\n```'} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '코드 복사' }));
      await Promise.resolve();
    });

    unmount();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'const answer = 42;\n'
    );
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('standalone handoff marker는 배지로 렌더링해야 한다', () => {
    const { container } = render(
      <MarkdownRenderer
        content={'🔄 **Orchestrator** → **Analyst Agent**: 이상 탐지 요청'}
      />
    );

    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
    expect(screen.getByText('Analyst Agent')).toBeInTheDocument();
    expect(screen.getByText('이상 탐지 요청')).toBeInTheDocument();
    expect(
      container.querySelector('div.my-3.flex.items-center.justify-center')
    ).toBeInTheDocument();
  });

  it('문장 중간에 포함된 handoff marker는 주변 텍스트를 유지해야 한다', () => {
    const { container } = render(
      <MarkdownRenderer
        content={
          '분석 시작합니다. 🔄 **Orchestrator** → **Analyst Agent**: 이상 탐지 요청됨'
        }
      />
    );

    expect(screen.getByText(/분석 시작합니다\./)).toBeInTheDocument();
    expect(
      container.querySelector('div.my-3.flex.items-center.justify-center')
    ).not.toBeInTheDocument();
  });

  it('bash 코드 블록의 command substitution과 if 블록을 끝까지 렌더링해야 한다', () => {
    const script = [
      '```bash',
      'filterServers() {',
      '  local target="$(printf "%s" "$1")"',
      `  if [[ -n "${targetVariable}" ]]; then`,
      `    jq -r ".servers[] | select(.name == \\"${targetVariable}\\") | .name"`,
      '  fi',
      '  printf "%s\\n" "done"',
      '}',
      '```',
    ].join('\n');

    render(<MarkdownRenderer content={script} />);

    const code = screen.getByTestId('markdown-code-block');

    expect(code).toHaveTextContent('local target="$(printf "%s" "$1")"');
    expect(code).toHaveTextContent(`if [[ -n "${targetVariable}" ]]; then`);
    expect(code).toHaveTextContent('printf "%s\\n" "done"');
    expect(code).toHaveTextContent('}');
  });

  it('orderedListStart가 있으면 첫 번째 번호 목록의 start 속성을 유지해야 한다', () => {
    const { container } = render(
      <MarkdownRenderer
        content={'1. 세 번째\n2. 네 번째'}
        orderedListStart={3}
      />
    );

    expect(container.querySelector('ol')).toHaveAttribute('start', '3');
  });
});
