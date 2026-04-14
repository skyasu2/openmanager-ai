/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServerStatusIndicator } from './ServerStatusIndicator';

describe('ServerStatusIndicator', () => {
  it('예상 밖 상태값이 들어와도 unknown으로 안전하게 fallback해야 한다', () => {
    render(
      <ServerStatusIndicator status={'degraded' as never} showText={true} />
    );

    expect(screen.getByLabelText('서버 상태: unknown')).toBeInTheDocument();
    expect(screen.getByText('알 수 없음')).toBeInTheDocument();
  });
});
