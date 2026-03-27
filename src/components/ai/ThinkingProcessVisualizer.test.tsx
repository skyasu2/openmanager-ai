/**
 * @vitest-environment jsdom
 */

/**
 * 🧪 ThinkingProcessVisualizer 컴포넌트 테스트
 *
 * @description AI 사고 과정 시각화, 단계별 상태 및 라우팅 정보 표시 검증
 */

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { ThinkingProcessVisualizer } from './ThinkingProcessVisualizer';

// Lucide 아이콘 mock
vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="icon-activity">Activity</div>,
  AlertCircle: () => <div data-testid="icon-alert-circle">AlertCircle</div>,
  Brain: () => <div data-testid="icon-brain">Brain</div>,
  CheckCircle2: () => <div data-testid="icon-check-circle">CheckCircle</div>,
  Cloud: () => <div data-testid="icon-cloud">Cloud</div>,
  Cpu: () => <div data-testid="icon-cpu">Cpu</div>,
  Database: () => <div data-testid="icon-database">Database</div>,
  DollarSign: () => <div data-testid="icon-dollar-sign">DollarSign</div>,
  Loader2: () => <div data-testid="icon-loader">Loader</div>,
  Route: () => <div data-testid="icon-route">Route</div>,
  Search: () => <div data-testid="icon-search">Search</div>,
  TrendingDown: () => <div data-testid="icon-trending-down">TrendingDown</div>,
  Zap: () => <div data-testid="icon-zap">Zap</div>,
}));

describe('🧠 ThinkingProcessVisualizer Component', () => {
  const mockSteps: ThinkingStep[] = [
    {
      id: 'step-1',
      step: '의도 분석',
      status: 'completed',
      duration: 100,
      description: '사용자 질문 의도 파악 완료',
    },
    {
      id: 'step-2',
      step: '라우팅 결정',
      status: 'processing',
      description: '최적의 처리 경로 탐색 중',
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering & State', () => {
    it('헤더와 기본 구조가 렌더링된다', () => {
      render(<ThinkingProcessVisualizer steps={[]} />);
      expect(screen.getByText('🤖 AI 처리 과정')).toBeDefined();
    });

    it('활성 상태일 때 로딩 인디케이터가 표시된다', () => {
      render(<ThinkingProcessVisualizer steps={[]} isActive={true} />);
      expect(screen.getByText('분석 중...')).toBeDefined();
      expect(
        screen.getByText('AI가 최적의 답변을 생성하고 있습니다...')
      ).toBeDefined();
    });

    it('단계(Steps)가 순차적으로 렌더링된다', async () => {
      render(<ThinkingProcessVisualizer steps={mockSteps} />);

      // 초기에는 보이지 않을 수 있음 (useEffect timer)
      act(() => {
        vi.runAllTimers();
      });

      expect(screen.getByText('의도 분석')).toBeDefined();
      expect(screen.getByText('라우팅 결정')).toBeDefined();
      expect(screen.getByText('사용자 질문 의도 파악 완료')).toBeDefined();
    });
  });

  describe('Status Styling', () => {
    it('완료된 단계는 체크 아이콘을 표시한다', async () => {
      render(<ThinkingProcessVisualizer steps={[mockSteps[0]]} />);
      act(() => {
        vi.runAllTimers();
      });

      // completed status uses CheckCircle2 which is mocked as icon-check-circle
      const icons = screen.getAllByTestId('icon-check-circle');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('처리 중인 단계는 로딩 아이콘을 표시한다', async () => {
      render(<ThinkingProcessVisualizer steps={[mockSteps[1]]} />);
      act(() => {
        vi.runAllTimers();
      });

      // processing status uses Loader2 which is mocked as icon-loader
      const loaders = screen.getAllByTestId('icon-loader');
      expect(loaders.length).toBeGreaterThan(0);
    });
  });

  describe('Routing Logic Visualization', () => {
    it('Cloud AI 라우팅 정보를 표시한다', async () => {
      const routingStep: ThinkingStep = {
        id: 'route-1',
        step: '라우팅 결정',
        status: 'completed',
        description: '복잡도 높음 → Cloud AI 처리 (비용 절약)',
      };

      render(<ThinkingProcessVisualizer steps={[routingStep]} />);
      act(() => {
        vi.runAllTimers();
      });

      // Cloud AI 처리 = Cloud icon
      expect(screen.getByText('🤖 Cloud AI 처리')).toBeDefined();
      expect(screen.getByTestId('icon-cloud')).toBeDefined();
    });

    it('로컬 라우팅 정보를 표시한다', async () => {
      const routingStep: ThinkingStep = {
        id: 'route-1',
        step: '라우팅 결정',
        status: 'completed',
        description: '단순 조회 → 로컬 처리',
      };

      render(<ThinkingProcessVisualizer steps={[routingStep]} />);
      act(() => {
        vi.runAllTimers();
      });

      expect(screen.getByText('💾 로컬 처리')).toBeDefined();
      expect(screen.getByTestId('icon-database')).toBeDefined();
    });

    it('비용 절약 태그를 표시한다', async () => {
      const costSavingStep: ThinkingStep = {
        id: 'route-1',
        step: '라우팅 결정',
        status: 'completed',
        description: '비용 절약 모드 활성화',
      };

      render(<ThinkingProcessVisualizer steps={[costSavingStep]} />);
      act(() => {
        vi.runAllTimers();
      });

      expect(screen.getByText('비용 절약')).toBeDefined();
      expect(screen.getByTestId('icon-dollar-sign')).toBeDefined();
    });
  });

  describe('Summary Footer', () => {
    it('비활성 상태일 때 완료 요약을 표시한다', async () => {
      render(<ThinkingProcessVisualizer steps={mockSteps} isActive={false} />);
      act(() => {
        vi.runAllTimers();
      });

      expect(screen.getByText('총 2단계 완료')).toBeDefined();
    });
  });
});
