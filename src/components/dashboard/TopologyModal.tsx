'use client';

import { Maximize2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  ARCHITECTURE_DIAGRAMS,
  type ArchitectureDiagram,
} from '@/data/architecture-diagrams.data';
import type { Server } from '@/types/server';

const ReactFlowDiagramDynamic = dynamic(
  () => import('@/components/shared/react-flow-diagram'),
  { ssr: false }
);

interface TopologyViewProps {
  servers: Server[];
  active?: boolean;
  onClose?: () => void;
}

const TOPOLOGY_DIAGRAM = ARCHITECTURE_DIAGRAMS[
  'infrastructure-topology'
] as ArchitectureDiagram;

const TOTAL_NODES = TOPOLOGY_DIAGRAM.layers.reduce(
  (sum, layer) => sum + layer.nodes.length,
  0
);
const TOTAL_EDGES = TOPOLOGY_DIAGRAM.connections?.length ?? 0;
const TOTAL_LAYERS = TOPOLOGY_DIAGRAM.layers.length;

const TOPOLOGY_FILTERS = [
  { id: 'all', label: '전체', prefixes: [] },
  { id: 'lb', label: 'LB', prefixes: ['lb-'] },
  { id: 'web', label: 'Web', prefixes: ['web-'] },
  { id: 'api', label: 'API', prefixes: ['api-'] },
  { id: 'db', label: 'DB', prefixes: ['db-'] },
  { id: 'cache', label: 'Cache', prefixes: ['cache-'] },
  { id: 'storage', label: 'Storage', prefixes: ['storage-'] },
] as const;

type TopologyFilterId = (typeof TOPOLOGY_FILTERS)[number]['id'];

function getTopologyFilter(filterId: TopologyFilterId) {
  return (
    TOPOLOGY_FILTERS.find((filter) => filter.id === filterId) ??
    TOPOLOGY_FILTERS[0]
  );
}

function nodeMatchesTopologyFilter(
  nodeId: string,
  filterId: TopologyFilterId
): boolean {
  const filter = getTopologyFilter(filterId);
  return (
    filter.id === 'all' ||
    filter.prefixes.some((prefix) => nodeId.startsWith(prefix))
  );
}

function filterTopologyDiagram(
  diagram: ArchitectureDiagram,
  filterId: TopologyFilterId
): ArchitectureDiagram {
  if (filterId === 'all') {
    return diagram;
  }

  const visibleNodeIds = new Set<string>();
  const layers = diagram.layers
    .map((layer) => {
      const nodes = layer.nodes.filter((node) => {
        const isVisible = nodeMatchesTopologyFilter(node.id, filterId);
        if (isVisible) {
          visibleNodeIds.add(node.id);
        }
        return isVisible;
      });

      return { ...layer, nodes };
    })
    .filter((layer) => layer.nodes.length > 0);

  const connections = (diagram.connections ?? []).filter(
    (connection) =>
      visibleNodeIds.has(connection.from) && visibleNodeIds.has(connection.to)
  );

  return {
    ...diagram,
    layers,
    connections,
  };
}

export function TopologyView({
  servers,
  active = true,
  onClose,
}: TopologyViewProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TopologyFilterId>('all');

  const filteredDiagram = useMemo(
    () => filterTopologyDiagram(TOPOLOGY_DIAGRAM, activeFilter),
    [activeFilter]
  );
  const filteredNodeCount = filteredDiagram.layers.reduce(
    (sum, layer) => sum + layer.nodes.length,
    0
  );
  const filteredEdgeCount = filteredDiagram.connections?.length ?? 0;
  const activeFilterLabel = getTopologyFilter(activeFilter).label;

  useEffect(() => {
    if (!active) {
      setIsLoaded(false);
      return;
    }
    const timer = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <div
      className="relative flex h-full min-h-[620px] w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100"
      data-testid="topology-modal-shell"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
            <Maximize2 size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-gray-900 tracking-tight">
              온프레미스 DC1 서비스 토폴로지
            </h2>
            <p className="text-[11px] text-gray-500">
              18대 관측 서버 계층 구조와 의존성 흐름
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] text-sky-700 sm:flex">
            단일 사이트: OnPrem-DC1
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] text-amber-700 sm:flex">
            OpenTelemetry metric model
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-rose-50 hover:text-rose-600"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Architecture summary */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 bg-slate-50/80 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Topology Summary
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            {TOPOLOGY_DIAGRAM.description}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2">
          {[
            { label: 'Layers', value: TOTAL_LAYERS },
            { label: 'Nodes', value: TOTAL_NODES },
            { label: 'Edges', value: TOTAL_EDGES },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center shadow-xs"
            >
              <dt className="text-[10px] font-medium text-slate-400">
                {item.label}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Topology controls */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-6">
        <fieldset className="flex min-w-0 flex-wrap items-center gap-1.5">
          <legend className="sr-only">토폴로지 서버 타입 필터</legend>
          {TOPOLOGY_FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                aria-pressed={isActive}
                className={`min-h-8 rounded-md border px-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </fieldset>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
            {activeFilterLabel}
          </span>
          <span>
            {filteredNodeCount} Nodes · {filteredEdgeCount} Edges
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className="relative flex-1 bg-slate-50"
        data-testid="topology-modal-canvas"
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <p className="text-sm text-slate-500 animate-pulse">
                  인프라 맵 로딩 중...
                </p>
              </div>
            </div>
          }
        >
          {isLoaded && (
            <ReactFlowDiagramDynamic
              key={activeFilter}
              diagram={filteredDiagram}
              compact={false}
              showControls={false}
              showMiniMap={true}
              showHeader={false}
              showLegend={false}
              showZoomToolbar={true}
              maximizeViewport={true}
              servers={servers}
            />
          )}
        </Suspense>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
        <div className="text-xs text-gray-500">
          데이터 소스:{' '}
          <span className="font-mono text-gray-700">
            OpenTelemetry metrics · 24h window
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-gray-500">
            <div className="h-1 w-1 rounded-full bg-blue-400" />
            {TOTAL_LAYERS} Layers
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <div className="h-1 w-1 rounded-full bg-cyan-400" />
            {activeFilter === 'all' ? TOTAL_NODES : filteredNodeCount} Nodes
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <div className="h-1 w-1 rounded-full bg-purple-400" />
            {activeFilter === 'all' ? TOTAL_EDGES : filteredEdgeCount} Edges
          </span>
        </div>
      </div>
    </div>
  );
}
