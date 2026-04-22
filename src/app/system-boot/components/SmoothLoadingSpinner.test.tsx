/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

describe('SmoothLoadingSpinner', () => {
  it('내부 링은 invalid border-3 대신 explicit 3px border width 클래스를 사용해야 한다', async () => {
    vi.resetModules();
    const { SmoothLoadingSpinner } = await import('./SmoothLoadingSpinner');
    const { container } = render(React.createElement(SmoothLoadingSpinner));
    const innerRing = container.querySelector('div.inset-2');

    expect(innerRing).toBeInTheDocument();
    expect(innerRing).toHaveClass('border-[3px]');
    expect(innerRing).not.toHaveClass('border-3');
  });
});
