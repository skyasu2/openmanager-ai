/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AuthLoadingUI from './AuthLoadingUI';

describe('AuthLoadingUI', () => {
  it('showCopy=false에서는 텍스트 노드를 숨기고 aria-label만 유지해야 함', () => {
    render(
      <AuthLoadingUI
        loadingMessage="인증 확인 중..."
        envLabel="Vercel"
        showCopy={false}
      />
    );

    expect(
      screen.queryByText('인증 확인 중... (Vercel 환경)')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Vercel 서버에서 로딩 중...')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      '인증 확인 중... (Vercel 환경)'
    );
  });
});
