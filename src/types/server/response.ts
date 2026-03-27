/**
 * Server Response Types
 *
 * API 응답 관련 타입
 */

import type { Server } from './core';
import type { SystemOverview } from './status';

/**
 * 페이지네이션 정보
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * 실시간 서버 응답
 */
export interface RealtimeServersResponse {
  servers: Server[];
  summary: {
    servers: SystemOverview;
  };
  pagination: PaginationInfo;
  success: boolean;
  data: Server[];
  timestamp: number;
  count: number;
}
