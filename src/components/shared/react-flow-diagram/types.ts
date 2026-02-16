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
  /** 서버 실시간 데이터 (ID 매핑용) */
  servers?: Server[];
}

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
  status?: 'running' | 'warning' | 'danger' | 'offline';
  /** @description 전체 서버 데이터 객체 */
  serverData?: Server;
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
