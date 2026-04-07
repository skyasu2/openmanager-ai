/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AuthLoadingUI from './AuthLoadingUI';

describe('AuthLoadingUI', () => {
  it('showCopy=false에서도 접근성 메시지는 inline hidden 상태를 유지해야 함', () => {
    render(
      <AuthLoadingUI
        loadingMessage="인증 확인 중..."
        envLabel="Vercel"
        showCopy={false}
      />
    );

    const hiddenMessage = screen.getByText('인증 확인 중... (Vercel 환경)');

    expect(hiddenMessage).toHaveStyle('position: absolute');
    expect(hiddenMessage).toHaveStyle('width: 1px');
    expect(hiddenMessage).toHaveStyle('height: 1px');
    expect(hiddenMessage).toHaveStyle('overflow: hidden');
    expect(hiddenMessage).toHaveStyle('clip: rect(0, 0, 0, 0)');
    expect(
      screen.queryByText('Vercel 서버에서 로딩 중...')
    ).not.toBeInTheDocument();
  });
});
