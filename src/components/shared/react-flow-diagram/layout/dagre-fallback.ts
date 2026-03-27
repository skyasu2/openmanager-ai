/**
 * Dagre Fallback Layout
 * @description 레이어 정보 없을 때 사용하는 Dagre 기반 폴백 레이아웃
 */

import Dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import { Position } from '@xyflow/react';

import { NODE_HEIGHT, NODE_WIDTH } from '../constants';

interface DagreFallbackOptions {
  direction: string;
  nodesep: number;
  ranksep: number;
}

/**
 * Dagre 폴백 레이아웃 (레이어 정보 없을 때)
 */
export function fallbackDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: DagreFallbackOptions
): { nodes: Node[]; edges: Edge[] } {
  const { direction, nodesep, ranksep } = options;
  const isHorizontal = direction === 'LR';

  const dagreGraph = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep,
    ranksep,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    if (node.type === 'customNode') {
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  Dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    if (node.type !== 'customNode') return node;
    const pos = dagreGraph.node(node.id);
    if (!pos) return node;

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}
