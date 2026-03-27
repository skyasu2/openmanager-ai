/**
 * @vitest-environment jsdom
 */

/**
 * 🧪 SLAWidget 컴포넌트 테스트
 *
 * SLA 대시보드 위젯의 렌더링 및 계산 로직 검증
 * - 가용률 계산
 * - MTTR/MTTA 계산
 * - 다운타임 예산
 * - 표시 로직
 *
 * @updated 2026-01-22 - toBeDefined() → toBeInTheDocument() 수정
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createErrorResponse,
  createMockResponse,
} from '../../../tests/utils/mock-response';
import { SLAWidget } from './SLAWidget';

// Mock fetch - 각 테스트에서 재설정됨
const mockFetch = vi.fn();

// 테스트용 보고서 데이터 생성
function createMockReport(overrides?: Record<string, unknown>) {
  const created = new Date();
  const resolved = new Date(created.getTime() + 60 * 60 * 1000); // 1시간 후 해결

  return {
    id: `report-${Math.random().toString(36).slice(2)}`,
    created_at: created.toISOString(),
    resolved_at: resolved.toISOString(),
    status: 'resolved',
    severity: 'medium',
    title: 'Test Incident',
    ...overrides,
  };
}

function createSuccessResponse(reports: unknown[]) {
  return createMockResponse({ reports }, true, 200);
}

describe('🎯 SLAWidget - SLA 대시보드 위젯 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 각 테스트 전에 fetch를 다시 모킹 (restoreAllMocks로 인한 복원 방지)
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('기본 렌더링', () => {
    it('로딩 중일 때 로딩 상태가 표시된다', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves

      render(<SLAWidget />);

      // 로딩 중에는 SLA 현황이 아직 표시되지 않음
      expect(screen.queryByText('SLA 현황')).not.toBeInTheDocument();
    });

    it('데이터 로드 성공 시 SLA 현황이 표시된다', async () => {
      const reports = [createMockReport()];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        expect(screen.getByText('SLA 현황')).toBeInTheDocument();
      });

      expect(screen.getByText('현재 가용률')).toBeInTheDocument();
      expect(screen.getByText(/MTTR/)).toBeInTheDocument();
      expect(screen.getByText(/MTTA/)).toBeInTheDocument();
    });

    it('에러 시 에러 메시지가 표시된다', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500));

      render(<SLAWidget />);

      await waitFor(() => {
        expect(screen.getByText(/SLA 데이터 조회 실패/)).toBeInTheDocument();
      });
    });

    it('compact 모드에서는 간소화된 뷰가 표시된다', async () => {
      const reports: unknown[] = [];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget compact={true} />);

      await waitFor(() => {
        expect(screen.getByText('SLA')).toBeInTheDocument();
      });

      // compact 모드에서는 "SLA 현황" 대신 "SLA"만 표시
      expect(screen.queryByText('SLA 현황')).not.toBeInTheDocument();
    });
  });

  describe('기간 설정', () => {
    const periods = ['daily', 'weekly', 'monthly'] as const;

    periods.forEach((period) => {
      it(`${period} 기간이 올바르게 표시된다`, async () => {
        const reports: unknown[] = [];
        mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

        render(<SLAWidget period={period} />);

        await waitFor(() => {
          expect(screen.getByText('SLA 현황')).toBeInTheDocument();
        });

        const periodLabels: Record<string, string> = {
          daily: '일간',
          weekly: '주간',
          monthly: '월간',
        };

        expect(screen.getByText(periodLabels[period])).toBeInTheDocument();
      });
    });

    it('기간에 따라 올바른 dateRange로 API를 호출한다', async () => {
      const reports: unknown[] = [];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget period="weekly" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('dateRange=30d'); // weekly = 30d
    });
  });

  describe('SLA 계산 로직', () => {
    it('보고서가 없으면 높은 가용률이 표시된다', async () => {
      const reports: unknown[] = [];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        // 보고서가 없으면 다운타임이 0이므로 100% 가용률
        const uptimeElement = screen.getByText(/100\.000%/);
        expect(uptimeElement).toBeInTheDocument();
      });
    });

    it('critical 보고서는 15분 다운타임으로 계산된다', async () => {
      const reports = [createMockReport({ severity: 'critical' })];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        // 다운타임이 15분으로 표시되어야 함
        expect(screen.getByText('15분')).toBeInTheDocument();
      });
    });

    it('high 보고서는 5분 다운타임으로 계산된다', async () => {
      const reports = [createMockReport({ severity: 'high' })];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        // 다운타임이 5분으로 표시되어야 함
        expect(screen.getByText('5분')).toBeInTheDocument();
      });
    });

    it('MTTR이 해결된 보고서 기준으로 계산된다', async () => {
      const now = Date.now();
      const reports = [
        createMockReport({
          created_at: new Date(now - 120 * 60 * 1000).toISOString(), // 2시간 전
          resolved_at: new Date(now - 60 * 60 * 1000).toISOString(), // 1시간 전 해결 (60분 소요)
          status: 'resolved',
        }),
        createMockReport({
          created_at: new Date(now - 180 * 60 * 1000).toISOString(), // 3시간 전
          resolved_at: new Date(now - 150 * 60 * 1000).toISOString(), // 30분 소요
          status: 'resolved',
        }),
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        // 평균 MTTR = (60 + 30) / 2 = 45분
        expect(screen.getByText('45분')).toBeInTheDocument();
      });
    });

    it('해결되지 않은 보고서는 MTTR 계산에서 제외된다', async () => {
      const now = Date.now();
      const reports = [
        createMockReport({
          created_at: new Date(now - 60 * 60 * 1000).toISOString(),
          resolved_at: new Date(now - 30 * 60 * 1000).toISOString(),
          status: 'resolved', // 30분 소요
        }),
        createMockReport({
          created_at: new Date(now - 120 * 60 * 1000).toISOString(),
          resolved_at: null,
          status: 'open', // 해결되지 않음 - 제외됨
        }),
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        // 해결된 보고서 1개만 계산: MTTR = 30분
        expect(screen.getByText('30분')).toBeInTheDocument();
      });
    });
  });

  describe('SLA 위반 표시', () => {
    it('가용률이 목표 미만이면 SLA 위반 표시', async () => {
      // 매우 많은 critical 보고서로 다운타임 증가
      const reports = Array.from({ length: 50 }, () =>
        createMockReport({ severity: 'critical' })
      );
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        expect(screen.getByText('SLA 위반')).toBeInTheDocument();
      });
    });

    it('가용률이 목표 이상이면 정상 표시', async () => {
      const reports: unknown[] = [];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        expect(screen.getByText('정상')).toBeInTheDocument();
      });
    });
  });

  describe('새로고침 기능', () => {
    it('새로고침 버튼 클릭 시 데이터를 다시 가져온다', async () => {
      const reports: unknown[] = [];
      mockFetch.mockResolvedValue(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        expect(screen.getByText('SLA 현황')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 새로고침 버튼 클릭
      const refreshButton = document.querySelector(
        'button[class*="hover:bg-gray-100"]'
      );
      expect(refreshButton).toBeInTheDocument();

      if (refreshButton) {
        fireEvent.click(refreshButton);
      }

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('시간 포맷팅', () => {
    it('1분 미만은 "< 1분"으로 표시된다', async () => {
      // MTTA가 매우 작은 경우 (MTTR의 30%가 1분 미만)
      const now = Date.now();
      const reports = [
        createMockReport({
          created_at: new Date(now - 3 * 60 * 1000).toISOString(), // 3분 전
          resolved_at: new Date(now - 1 * 60 * 1000).toISOString(), // 2분 소요
          status: 'resolved',
        }),
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        // MTTR = 2분, MTTA = 2 * 0.3 = 0.6분 → "< 1분"
        // 정규식으로 검색 (HTML 엔티티 디코딩 문제 방지)
        const elements = screen.getAllByText(/< ?1분/);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('60분 이상은 시간 단위로 표시된다', async () => {
      const now = Date.now();
      const reports = [
        createMockReport({
          created_at: new Date(now - 180 * 60 * 1000).toISOString(), // 3시간 전
          resolved_at: new Date(now - 60 * 60 * 1000).toISOString(), // 2시간(120분) 소요
          status: 'resolved',
        }),
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        // MTTR = 120분 = 2시간
        expect(screen.getByText('2시간')).toBeInTheDocument();
      });
    });
  });

  describe('장애 건수', () => {
    it('총 장애 건수가 표시된다', async () => {
      const reports = [
        createMockReport(),
        createMockReport(),
        createMockReport(),
      ];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        expect(screen.getByText('3건')).toBeInTheDocument();
      });
    });
  });

  describe('가용률 색상', () => {
    it('목표 달성 시 녹색으로 표시된다', async () => {
      const reports: unknown[] = [];
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        const uptimeValue = screen.getByText(/100\.000%/);
        expect(uptimeValue.className).toContain('text-green-600');
      });
    });

    it('목표 미달 시 빨간색으로 표시된다', async () => {
      // 많은 critical 보고서로 가용률 저하
      const reports = Array.from({ length: 100 }, () =>
        createMockReport({ severity: 'critical' })
      );
      mockFetch.mockResolvedValueOnce(createSuccessResponse(reports));

      render(<SLAWidget />);

      await waitFor(() => {
        // 다운타임이 많아서 가용률이 낮음
        const container = document.querySelector('.text-red-600');
        expect(container).toBeInTheDocument();
      });
    });
  });
});
