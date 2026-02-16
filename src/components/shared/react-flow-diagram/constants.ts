/**
 * ReactFlowDiagram Constants
 * @description React Flow 다이어그램 관련 상수 정의
 */

import type { CustomNodeData } from './types';

/**
 * fitView 옵션 - 모든 노드가 화면에 보이도록 설정
 * padding: 12% 여백으로 노드가 가장자리에 닿지 않도록
 * includeHiddenNodes: 숨겨진 노드도 포함
 */
export const FIT_VIEW_OPTIONS = {
  padding: 0.12,
  includeHiddenNodes: true,
  minZoom: 0.05,
  maxZoom: 0.85,
};

/**
 * 기본 뷰포트 설정 - fitView가 실패할 경우의 폴백
 */
export const DEFAULT_VIEWPORT = {
  x: 550,
  y: 10,
  zoom: 0.75,
};

/**
 * 레이아웃 상수
 * 📐 Dagre.js 기반 자동 레이아웃
 */
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 52;

export const LABEL_AREA_WIDTH = 160;
export const LABEL_NODE_HEIGHT = 36;
export const LABEL_CONTENT_GAP = 32;
export const SWIMLANE_PADDING = 24;

/**
 * 노드 스타일 정의
 */
export const NODE_STYLES: Record<
  CustomNodeData['nodeType'],
  { bg: string; border: string; shadow: string }
> = {
  primary: {
    bg: 'bg-white/15 backdrop-blur-sm',
    border: 'border-white/30',
    shadow: 'shadow-lg shadow-white/5',
  },
  secondary: {
    bg: 'bg-white/10 backdrop-blur-sm',
    border: 'border-white/20',
    shadow: 'shadow-md shadow-white/5',
  },
  tertiary: {
    bg: 'bg-white/5 backdrop-blur-sm',
    border: 'border-white/10',
    shadow: '',
  },
  highlight: {
    bg: 'bg-linear-to-br from-yellow-500/25 to-amber-500/25 backdrop-blur-sm',
    border: 'border-yellow-400/50',
    shadow: 'shadow-lg shadow-yellow-500/10',
  },
};

/**
 * 실시간 상태 스타일 정의
 */
export const STATUS_STYLES: Record<
  string,
  { border: string; glow: string; text: string; dot: string }
> = {
  running: {
    border: 'border-emerald-500/50',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
  },
  warning: {
    border: 'border-amber-500/60',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
  },
  danger: {
    border: 'border-rose-500/70',
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse',
    text: 'text-rose-400',
    dot: 'bg-rose-500',
  },
  offline: {
    border: 'border-slate-500/40',
    glow: 'grayscale opacity-70',
    text: 'text-slate-400',
    dot: 'bg-slate-500',
  },
};

/**
 * 접근성 라벨 설정 (WCAG AA)
 */
export const ARIA_LABEL_CONFIG = {
  'node.ariaLabel': '노드: {label}',
  'edge.ariaLabel': '연결: {sourceLabel}에서 {targetLabel}로',
  'controls.ariaLabel': '다이어그램 컨트롤',
  'controls.zoomIn.ariaLabel': '확대',
  'controls.zoomOut.ariaLabel': '축소',
  'controls.fitView.ariaLabel': '화면에 맞춤',
  'minimap.ariaLabel': '미니맵 - 다이어그램 전체 보기',
};
