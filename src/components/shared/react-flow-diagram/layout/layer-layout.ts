/**
 * Layer-First Layout Algorithm
 * @description 레이어 우선 레이아웃 알고리즘
 *
 * Dagre의 rank 제약이 그래프 구조를 오버라이드하지 못하므로,
 * 레이어 인덱스 기반으로 Y 위치를 직접 계산하고
 * 각 레이어 내에서 X 위치를 균등 분배합니다.
 */

import type { Edge, Node } from '@xyflow/react';
import { Position } from '@xyflow/react';

import { NODE_HEIGHT, NODE_WIDTH } from '../constants';
import type { LayoutOptions } from '../types';
import { fallbackDagreLayout } from './dagre-fallback';

/**
 * 레이어 우선 레이아웃 알고리즘
 * @param nodeLayerMap - 노드 ID → 레이어 인덱스 매핑
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'TB',
    nodesep = 60,
    ranksep = 80,
    nodeLayerMap,
  } = options;
  const isHorizontal = direction === 'LR';

  // 레이어 정보가 없으면 Dagre 폴백
  if (!nodeLayerMap || nodeLayerMap.size === 0) {
    return fallbackDagreLayout(nodes, edges, {
      direction,
      nodesep,
      ranksep,
    });
  }

  // 레이어별 노드 그룹화
  const layerNodes: Map<number, Node[]> = new Map();
  nodes.forEach((node) => {
    if (node.type !== 'customNode') return;
    const layerIndex = nodeLayerMap.get(node.id);
    if (layerIndex === undefined) return;

    const existing = layerNodes.get(layerIndex) || [];
    existing.push(node);
    layerNodes.set(layerIndex, existing);
  });

  // 레이어 메타데이터 계산 (높이, 행 수, Wrapping)
  const layerMeta = new Map<
    number,
    { startY: number; nodesPerRow: number; rowCount: number }
  >();
  let currentY = 0;
  const sortedLayerIndices = Array.from(layerNodes.keys()).sort(
    (a, b) => a - b
  );

  sortedLayerIndices.forEach((layerIndex) => {
    const nodesInLayer = layerNodes.get(layerIndex) || [];
    const count = nodesInLayer.length;

    // Smart Grid: 8개 이상(예: MCP)은 4개씩, 그 외는 최대 5개씩
    const nodesPerRow = count >= 8 ? 4 : 5;
    const rowCount = Math.ceil(count / nodesPerRow);

    layerMeta.set(layerIndex, { startY: currentY, nodesPerRow, rowCount });

    // 레이어 높이: 노드 높이 * 줄 수 + 줄 간격(ranksep/2) + 다음 레이어 간격(ranksep)
    const rowGap = ranksep * 0.4;
    const layerHeight = rowCount * NODE_HEIGHT + (rowCount - 1) * rowGap;

    currentY += layerHeight + ranksep;
  });

  // 전체 최대 너비 계산 (Wrapping 고려)
  let maxRowWidth = 0;
  sortedLayerIndices.forEach((layerIndex) => {
    const nodesInLayer = layerNodes.get(layerIndex) || [];
    const meta = layerMeta.get(layerIndex);
    if (!meta) return;

    // 가장 넓은 행(꽉 찬 행) 기준으로 너비 계산
    const effectiveCols = Math.min(nodesInLayer.length, meta.nodesPerRow);
    const width = effectiveCols * (NODE_WIDTH + nodesep) - nodesep;
    if (width > maxRowWidth) maxRowWidth = width;
  });
  const totalWidth = maxRowWidth;

  // 노드 위치 매핑
  const layoutedNodes = nodes.map((node) => {
    if (node.type !== 'customNode') return node;

    const layerIndex = nodeLayerMap.get(node.id);
    if (layerIndex === undefined) return node;

    const nodesInLayer = layerNodes.get(layerIndex) || [];
    const nodeIndexInLayer = nodesInLayer.findIndex((n) => n.id === node.id);
    const meta = layerMeta.get(layerIndex);

    if (!meta) return node;

    // Grid 위치 (Row, Col)
    const row = Math.floor(nodeIndexInLayer / meta.nodesPerRow);
    const col = nodeIndexInLayer % meta.nodesPerRow;

    // 마지막 줄 중앙 정렬 로직
    const isLastRow = row === meta.rowCount - 1;
    const itemsInLastRow =
      nodesInLayer.length % meta.nodesPerRow || meta.nodesPerRow;
    const itemsInCurrentRow = isLastRow ? itemsInLastRow : meta.nodesPerRow;

    const rowWidth = itemsInCurrentRow * (NODE_WIDTH + nodesep) - nodesep;
    // 전체 중앙 정렬: (전체폭 - 현재행폭) / 2
    const rowStartX = (totalWidth - rowWidth) / 2;

    const x = rowStartX + col * (NODE_WIDTH + nodesep);

    // Y 위치
    const rowGap = ranksep * 0.4;
    const y = meta.startY + row * (NODE_HEIGHT + rowGap);

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x, y },
    };
  });

  return { nodes: layoutedNodes, edges };
}
