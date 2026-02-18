'use client';

/**
 * ReactFlowDiagram Component
 * @description React Flow 기반 아키텍처 다이어그램 렌더링 컴포넌트
 *
 * 기존 ArchitectureDiagram.tsx 대비 개선점:
 * - connections 데이터를 실제 연결선으로 렌더링
 * - 인터랙티브한 노드 (드래그, 줌, 패닝)
 * - 더 정교한 레이아웃
 *
 * @version 5.92.3
 * @updated 2026-01-22 - Modular split (12 files)
 */

import * as Tooltip from '@radix-ui/react-tooltip';
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { memo, useEffect, useMemo, useRef } from 'react';
import '@xyflow/react/dist/style.css';

import { AutoFitView, DiagramErrorBoundary } from './components';
import {
  ARIA_LABEL_CONFIG,
  DEFAULT_VIEWPORT,
  FIT_VIEW_OPTIONS,
} from './constants';
import { CustomNode, LayerLabelNode, SwimlaneBgNode } from './nodes';
import type { CustomNodeData, ReactFlowDiagramProps } from './types';
import { convertToReactFlow } from './utils';

// Node types registration
const nodeTypes = {
  customNode: CustomNode,
  layerLabel: LayerLabelNode,
  swimlaneBg: SwimlaneBgNode,
};

function ReactFlowDiagram({
  diagram,
  compact = true,
  showControls = true,
  showMiniMap = false,
  servers = [],
}: ReactFlowDiagramProps) {
  // onInit setTimeout 클린업용 ref
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, []);

  const { nodes, edges } = useMemo(
    () => convertToReactFlow(diagram, servers),
    [diagram, servers]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#60a5fa', strokeWidth: 1.5, strokeDasharray: '5,5' },
    }),
    []
  );

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="flex flex-col space-y-4">
        {/* 다이어그램 헤더 */}
        <div className="text-center">
          <h3 className="mb-2 text-xl font-bold text-white">{diagram.title}</h3>
          <p className="mx-auto max-w-2xl text-sm text-gray-300">
            {diagram.description}
          </p>
        </div>

        {/* React Flow 캔버스 */}
        <DiagramErrorBoundary diagramTitle={diagram.title}>
          <div
            className={`rounded-xl border border-white/10 bg-linear-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl shadow-2xl ${
              compact
                ? 'h-[48dvh] sm:h-[50dvh] lg:h-[52dvh] max-h-[380px] sm:max-h-card-lg lg:max-h-[440px]'
                : 'h-[52dvh] sm:h-[55dvh] lg:h-[58dvh] max-h-[420px] sm:max-h-[460px] lg:max-h-[520px]'
            }`}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              defaultViewport={DEFAULT_VIEWPORT}
              fitView
              fitViewOptions={FIT_VIEW_OPTIONS}
              onInit={(instance) => {
                if (initTimeoutRef.current)
                  clearTimeout(initTimeoutRef.current);
                initTimeoutRef.current = setTimeout(
                  () => instance.fitView(FIT_VIEW_OPTIONS),
                  800
                );
              }}
              minZoom={0.05}
              maxZoom={2.5}
              defaultEdgeOptions={defaultEdgeOptions}
              proOptions={{ hideAttribution: true }}
              nodesFocusable
              edgesFocusable
              className="react-flow-dark"
              aria-label={`${diagram.title} 아키텍처 다이어그램`}
            >
              <Background color="#94a3b8" gap={24} size={1.5} />
              {showControls && (
                <Controls
                  className="!border-white/20 !bg-slate-800/80 [&>button]:!border-white/20 [&>button]:!bg-slate-700/80 [&>button:hover]:!bg-slate-600/80 [&>button>svg]:!fill-white/80"
                  showInteractive={false}
                  aria-label={ARIA_LABEL_CONFIG['controls.ariaLabel']}
                />
              )}
              {showMiniMap && (
                <MiniMap
                  className="!border-white/20 !bg-slate-800/80"
                  nodeColor={(node) => {
                    const data = node.data as CustomNodeData;
                    if (data?.nodeType === 'highlight')
                      return 'rgba(250, 204, 21, 0.8)';
                    if (data?.nodeType === 'primary')
                      return 'rgba(255, 255, 255, 0.6)';
                    return 'rgba(255, 255, 255, 0.3)';
                  }}
                  maskColor="rgba(0, 0, 0, 0.8)"
                  aria-label={ARIA_LABEL_CONFIG['minimap.ariaLabel']}
                />
              )}
              <AutoFitView />
            </ReactFlow>
          </div>
        </DiagramErrorBoundary>

        {/* 범례 */}
        <div className="flex flex-wrap justify-center gap-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded bg-linear-to-br from-yellow-500/40 to-amber-500/40 ring-1 ring-yellow-400/50" />
            <span className="text-2xs text-gray-400">핵심</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded bg-white/15 ring-1 ring-white/30" />
            <span className="text-2xs text-gray-400">주요</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded bg-white/5 ring-1 ring-white/10" />
            <span className="text-2xs text-gray-400">보조</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-4 border-t border-dashed border-purple-400/60" />
            <span className="text-2xs text-gray-400">검증</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-4 border-t border-white/40" />
            <span className="text-2xs text-gray-400">데이터</span>
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

export default memo(ReactFlowDiagram);

// Re-export types for external use
export type { CustomNodeData, ReactFlowDiagramProps } from './types';
