/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MainPageSkeleton from './MainPageSkeleton';

describe('MainPageSkeleton', () => {
  it('타이틀 스켈레톤이 좁은 화면에서도 넘치지 않도록 fluid width를 사용해야 한다', () => {
    const { container } = render(<MainPageSkeleton />);
    const titleSkeleton = container.querySelector('.mb-12 .h-12');
    const subtitleSkeleton = container.querySelector('.mb-12 .h-6');

    expect(titleSkeleton).toHaveClass('w-full', 'max-w-96');
    expect(subtitleSkeleton).toHaveClass('w-full', 'max-w-64');
  });
});
