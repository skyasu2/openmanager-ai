'use client';

/**
 * 🚀 반응형 서버 리스트 (15개 전체 보기 전용)
 * CSS Grid 기반 반응형 레이아웃 + 더보기 버튼
 * 브라우저 크기에 맞게 자동 배치, 첫 줄만 표시하고 나머지는 펼치기
 */

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import ImprovedServerCard from '@/components/dashboard/ImprovedServerCard';
import ServerCardErrorBoundary from '@/components/error/ServerCardErrorBoundary';
import type { Server } from '@/types/server';

interface VirtualizedServerListProps {
  servers: Server[];
  handleServerSelect: (server: Server) => void;
  onAskAI?: (server: Server) => void;
}

const GRID_STYLE: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 240px))',
};

export default function VirtualizedServerList({
  servers,
  handleServerSelect,
  onAskAI,
}: VirtualizedServerListProps) {
  const [expanded, setExpanded] = useState(false);
  const [cardsPerRow, setCardsPerRow] = useState(4);

  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const calculateCardsPerRow = () => {
      const containerWidth = window.innerWidth - 64; // 좌우 패딩 제외
      const cardWidth = 280; // 카드 최소 너비 증가 (200px -> 280px)
      const gap = 12; // 카드 간격
      const cards = Math.floor((containerWidth + gap) / (cardWidth + gap));
      setCardsPerRow(Math.max(1, cards)); // 최소 1개
    };

    // 초기 계산
    calculateCardsPerRow();

    // 150ms debounce로 성능 최적화
    const debouncedCalculate = () => {
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(calculateCardsPerRow, 150);
    };
    window.addEventListener('resize', debouncedCalculate);

    return () => {
      window.removeEventListener('resize', debouncedCalculate);
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
    };
  }, []);

  // 첫 노출 개수: 모바일(1열)에서는 경고/위험 서버 수만큼 최소 보장
  const isMobileGrid = cardsPerRow <= 2;
  const alertServerCount = isMobileGrid
    ? servers.filter((s) => s.status === 'critical' || s.status === 'warning')
        .length
    : 0;
  const initialVisible = Math.max(cardsPerRow, alertServerCount);
  const visibleCount = expanded ? servers.length : initialVisible;
  const remainingCount = servers.length - initialVisible;

  // 🚀 useCallback으로 참조 안정화 → memo된 ImprovedServerCard 리렌더링 방지
  const renderServer = useCallback(
    (server: Server, index: number) => {
      const serverId = server.id || `server-${index}`;

      return (
        <ServerCardErrorBoundary
          key={`boundary-${serverId}`}
          serverId={serverId}
        >
          <ImprovedServerCard
            key={serverId}
            server={server}
            variant="compact"
            showRealTimeUpdates={true}
            index={index}
            onClick={handleServerSelect}
            onAskAI={onAskAI}
          />
        </ServerCardErrorBoundary>
      );
    },
    [handleServerSelect, onAskAI]
  );

  return (
    <div className="w-full">
      {/* 반응형 그리드 - 카드 너비 고정 (min 200px, max 240px) */}
      <div className="grid gap-3 justify-center" style={GRID_STYLE}>
        {servers
          .slice(0, visibleCount)
          .map((server, index) => renderServer(server, index))}
      </div>

      {/* 더보기 버튼 */}
      {remainingCount > 0 && !expanded && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg border-2 border-purple-300 bg-white px-6 py-3 font-medium text-purple-700 transition-all hover:bg-purple-50 hover:border-purple-400"
          >
            <span className="flex items-center gap-2">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {remainingCount}개 더 보기
            </span>
          </button>
        </div>
      )}

      {/* 접기 버튼 */}
      {expanded && remainingCount > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-lg border-2 border-purple-300 bg-white px-6 py-3 font-medium text-purple-700 transition-all hover:bg-purple-50 hover:border-purple-400"
          >
            <span className="flex items-center gap-2">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
              접기
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
