/**
 * ReactFlowDiagram Types
 * @description React Flow 다이어그램 관련 타입 정의
 */

import type { ArchitectureDiagram } from '@/data/architecture-diagrams.data';

import type { Server } from '@/types/server';

export interface ReactFlowDiagramProps {
  diagram: ArchitectureDiagram;
  /** 컴팩트 모드 (모달 내부용) */
  compact?: boolean;
  /** 컨트롤 표시 여부 */
  showControls?: boolean;
  /** 미니맵 표시 여부 */
  showMiniMap?: boolean;
  /** 상단 제목/설명 헤더 표시 여부 */
  showHeader?: boolean;
  /** 하단 범례 표시 여부 */
  showLegend?: boolean;
  /** 캔버스 내부 상단 줌 툴바 표시 여부 */
  showZoomToolbar?: boolean;
  /** 모달/전체 화면에서 캔버스 높이를 우선 확장 */
  maximizeViewport?: boolean;
  /** 서버 실시간 데이터 (ID 매핑용) */
  servers?: Server[];
  /** 인프라 맵 표시 모드 */
  displayMode?: ReactFlowDisplayMode;
  /** 실시간 서버 노드 선택 */
  onServerSelect?: (server: Server) => void;
  /** 맵 안에서 현재 선택된 서버 */
  selectedServerId?: string | null;
}

export type ReactFlowDisplayMode = 'dependencies' | 'status';

export interface CustomNodeData extends Record<string, unknown> {
  label: string;
  sublabel?: string;
  icon?: string;
  nodeType: 'primary' | 'secondary' | 'tertiary' | 'highlight';
  /** @description 레이어 색상 (디버깅/확장용) */
  layerColor: string;
  /** @description 레이어 제목 (디버깅/확장용) */
  layerTitle: string;
  /** @description 실시간 서버 상태 (매핑된 경우) */
  status?: Server['status'];
  /** @description 전체 서버 데이터 객체 */
  serverData?: Server;
  /** @description 상태/의존성 노드 표현 모드 */
  displayMode: ReactFlowDisplayMode;
  /** @description 매핑된 서버 선택 */
  onServerSelect?: (server: Server) => void;
  /** @description 현재 선택된 서버 노드 */
  isSelected?: boolean;
  /** @description 선택 서버의 1-hop 이웃 노드 */
  isRelated?: boolean;
  /** @description 선택 경로 밖의 흐린 노드 */
  isDimmed?: boolean;
}

export interface SwimlaneBgData extends Record<string, unknown> {
  width: number;
  height: number;
  color: string;
  title: string;
}

export interface LayerLabelData extends Record<string, unknown> {
  title: string;
  color: string;
}

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodesep?: number;
  ranksep?: number;
  nodeLayerMap?: Map<string, number>;
}
