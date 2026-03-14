/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntelligentMonitoringPage from './IntelligentMonitoringPage';

const mockFetch = vi.fn();
const mockUseServerQuery = vi.fn();

vi.mock('@/hooks/useServerQuery', () => ({
  useServerQuery: () => mockUseServerQuery(),
}));

vi.mock('@/components/ai/AnalysisResultsCard', () => ({
  default: ({ error }: { error: string | null }) =>
    error ? (
      <div>
        <p>{error}</p>
        <a href="/login">로그인하기</a>
      </div>
    ) : (
      <div>empty</div>
    ),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('IntelligentMonitoringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockUseServerQuery.mockReturnValue({
      data: [
        {
          id: 'server-1',
          name: '웹 서버 01',
          cpu: 10,
          memory: 20,
          disk: 30,
          network: 40,
        },
      ],
    });
  });

  it('shows login CTA when analysis API returns 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    render(<IntelligentMonitoringPage />);

    fireEvent.change(screen.getByLabelText('분석 대상'), {
      target: { value: 'server-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '분석 시작' }));

    await waitFor(() => {
      expect(
        screen.getByText('로그인이 필요합니다. 게스트 로그인 후 이용해주세요.')
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: '로그인하기' })).toHaveAttribute(
      'href',
      '/login'
    );
  });
});
