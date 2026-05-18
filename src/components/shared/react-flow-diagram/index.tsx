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
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { Maximize2, Minus, Plus } from 'lucide-react';
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

function DiagramZoomToolbar() {
  const reactFlow = useReactFlow();

  return (
    <fieldset className="nodrag nopan absolute right-3 top-3 z-10 flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white/90 shadow-md backdrop-blur-md">
      <legend className="sr-only">토폴로지 줌 컨트롤</legend>
      <button
        type="button"
        onClick={() => reactFlow.zoomIn?.({ duration: 180 })}
        className="flex h-9 w-9 items-center justify-center border-r border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-label="토폴로지 확대"
        title="확대"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => reactFlow.zoomOut?.({ duration: 180 })}
        className="flex h-9 w-9 items-center justify-center border-r border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-label="토폴로지 축소"
        title="축소"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => reactFlow.fitView(FIT_VIEW_OPTIONS)}
        className="flex h-9 w-9 items-center justify-center text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-label="토폴로지 화면 맞춤"
        title="화면 맞춤"
      >
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </fieldset>
  );
}

function ReactFlowDiagram({
  diagram,
  compact = true,
  showControls = true,
  showMiniMap = false,
  showHeader = true,
  showLegend = true,
  showZoomToolbar = false,
  maximizeViewport = false,
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
      style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '5,5' },
    }),
    []
  );

  const canvasHeightClass = maximizeViewport
    ? 'h-[60dvh] sm:h-[64dvh] lg:h-[68dvh] max-h-[72dvh]'
    : compact
      ? 'h-[48dvh] sm:h-[50dvh] lg:h-[52dvh] max-h-[380px] sm:max-h-card-lg lg:max-h-[440px]'
      : 'h-[52dvh] sm:h-[55dvh] lg:h-[58dvh] max-h-[420px] sm:max-h-[460px] lg:max-h-[520px]';

  const containerClassName = maximizeViewport
    ? 'flex flex-col space-y-2'
    : 'flex flex-col space-y-4';

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={containerClassName}>
        {/* 다이어그램 헤더 */}
        {showHeader && (
          <div className="text-center">
            <h3 className="mb-2 text-xl font-bold text-slate-800">
              {diagram.title}
            </h3>
            <p className="mx-auto max-w-2xl text-sm text-slate-500">
              {diagram.description}
            </p>
          </div>
        )}

        {/* React Flow 캔버스 */}
        <DiagramErrorBoundary diagramTitle={diagram.title}>
          <div
            className={`rounded-xl border border-slate-200 bg-white shadow-sm ${canvasHeightClass}`}
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
              colorMode="light"
              aria-label={`${diagram.title} 아키텍처 다이어그램`}
            >
              {showZoomToolbar && <DiagramZoomToolbar />}
              <Background color="#e2e8f0" gap={24} size={1.5} />
              {showControls && (
                <Controls
                  className="!border-slate-200 !bg-white [&>button]:!border-slate-200 [&>button]:!bg-white [&>button:hover]:!bg-slate-100 [&>button>svg]:!fill-slate-600"
                  showInteractive={false}
                  aria-label={ARIA_LABEL_CONFIG['controls.ariaLabel']}
                />
              )}
              {showMiniMap && (
                <MiniMap
                  className="!border-slate-200 !bg-white"
                  nodeColor={(node) => {
                    const data = node.data as CustomNodeData;
                    if (data?.nodeType === 'highlight')
                      return 'rgba(234, 179, 8, 0.7)';
                    if (data?.nodeType === 'primary')
                      return 'rgba(99, 102, 241, 0.5)';
                    return 'rgba(148, 163, 184, 0.4)';
                  }}
                  maskColor="rgba(241, 245, 249, 0.75)"
                  aria-label={ARIA_LABEL_CONFIG['minimap.ariaLabel']}
                />
              )}
              <AutoFitView />
            </ReactFlow>
          </div>
        </DiagramErrorBoundary>

        {/* 범례 */}
        {showLegend && (
          <div className="flex flex-wrap justify-center gap-3 border-t border-slate-200 pt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded bg-linear-to-br from-yellow-400/60 to-amber-400/60 ring-1 ring-yellow-500/40" />
              <span className="text-2xs text-slate-500">핵심</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded bg-indigo-100 ring-1 ring-indigo-300/60" />
              <span className="text-2xs text-slate-500">주요</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded bg-slate-100 ring-1 ring-slate-300/60" />
              <span className="text-2xs text-slate-500">보조</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-4 border-t border-dashed border-purple-400/70" />
              <span className="text-2xs text-slate-500">검증</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-4 border-t border-slate-400/60" />
              <span className="text-2xs text-slate-500">데이터</span>
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}

export default memo(ReactFlowDiagram);

// Re-export types for external use
export type { CustomNodeData, ReactFlowDiagramProps } from './types';
