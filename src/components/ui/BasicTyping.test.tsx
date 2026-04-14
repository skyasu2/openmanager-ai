/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BasicTyping from './BasicTyping';

describe('BasicTyping', () => {
  it('빈 문자열이어도 invalid steps(0) 애니메이션을 만들지 않아야 한다', () => {
    const { container } = render(<BasicTyping text="" showCursor={false} />);
    const styleTag = container.querySelector('style');

    expect(styleTag?.textContent).toContain('steps(1, end)');
    expect(styleTag?.textContent).not.toContain('steps(0, end)');
  });
});
