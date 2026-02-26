/**
 * 🖥️ 서버 대시보드 표시 설정 통합 관리
 *
 * 실제 서버 개수와 화면 표시 개수의 혼동을 방지하기 위한 중앙 설정입니다.
 */

import { BREAKPOINTS } from './constants';
import { ACTIVE_SERVER_CONFIG } from './serverConfig';

/**
 * 📊 서버 표시 모드 정의
 */
export type ServerDisplayMode =
  | 'SHOW_ALL' // 모든 서버 표시
  | 'SHOW_HALF' // 절반씩 표시 (8개)
  | 'SHOW_QUARTER' // 1/4씩 표시 (4개)
  | 'SHOW_THIRD' // 1/3씩 표시 (5개)
  | 'SHOW_TWO_ROWS' // 세로 2줄 표시 (화면 크기별 동적)
  | 'SHOW_CUSTOM'; // 사용자 정의

/**
 * 🎯 서버 표시 설정 인터페이스
 *
 * * 디스플레이 설정 (초기값)
 *
 * // Verified: 2025-12-12
 */
export interface ServerDisplayConfig {
  // 📊 데이터 생성 관련
  actualServerCount: number; // 실제 생성되는 서버 개수

  // 🖥️ 화면 표시 관련
  displayMode: ServerDisplayMode; // 표시 모드
  cardsPerPage: number; // 페이지당 카드 개수
  enablePagination: boolean; // 페이지네이션 활성화 여부

  // 🎨 UI 관련
  gridLayout: {
    mobile: number; // 모바일 열 수
    tablet: number; // 태블릿 열 수
    desktop: number; // 데스크톱 열 수
    large: number; // 대형 화면 열 수
  };

  // 📱 반응형 세로 2줄 설정
  twoRowsLayout: {
    mobile: { cols: number; rows: number }; // 모바일: 2x4 = 8개
    tablet: { cols: number; rows: number }; // 태블릿: 4x2 = 8개
    desktop: { cols: number; rows: number }; // 데스크톱: 6x2 = 12개
    large: { cols: number; rows: number }; // 대형: 8x2 = 16개
  };

  // 🎛️ UI/UX 개선 옵션
  uxEnhancements: {
    showServerCounter: boolean; // 서버 개수 표시
    showPaginationInfo: boolean; // 페이지네이션 정보 표시
    enableViewModeToggle: boolean; // 뷰 모드 토글
    showLoadingProgress: boolean; // 로딩 진행률 표시
  };
}

/**
 * 🎯 화면 크기별 세로 2줄 계산
 */
export const calculateTwoRowsLayout = (screenWidth: number) => {
  if (screenWidth < BREAKPOINTS.MOBILE) {
    // 모바일: 2열 x 2줄 = 4개
    return { cols: 2, rows: 2, total: 4 };
  } else if (screenWidth < 1024) {
    // 태블릿: 4열 x 2줄 = 8개
    return { cols: 4, rows: 2, total: 8 };
  } else if (screenWidth < 1280) {
    // 데스크톱: 6열 x 2줄 = 12개
    return { cols: 6, rows: 2, total: 12 };
  } else {
    // 대형 화면: 8열 x 2줄 = 16개 (하지만 15개까지만)
    return { cols: 8, rows: 2, total: 15 }; // 실제 서버 수에 맞춤
  }
};

/**
 * 🎯 기본 서버 표시 설정
 */
export const DEFAULT_SERVER_DISPLAY_CONFIG: ServerDisplayConfig = {
  // 📊 데이터 생성 관련
  actualServerCount: ACTIVE_SERVER_CONFIG.maxServers, // 15개

  // 🖥️ 화면 표시 관련
  displayMode: 'SHOW_TWO_ROWS', // 🆕 세로 2줄 모드
  cardsPerPage: 15, // 동적으로 계산됨
  enablePagination: true,

  // 🎨 UI 관련
  gridLayout: {
    mobile: 1, // 1열
    tablet: 2, // 2열
    desktop: 3, // 3열
    large: 4, // 4열 (최대 15개까지)
  },

  // 📱 반응형 세로 2줄 설정
  twoRowsLayout: {
    mobile: { cols: 1, rows: 2 }, // 1x2 = 2개
    tablet: { cols: 2, rows: 2 }, // 2x2 = 4개
    desktop: { cols: 3, rows: 2 }, // 3x2 = 6개
    large: { cols: 4, rows: 2 }, // 4x2 = 8개
  },

  // 🎛️ UI/UX 개선 옵션
  uxEnhancements: {
    showServerCounter: true, // "15개 중 8개 표시"
    showPaginationInfo: true, // "1/2 페이지"
    enableViewModeToggle: true, // 그리드/리스트 토글
    showLoadingProgress: true, // 로딩 진행률
  },
};

/**
 * 🎯 표시 모드별 설정 계산
 */
export const getDisplayModeConfig = (
  mode: ServerDisplayMode,
  screenWidth: number = 1280
) => {
  const actualCount = ACTIVE_SERVER_CONFIG.maxServers;

  switch (mode) {
    case 'SHOW_ALL':
      return {
        cardsPerPage: actualCount,
        enablePagination: false,
        description: '모든 서버 표시',
      };

    case 'SHOW_HALF':
      return {
        cardsPerPage: Math.ceil(actualCount / 2), // 8개
        enablePagination: true,
        description: '절반씩 표시',
      };

    case 'SHOW_QUARTER':
      return {
        cardsPerPage: Math.ceil(actualCount / 4), // 4개
        enablePagination: true,
        description: '1/4씩 표시',
      };

    case 'SHOW_THIRD':
      return {
        cardsPerPage: Math.ceil(actualCount / 3), // 5개
        enablePagination: true,
        description: '1/3씩 표시',
      };

    case 'SHOW_TWO_ROWS': {
      const layout = calculateTwoRowsLayout(screenWidth);
      return {
        cardsPerPage: Math.min(layout.total, actualCount),
        enablePagination: layout.total < actualCount,
        description: `${layout.cols}열 x ${layout.rows}줄 표시`,
        gridCols: layout.cols,
        gridRows: layout.rows,
      };
    }

    default:
      return {
        cardsPerPage: actualCount,
        enablePagination: false,
        description: '기본 표시',
      };
  }
};

/**
 * 🎯 UI/UX 개선을 위한 표시 정보 생성
 */
export const generateDisplayInfo = (
  currentMode: ServerDisplayMode,
  currentPage: number = 1,
  totalServers: number = ACTIVE_SERVER_CONFIG.maxServers
) => {
  const config = getDisplayModeConfig(currentMode);
  const totalPages = Math.ceil(totalServers / config.cardsPerPage);
  const startIndex = (currentPage - 1) * config.cardsPerPage + 1;
  const endIndex = Math.min(currentPage * config.cardsPerPage, totalServers);

  return {
    // 📊 기본 정보
    totalServers,
    cardsPerPage: config.cardsPerPage,
    totalPages,
    currentPage,

    // 🎯 표시 정보
    displayedCount: endIndex - startIndex + 1,
    displayRange: `${startIndex}-${endIndex}`,

    // 📝 사용자 친화적 메시지
    statusMessage: `전체 ${totalServers}개 서버 중 ${startIndex}-${endIndex}번째 표시`,
    paginationMessage:
      totalPages > 1 ? `${currentPage}/${totalPages} 페이지` : '전체 표시',
    modeDescription: config.description,

    // 🎛️ 설정 정보
    hasPagination: config.enablePagination,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};

/**
 * 🎯 현재 활성 표시 설정
 */
export const ACTIVE_DISPLAY_CONFIG = DEFAULT_SERVER_DISPLAY_CONFIG;

/**
 * 💡 사용 예시:
 *
 * // 8개씩 표시하고 싶을 때:
 * const halfConfig = createDisplayConfig('SHOW_HALF');
 *
 * // 4개씩 표시하고 싶을 때:
 * const quarterConfig = createDisplayConfig('SHOW_QUARTER');
 *
 * // 사용자 정의 개수 (예: 6개):
 * const customConfig = createDisplayConfig('SHOW_CUSTOM', 6);
 */
