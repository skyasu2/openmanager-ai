import { QueryClient } from '@tanstack/react-query';
import { emergencyMode } from './emergency-mode';

/**
 * React Query 클라이언트 설정
 *
 * @description
 * 서버 상태 관리를 위한 React Query 설정입니다.
 * 캐싱, 재시도, 백그라운드 업데이트 등을 최적화합니다.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🚨 비상 모드 설정 병합
      ...emergencyMode.getEmergencyQuerySettings(),

      // 기본 옵션
      staleTime: emergencyMode.isEmergencyMode() ? Infinity : 1000 * 60 * 5, // 🚨 비상 시 영원히 캐시
      gcTime: emergencyMode.isEmergencyMode() ? Infinity : 1000 * 60 * 30, // 🚨 비상 시 영원히 보관
      retry: emergencyMode.isEmergencyMode() ? false : 3, // 🚨 비상 시 재시도 차단
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 지수 백오프

      // 네트워크 관련 - 🚨 비상 시 모든 자동 갱신 차단
      refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 재요청 비활성화
      refetchOnReconnect: !emergencyMode.isEmergencyMode(), // 🚨 비상 시 재연결 갱신 차단
      refetchOnMount: !emergencyMode.isEmergencyMode(), // 🚨 비상 시 마운트 갱신 차단

      // 서버 모니터링 특화 설정 - 🚨 자동 refetch 비활성화 (과도한 API 호출 방지)
      refetchInterval: false, // 🚨 모든 자동 갱신 비활성화 - 수동 새로고침만 허용
      refetchIntervalInBackground: false, // 백그라운드에서는 자동 새로고침 안함
    },
    mutations: {
      // Mutation 기본 옵션 - 🚨 비상 시 재시도 차단
      retry: emergencyMode.isEmergencyMode() ? false : 1, // 🚨 비상 시 변형 재시도 차단
      retryDelay: 1000, // 1초 대기
    },
  },
});

/**
 * 쿼리 키 상수
 *
 * @description
 * 일관된 쿼리 키 관리를 위한 상수들입니다.
 * 타입 안정성과 재사용성을 제공합니다.
 */
export const queryKeys = {
  // 서버 관련
  servers: ['servers'] as const,
  serverList: (filters?: { status?: string; search?: string }) =>
    ['servers', 'list', filters] as const,
  serverDetail: (id: string) => ['servers', 'detail', id] as const,
  serverMetrics: (id: string, interval?: string) =>
    ['servers', 'metrics', id, interval] as const,

  // 시스템 상태
  systemStatus: ['system', 'status'] as const,
  _systemHealth: ['system', 'health'] as const,
  systemMetrics: (period?: string) => ['system', 'metrics', period] as const,

  // AI 관련
  aiAnalysis: ['ai', 'analysis'] as const,
  aiPrediction: (type: string, interval?: string) =>
    ['ai', 'prediction', type, interval] as const,
  aiEngineStatus: ['ai', 'engine', 'status'] as const,

  // 데이터 생성기
  dataGenerator: ['data-generator'] as const,
  dataGeneratorStatus: ['data-generator', 'status'] as const,

  // 가상 서버
  virtualServers: ['virtual-servers'] as const,
  virtualServerStatus: ['virtual-servers', 'status'] as const,

  // MCP
  mcpStatus: ['mcp', 'status'] as const,
  mcpHealth: ['mcp', 'health'] as const,
  mcpStats: ['mcp', 'stats'] as const,
} as const;

/**
 * API 요청 함수들
 *
 * @description
 * React Query와 함께 사용할 API 요청 함수들입니다.
 * 타입 안정성과 에러 처리를 제공합니다.
 */
export const api = {
  // 서버 API
  servers: {
    getList: async (): Promise<unknown> => {
      const response = await fetch('/api/servers');
      if (!response.ok) {
        throw new Error(`서버 목록 조회 실패: ${response.status}`);
      }
      return response.json();
    },

    getDetail: async (id: string): Promise<unknown> => {
      const response = await fetch(`/api/servers/${id}`);
      if (!response.ok) {
        throw new Error(`서버 상세 정보 조회 실패: ${response.status}`);
      }
      return response.json();
    },
  },

  // 시스템 API
  system: {
    getStatus: async (): Promise<unknown> => {
      const response = await fetch('/api/system');
      if (!response.ok) {
        throw new Error(`시스템 상태 조회 실패: ${response.status}`);
      }
      return response.json();
    },

    getHealth: async (): Promise<unknown> => {
      const response = await fetch('/api/system?view=health');
      if (!response.ok) {
        throw new Error(`시스템 헬스 조회 실패: ${response.status}`);
      }
      return response.json();
    },
  },

  // AI API
  ai: {
    getAnalysis: async (request: unknown): Promise<unknown> => {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        throw new Error(`AI 분석 실패: ${response.status}`);
      }
      return response.json();
    },

    getPrediction: async (
      type: string,
      interval = '30min'
    ): Promise<unknown> => {
      const params = new URLSearchParams({ type, interval });
      const response = await fetch(`/api/ai/prediction?${params}`);
      if (!response.ok) {
        throw new Error(`AI 예측 실패: ${response.status}`);
      }
      return response.json();
    },
  },

  // 데이터 생성기 API (dashboard 기반으로 변경)
  dataGenerator: {
    getStatus: async (): Promise<unknown> => {
      // 🔄 dashboard API에서 서버 생성 상태 확인
      const response = await fetch('/api/dashboard');
      if (!response.ok) {
        throw new Error(`데이터 생성기 상태 조회 실패: ${response.status}`);
      }

      const data = await response.json();

      // 대시보드 데이터에서 생성기 상태 시뮬레이션
      return {
        status: 'active',
        serversGenerated: data.servers?.length || 0,
        lastUpdate: data.timestamp || new Date().toISOString(),
        mode: 'gcp-direct', // GCP 직접 연동 모드
      };
    },

    start: async (pattern?: string): Promise<unknown> => {
      // 🔄 서버 생성 요청을 servers API로 전달
      const response = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          pattern: pattern || 'default',
          source: 'gcp-direct',
        }),
      });
      if (!response.ok) {
        throw new Error(`데이터 생성기 시작 실패: ${response.status}`);
      }
      return response.json();
    },
  },
} as const;
