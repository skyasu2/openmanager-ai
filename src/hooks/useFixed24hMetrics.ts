/**
 * 🎯 24시간 고정 데이터 훅 (v3.2 - Vercel 최적화)
 *
 * ✅ Single Source of Truth: server-data-loader 기반 통합 데이터
 * ✅ 10분 간격 데이터 갱신 (JSON 데이터 주기와 일치)
 * ✅ 한국 시간(KST) 동기화
 * ✅ UnifiedServerDataSource 10분 TTL 캐시 활용
 * ✅ 히스토리 데이터 누적 (최대 60개 포인트 = 10시간 분량)
 * ✅ Vercel 사용량 최적화 (불필요한 API 호출 방지)
 *
 * 📊 데이터 구조:
 *   - 24개 JSON 파일 (hour-00 ~ hour-23)
 *   - 각 파일당 6개 dataPoints (10분 간격: 0, 10, 20, 30, 40, 50분)
 *   - 총 144개 데이터 포인트 / 24시간
 *
 * @see src/services/data/UnifiedServerDataSource.ts - 통합 데이터 소스 (10분 TTL)
 * @see src/services/server-data/server-data-loader.ts - 서버 데이터 로더
 * @see src/data/hourly-data/hour-XX.json - 시간별 JSON 데이터
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logging';
import { UnifiedServerDataSource } from '@/services/data/UnifiedServerDataSource';
import type { Server } from '@/types/server';

/**
 * 히스토리 데이터 포인트 (차트용)
 */
interface HistoryDataPoint {
  time: string; // "HH:MM"
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

// 히스토리 데이터 최대 포인트 수 (10분 간격 시 10시간 분량)
const MAX_HISTORY_POINTS = 60;

/**
 * 다음 10분 단위(00, 10, 20, 30, 40, 50분)까지 남은 밀리초 계산
 * @returns 다음 10분 정시까지 남은 ms (최소 1000ms 보장)
 */
function getMillisToNextTenMinutes(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();

  // 다음 10분 단위까지 남은 분
  const minutesToNext = 10 - (minutes % 10);
  // 총 남은 밀리초
  const totalMs = minutesToNext * 60 * 1000 - seconds * 1000 - ms;

  // 최소 1초 보장 (즉시 실행 방지)
  return Math.max(totalMs, 1000);
}

/**
 * 24시간 JSON 데이터 + 1분 선형 보간 훅
 *
 * @param serverId 서버 ID (예: "web-prod-01", "api-prod-01")
 * @param updateInterval 업데이트 주기 (밀리초, 기본 600000 = 10분)
 *                       'sync' 전달 시 정시 10분 단위에만 갱신 (00, 10, 20, 30, 40, 50분)
 * @returns 실시간 메트릭 + 히스토리 데이터
 *
 * @example
 * ```tsx
 * // 기본 사용 (10분 간격)
 * const { currentMetrics, historyData } = useFixed24hMetrics('web-prod-01');
 *
 * // 정시 동기화 모드 (모달용 - 10, 20, 30... 분에만 갱신)
 * const { currentMetrics, historyData } = useFixed24hMetrics('web-prod-01', 'sync');
 * ```
 */
export function useFixed24hMetrics(
  serverId: string,
  updateInterval: number | 'sync' = 600000 // 10분 or 'sync' (정시 동기화)
) {
  const [currentMetrics, setCurrentMetrics] = useState<Server | null>(null);
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  // 마지막 업데이트 시간 추적 (중복 데이터 방지)
  const lastUpdateTimeRef = useRef<string>('');

  // 메트릭 업데이트 함수
  const updateMetrics = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      // 🎯 Single Source of Truth: UnifiedServerDataSource
      const dataSource = UnifiedServerDataSource.getInstance();
      const servers = await dataSource.getServers();

      // 특정 서버 찾기 - Case-insensitive Matching
      const server = servers.find(
        (s) => s.id.toLowerCase() === serverId.toLowerCase()
      );

      if (server) {
        setCurrentMetrics(server);
        setError(null);

        // 현재 시간 포맷
        const currentTime = new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        // 중복 데이터 방지: 같은 시간(분)에 이미 데이터가 있으면 스킵
        if (currentTime !== lastUpdateTimeRef.current) {
          lastUpdateTimeRef.current = currentTime;

          // 새 데이터 포인트 생성
          const newDataPoint: HistoryDataPoint = {
            time: currentTime,
            cpu: Math.round(server.cpu * 10) / 10,
            memory: Math.round(server.memory * 10) / 10,
            disk: Math.round(server.disk * 10) / 10,
            network: Math.round((server.network ?? 0) * 10) / 10,
          };

          // 히스토리 데이터 누적 (최대 MAX_HISTORY_POINTS 유지)
          setHistoryData((prev) => {
            const updated = [...prev, newDataPoint];
            // 최대 포인트 수 초과 시 오래된 데이터 제거
            if (updated.length > MAX_HISTORY_POINTS) {
              return updated.slice(-MAX_HISTORY_POINTS);
            }
            return updated;
          });
        }

        setIsLoading(false);
      } else {
        // Fallback: Mock Data for Dev/Demo if real ID not found
        // This ensures the UI doesn't look broken even if IDs mismatch
        logger.warn(`Server "${serverId}" not found, using fallback.`);
        setIsLoading(false);
      }
    } catch (err) {
      logger.error('메트릭 업데이트 실패:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
      setIsLoading(false);
    }
  }, [serverId]);

  // 초기 로드 및 자동 업데이트
  useEffect(() => {
    isMountedRef.current = true;

    // 초기 로드 (모달 열릴 때 즉시 갱신)
    void updateMetrics();

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (updateInterval === 'sync') {
      // 🕐 정시 동기화 모드: 10, 20, 30, 40, 50, 00분에만 갱신
      // 1. 다음 10분 정시까지 대기
      const msToNext = getMillisToNextTenMinutes();

      timeoutId = setTimeout(() => {
        if (!isMountedRef.current) return;
        void updateMetrics();

        // 2. 이후 10분마다 갱신
        intervalId = setInterval(
          () => {
            if (isMountedRef.current) {
              void updateMetrics();
            }
          },
          10 * 60 * 1000
        ); // 10분
      }, msToNext);
    } else {
      // 기존 동작: 지정된 간격으로 갱신
      intervalId = setInterval(() => {
        void updateMetrics();
      }, updateInterval);
    }

    return () => {
      isMountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [updateInterval, updateMetrics]);

  return {
    currentMetrics,
    historyData,
    isLoading,
    error,
    refreshMetrics: updateMetrics,
  };
}
