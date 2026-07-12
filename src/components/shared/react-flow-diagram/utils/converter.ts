/**
 * Data Converter
 * @description 기존 데이터 형식을 React Flow 노드/엣지로 변환
 *
 * 📐 하이브리드 레이아웃: Swimlane 배경 + Dagre 자동 배치
 * 1단계: 콘텐츠 노드와 엣지 생성
 * 2단계: Dagre 레이아웃 적용
 * 3단계: 레이아웃 결과 기반 Swimlane 배경 생성
 */

import type { Edge, Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.data';
import { logger } from '@/lib/logging';
import type { Server } from '@/types/server';

import {
  LABEL_AREA_WIDTH,
  LABEL_CONTENT_GAP,
  LABEL_NODE_HEIGHT,
  NODE_HEIGHT,
  NODE_WIDTH,
  SWIMLANE_PADDING,
} from '../constants';
import { getLayoutedElements } from '../layout';
import type {
  CustomNodeData,
  ReactFlowDisplayMode,
  SwimlaneBgData,
} from '../types';

interface ConvertToReactFlowOptions {
  displayMode?: ReactFlowDisplayMode;
  onServerSelect?: (server: Server) => void;
  selectedServerId?: string | null;
}

export function convertToReactFlow(
  diagram: ArchitectureDiagram,
  servers: Server[] = [],
  {
    displayMode = 'dependencies',
    onServerSelect,
    selectedServerId,
  }: ConvertToReactFlowOptions = {}
): {
  nodes: Node[];
  edges: Edge[];
} {
  const contentNodes: Node[] = [];
  const edges: Edge[] = [];

  // 서버 ID 맵 생성
  const serverMap = new Map(servers.map((s) => [s.id, s]));
  const selectedNeighborIds = new Set<string>();
  if (selectedServerId) {
    for (const connection of diagram.connections ?? []) {
      if (connection.from === selectedServerId) {
        selectedNeighborIds.add(connection.to);
      }
      if (connection.to === selectedServerId) {
        selectedNeighborIds.add(connection.from);
      }
    }
  }

  // 레이어별 노드 ID 매핑 (Swimlane 생성용)
  const layerNodeIds: Map<number, string[]> = new Map();
  // 노드 ID → 레이어 인덱스 매핑 (Dagre rank 제약용)
  const nodeLayerMap: Map<string, number> = new Map();

  // 1단계: 콘텐츠 노드 생성
  diagram.layers.forEach((layer, layerIndex) => {
    const nodeIds: string[] = [];

    layer.nodes.forEach((node) => {
      nodeIds.push(node.id);
      nodeLayerMap.set(node.id, layerIndex);

      const serverData = serverMap.get(node.id);

      contentNodes.push({
        id: node.id,
        type: 'customNode',
        position: { x: 0, y: 0 },
        data: {
          label: node.label,
          sublabel: node.sublabel,
          icon: node.icon,
          nodeType: node.type,
          layerColor: layer.color,
          layerTitle: layer.title,
          status: serverData?.status,
          serverData: serverData,
          displayMode,
          onServerSelect,
          isSelected: node.id === selectedServerId,
          isRelated: selectedNeighborIds.has(node.id),
          isDimmed: Boolean(
            selectedServerId &&
              node.id !== selectedServerId &&
              !selectedNeighborIds.has(node.id)
          ),
        } as CustomNodeData,
      });
    });

    layerNodeIds.set(layerIndex, nodeIds);
  });

  // 엣지 생성
  if (diagram.connections) {
    const validNodeIds = new Set(contentNodes.map((n) => n.id));

    // 팬아웃/팬인 감지
    const sourceConnectionCount: Record<string, number> = {};
    const targetConnectionCount: Record<string, number> = {};
    diagram.connections.forEach((conn) => {
      sourceConnectionCount[conn.from] =
        (sourceConnectionCount[conn.from] || 0) + 1;
      targetConnectionCount[conn.to] =
        (targetConnectionCount[conn.to] || 0) + 1;
    });

    // 소스별 첫 번째 라벨 표시 여부 추적 (fan-out 시 첫 연결만 라벨 표시)
    const sourceFirstLabelShown = new Set<string>();

    diagram.connections.forEach((conn, index) => {
      // 유효성 검사
      if (!validNodeIds.has(conn.from) || !validNodeIds.has(conn.to)) {
        logger.warn('[ReactFlowDiagram] Invalid connection skipped:', conn);
        return;
      }

      const isFanOut = (sourceConnectionCount[conn.from] ?? 0) >= 4;
      const isFanIn = (targetConnectionCount[conn.to] ?? 0) >= 3;
      const isConverging = isFanOut || isFanIn;

      const sourceStatus = serverMap.get(conn.from)?.status;
      const targetStatus = serverMap.get(conn.to)?.status;
      const statuses = [sourceStatus, targetStatus];
      const edgeSeverity = statuses.some((status) =>
        ['critical', 'offline'].includes(status ?? '')
      )
        ? 'critical'
        : statuses.some((status) =>
              ['warning', 'maintenance', 'unknown'].includes(status ?? '')
            )
          ? 'warning'
          : 'normal';
      const touchesSelected = Boolean(
        selectedServerId &&
          (conn.from === selectedServerId || conn.to === selectedServerId)
      );
      const isDimmedBySelection = Boolean(selectedServerId && !touchesSelected);
      const isProblemEdge = edgeSeverity !== 'normal';
      const animateEdge =
        displayMode === 'status' ? isProblemEdge || touchesSelected : true;
      const animationSpeed = conn.type === 'dashed' ? 1.5 : 3;

      const getStrokeColor = () => {
        if (isDimmedBySelection) return 'rgba(148, 163, 184, 0.12)';
        if (displayMode === 'status' && edgeSeverity === 'critical')
          return '#f43f5e';
        if (displayMode === 'status' && edgeSeverity === 'warning')
          return '#f59e0b';
        if (displayMode === 'status' && touchesSelected) return '#4f46e5';
        if (displayMode === 'status') return 'rgba(148, 163, 184, 0.28)';
        if (conn.type === 'dashed') return 'rgba(167, 139, 250, 0.5)';
        if (isConverging) return 'rgba(255, 255, 255, 0.35)';
        return 'rgba(255, 255, 255, 0.6)';
      };

      const getMarkerColor = () => {
        if (isDimmedBySelection) return 'rgba(148, 163, 184, 0.15)';
        if (displayMode === 'status' && edgeSeverity === 'critical')
          return '#f43f5e';
        if (displayMode === 'status' && edgeSeverity === 'warning')
          return '#f59e0b';
        if (displayMode === 'status' && touchesSelected) return '#4f46e5';
        if (displayMode === 'status') return 'rgba(148, 163, 184, 0.35)';
        if (conn.type === 'dashed') return 'rgba(167, 139, 250, 0.7)';
        if (isConverging) return 'rgba(255, 255, 255, 0.45)';
        return 'rgba(255, 255, 255, 0.8)';
      };

      const strokeWidth = isDimmedBySelection
        ? 0.8
        : displayMode === 'status' && (isProblemEdge || touchesSelected)
          ? 3
          : displayMode === 'status'
            ? 1
            : isConverging
              ? 1.2
              : 2;

      // fan-out 소스의 첫 번째 연결만 라벨 표시
      const showLabel = !isFanOut || !sourceFirstLabelShown.has(conn.from);
      if (isFanOut && showLabel) {
        sourceFirstLabelShown.add(conn.from);
      }

      edges.push({
        id: `edge-${index}`,
        source: conn.from,
        target: conn.to,
        type: 'smoothstep',
        animated: animateEdge,
        style: {
          stroke: getStrokeColor(),
          strokeWidth,
          strokeDasharray: conn.type === 'dashed' ? '5 5' : undefined,
          animationDuration: `${animationSpeed}s`,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: strokeWidth >= 3 ? 18 : isConverging ? 10 : 15,
          height: strokeWidth >= 3 ? 18 : isConverging ? 10 : 15,
          color: getMarkerColor(),
        },
        label: showLabel && !isDimmedBySelection ? conn.label : undefined,
        labelStyle: {
          fill: 'rgba(255, 255, 255, 0.9)',
          fontSize: 10,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: 'rgba(15, 23, 42, 0.9)',
          fillOpacity: 0.9,
        },
        labelBgPadding: [4, 4] as [number, number],
        labelBgBorderRadius: 4,
      });
    });
  }

  // 2단계: 동적 Dagre 파라미터 계산
  const maxNodesInLayer = Math.max(
    ...diagram.layers.map((layer) => layer.nodes.length)
  );

  const dynamicNodesep =
    maxNodesInLayer > 6 ? 30 : maxNodesInLayer > 4 ? 45 : 60;

  const dynamicRanksep = maxNodesInLayer > 6 ? 60 : 80;

  // 3단계: Dagre 레이아웃 적용
  const { nodes: layoutedContentNodes } = getLayoutedElements(
    contentNodes,
    edges,
    {
      direction: 'TB',
      nodesep: dynamicNodesep,
      ranksep: dynamicRanksep,
      nodeLayerMap,
    }
  );

  // 4단계: Swimlane 배경 및 라벨 생성
  const allNodes: Node[] = [];

  // 레이어별 bounds 계산
  const layerBounds: Map<
    number,
    { minX: number; maxX: number; minY: number; maxY: number }
  > = new Map();

  layoutedContentNodes.forEach((node) => {
    if (node.type !== 'customNode') return;

    for (const [layerIndex, nodeIds] of layerNodeIds.entries()) {
      if (nodeIds.includes(node.id)) {
        const bounds = layerBounds.get(layerIndex) ?? {
          minX: Infinity,
          maxX: -Infinity,
          minY: Infinity,
          maxY: -Infinity,
        };

        bounds.minX = Math.min(bounds.minX, node.position.x);
        bounds.maxX = Math.max(bounds.maxX, node.position.x + NODE_WIDTH);
        bounds.minY = Math.min(bounds.minY, node.position.y);
        bounds.maxY = Math.max(bounds.maxY, node.position.y + NODE_HEIGHT);

        layerBounds.set(layerIndex, bounds);
        break;
      }
    }
  });

  // 전체 콘텐츠 영역 계산
  let globalMinX = Infinity;
  let globalMaxX = -Infinity;

  layerBounds.forEach((bounds) => {
    globalMinX = Math.min(globalMinX, bounds.minX);
    globalMaxX = Math.max(globalMaxX, bounds.maxX);
  });

  // Swimlane 배경 및 라벨 생성
  diagram.layers.forEach((layer, layerIndex) => {
    const bounds = layerBounds.get(layerIndex);
    if (!bounds) return;

    const bgLeft =
      globalMinX - SWIMLANE_PADDING - LABEL_AREA_WIDTH - LABEL_CONTENT_GAP;
    const bgRight = globalMaxX + SWIMLANE_PADDING;
    const bgWidth = bgRight - bgLeft;
    const bgHeight = bounds.maxY - bounds.minY + SWIMLANE_PADDING * 2;

    // Swimlane 배경
    allNodes.push({
      id: `swimlane-bg-${layerIndex}`,
      type: 'swimlaneBg',
      position: { x: bgLeft, y: bounds.minY - SWIMLANE_PADDING },
      data: {
        width: bgWidth,
        height: bgHeight,
        color: layer.color,
        title: layer.title,
      } as SwimlaneBgData,
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      width: bgWidth,
      height: bgHeight,
    });

    // 레이어 라벨
    const labelX = bgLeft + SWIMLANE_PADDING;
    const labelY =
      bounds.minY + (bounds.maxY - bounds.minY) / 2 - LABEL_NODE_HEIGHT / 2;

    allNodes.push({
      id: `layer-${layerIndex}`,
      type: 'layerLabel',
      position: { x: labelX, y: labelY },
      style: { width: LABEL_AREA_WIDTH, height: LABEL_NODE_HEIGHT },
      data: { title: layer.title, color: layer.color },
      draggable: false,
      selectable: false,
    });
  });

  // 콘텐츠 노드 추가
  allNodes.push(...layoutedContentNodes);

  return { nodes: allNodes, edges };
}
