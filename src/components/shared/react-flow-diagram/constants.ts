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
  padding: 0.06,
  includeHiddenNodes: true,
  minZoom: 0.05,
  maxZoom: 0.85,
};

/**
 * 기본 뷰포트 설정 - fitView가 실패할 경우의 폴백
 */
export const DEFAULT_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 0.45,
};

/**
 * 레이아웃 상수
 * 📐 Dagre.js 기반 자동 레이아웃
 */
export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 78;

export const LABEL_AREA_WIDTH = 176;
export const LABEL_NODE_HEIGHT = 36;
export const LABEL_CONTENT_GAP = 32;
export const SWIMLANE_PADDING = 24;

/**
 * 노드 스타일 정의
 */
export const NODE_STYLES: Record<
  CustomNodeData['nodeType'],
  {
    bg: string;
    border: string;
    shadow: string;
    accent: string;
    badge: string;
    iconBg: string;
  }
> = {
  primary: {
    bg: 'bg-white',
    border: 'border-indigo-200',
    shadow: 'shadow-sm shadow-indigo-100/60',
    accent: 'from-indigo-400 via-blue-400 to-sky-400',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    iconBg: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  },
  secondary: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    shadow: 'shadow-sm shadow-slate-200/60',
    accent: 'from-slate-300 via-slate-400 to-slate-500',
    badge: 'border-slate-200 bg-white text-slate-600',
    iconBg: 'border-slate-200 bg-white text-slate-600',
  },
  tertiary: {
    bg: 'bg-white',
    border: 'border-slate-200',
    shadow: '',
    accent: 'from-slate-200 via-slate-300 to-slate-400',
    badge: 'border-slate-200 bg-slate-50 text-slate-500',
    iconBg: 'border-slate-200 bg-slate-50 text-slate-500',
  },
  highlight: {
    bg: 'bg-linear-to-br from-amber-50 to-yellow-50',
    border: 'border-amber-300',
    shadow: 'shadow-sm shadow-amber-100/80',
    accent: 'from-amber-300 via-orange-300 to-rose-300',
    badge: 'border-amber-200 bg-amber-100 text-amber-800',
    iconBg: 'border-amber-200 bg-white text-amber-800',
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
    border: 'border-emerald-500/60',
    glow: 'shadow-[0_0_0_3px_rgba(16,185,129,0.10)]',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  warning: {
    border: 'border-amber-500/60',
    glow: 'shadow-[0_0_0_3px_rgba(245,158,11,0.12)] animate-pulse',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  danger: {
    border: 'border-rose-500/70',
    glow: 'shadow-[0_0_0_3px_rgba(244,63,94,0.12)] animate-pulse',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
  },
  offline: {
    border: 'border-slate-500/40',
    glow: 'grayscale opacity-70',
    text: 'text-slate-600',
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
