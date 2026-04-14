/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SmoothLoadingSpinner } from './SmoothLoadingSpinner';

describe('SmoothLoadingSpinner', () => {
  it('내부 링은 invalid border-3 대신 explicit 3px border width 클래스를 사용해야 한다', () => {
    const { container } = render(<SmoothLoadingSpinner />);
    const innerRing = container.querySelector('div.inset-2');

    expect(innerRing).toBeInTheDocument();
    expect(innerRing).toHaveClass('border-[3px]');
    expect(innerRing).not.toHaveClass('border-3');
  });
});
