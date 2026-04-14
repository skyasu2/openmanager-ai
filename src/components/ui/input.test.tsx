/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('Input', () => {
  it('명시적 aria-label을 강제 덮어쓰지 않아야 한다', () => {
    render(<Input aria-label="서버 이름" />);

    expect(
      screen.getByRole('textbox', { name: '서버 이름' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: '입력' })
    ).not.toBeInTheDocument();
  });

  it('aria-label이 없으면 불필요한 기본 이름을 주입하지 않아야 한다', () => {
    const { container } = render(<Input placeholder="검색어" />);
    const input = container.querySelector('input');

    expect(input).not.toHaveAttribute('aria-label');
  });
});
