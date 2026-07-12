'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Maximize2,
  Network,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactFlowDisplayMode } from '@/components/shared/react-flow-diagram';
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
  initialMode?: ReactFlowDisplayMode;
  initialFilter?: TopologyFilterId;
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

const INFRASTRUCTURE_MAP_MODES = [
  {
    id: 'status',
    label: '문제 경로',
    description: '장애 노드와 1-hop 영향 관계',
    icon: Activity,
  },
  {
    id: 'dependencies',
    label: '전체 의존성',
    description: '전체 계층과 구성 연결 흐름',
    icon: Network,
  },
] as const satisfies ReadonlyArray<{
  id: ReactFlowDisplayMode;
  label: string;
  description: string;
  icon: typeof Activity;
}>;

const TOPOLOGY_FILTERS = [
  { id: 'all', label: '전체', prefixes: [] },
  { id: 'lb', label: 'LB', prefixes: ['lb-'] },
  { id: 'web', label: 'Web', prefixes: ['web-'] },
  { id: 'api', label: 'API', prefixes: ['api-'] },
  { id: 'db', label: 'DB', prefixes: ['db-'] },
  { id: 'cache', label: 'Cache', prefixes: ['cache-'] },
  { id: 'storage', label: 'Storage', prefixes: ['storage-'] },
] as const;

export type TopologyFilterId = (typeof TOPOLOGY_FILTERS)[number]['id'];

const TOPOLOGY_NODE_BY_ID = new Map(
  TOPOLOGY_DIAGRAM.layers.flatMap((layer) =>
    layer.nodes.map((node) => [node.id, node] as const)
  )
);

const PROBLEM_STATUS_LABELS: Record<Server['status'], string> = {
  online: '정상',
  critical: '위험',
  offline: '오프라인',
  warning: '경고',
  maintenance: '점검 중',
  unknown: '확인 필요',
};

const PROBLEM_STATUS_PRIORITY: Partial<Record<Server['status'], number>> = {
  critical: 0,
  offline: 0,
  warning: 1,
  maintenance: 2,
  unknown: 3,
};

export function normalizeTopologyFilterId(
  value: string | null | undefined
): TopologyFilterId {
  return TOPOLOGY_FILTERS.some((filter) => filter.id === value)
    ? (value as TopologyFilterId)
    : 'all';
}

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

  const focusedNodeIds = new Set(
    diagram.layers.flatMap((layer) =>
      layer.nodes
        .filter((node) => nodeMatchesTopologyFilter(node.id, filterId))
        .map((node) => node.id)
    )
  );
  const visibleNodeIds = new Set(focusedNodeIds);
  for (const connection of diagram.connections ?? []) {
    if (
      focusedNodeIds.has(connection.from) ||
      focusedNodeIds.has(connection.to)
    ) {
      visibleNodeIds.add(connection.from);
      visibleNodeIds.add(connection.to);
    }
  }

  const layers = diagram.layers
    .map((layer) => {
      const nodes = layer.nodes.filter((node) => visibleNodeIds.has(node.id));

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
  initialMode = 'dependencies',
  initialFilter = 'all',
  active = true,
  onClose,
}: TopologyViewProps) {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeFilter, setActiveFilter] =
    useState<TopologyFilterId>(initialFilter);
  const [displayMode, setDisplayMode] =
    useState<ReactFlowDisplayMode>(initialMode);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const filteredDiagram = useMemo(
    () => filterTopologyDiagram(TOPOLOGY_DIAGRAM, activeFilter),
    [activeFilter]
  );
  const displayDiagram = filteredDiagram;
  const filteredNodeCount = filteredDiagram.layers.reduce(
    (sum, layer) => sum + layer.nodes.length,
    0
  );
  const filteredEdgeCount = displayDiagram.connections?.length ?? 0;
  const activeFilterLabel =
    activeFilter === 'all'
      ? getTopologyFilter(activeFilter).label
      : `${getTopologyFilter(activeFilter).label} + 1-hop`;
  const activeMode =
    INFRASTRUCTURE_MAP_MODES.find((mode) => mode.id === displayMode) ??
    INFRASTRUCTURE_MAP_MODES[1];
  const visibleNodeIds = useMemo(
    () =>
      new Set(
        filteredDiagram.layers.flatMap((layer) =>
          layer.nodes.map((node) => node.id)
        )
      ),
    [filteredDiagram]
  );
  const visibleServers = useMemo(
    () => servers.filter((server) => visibleNodeIds.has(server.id)),
    [servers, visibleNodeIds]
  );
  const statusCounts = useMemo(() => {
    return {
      online: visibleServers.filter((server) => server.status === 'online')
        .length,
      warning: visibleServers.filter((server) => server.status === 'warning')
        .length,
      critical: visibleServers.filter((server) => server.status === 'critical')
        .length,
      attention: visibleServers.filter((server) =>
        ['offline', 'maintenance', 'unknown'].includes(server.status)
      ).length,
    };
  }, [visibleServers]);
  const problemServers = useMemo(
    () =>
      visibleServers
        .filter((server) => server.status !== 'online')
        .sort((left, right) => {
          const priorityDifference =
            (PROBLEM_STATUS_PRIORITY[left.status] ?? 4) -
            (PROBLEM_STATUS_PRIORITY[right.status] ?? 4);
          if (priorityDifference !== 0) return priorityDifference;

          return (
            Math.max(right.cpu ?? 0, right.memory ?? 0, right.disk ?? 0) -
            Math.max(left.cpu ?? 0, left.memory ?? 0, left.disk ?? 0)
          );
        }),
    [visibleServers]
  );
  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId) ?? null,
    [selectedServerId, servers]
  );
  const selectedRelations = useMemo(() => {
    if (!selectedServerId) {
      return { upstream: [], downstream: [] };
    }

    const connections = filteredDiagram.connections ?? [];
    return {
      upstream: connections
        .filter((connection) => connection.to === selectedServerId)
        .flatMap((connection) => {
          const node = TOPOLOGY_NODE_BY_ID.get(connection.from);
          return node ? [node] : [];
        }),
      downstream: connections
        .filter((connection) => connection.from === selectedServerId)
        .flatMap((connection) => {
          const node = TOPOLOGY_NODE_BY_ID.get(connection.to);
          return node ? [node] : [];
        }),
    };
  }, [filteredDiagram.connections, selectedServerId]);

  const handleServerSelect = useCallback((server: Server) => {
    setSelectedServerId(server.id);
  }, []);
  const handleOpenSelectedServer = useCallback(() => {
    if (!selectedServer) return;
    router.push(`/dashboard/servers/${encodeURIComponent(selectedServer.id)}`);
  }, [router, selectedServer]);
  const handleDisplayModeChange = useCallback(
    (mode: ReactFlowDisplayMode) => {
      setDisplayMode(mode);
      window.history.replaceState(
        null,
        '',
        `/dashboard/topology?mode=${mode}&filter=${activeFilter}`
      );
    },
    [activeFilter]
  );
  const handleFilterChange = useCallback(
    (filter: TopologyFilterId) => {
      setActiveFilter(filter);
      setSelectedServerId(null);
      window.history.replaceState(
        null,
        '',
        `/dashboard/topology?mode=${displayMode}&filter=${filter}`
      );
    },
    [displayMode]
  );

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
            <h2 className="truncate text-lg font-bold tracking-tight text-gray-900">
              통합 인프라 맵
            </h2>
            <p className="text-[11px] text-gray-500">
              문제 서버의 upstream/downstream 영향 경로를 한 캔버스에서 확인
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

      {/* Infrastructure summary */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 bg-slate-50/80 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-indigo-700 uppercase">
            {activeMode.label}
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            {displayMode === 'status'
              ? '현재 장애 노드와 직접 연결된 1-hop 경로를 강조합니다. 정상 경로는 흐리게 표시합니다.'
              : TOPOLOGY_DIAGRAM.description}
          </p>
        </div>
        <dl
          className={`grid shrink-0 gap-2 ${
            displayMode === 'status' ? 'grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {(displayMode === 'status'
            ? [
                { label: '온라인', value: statusCounts.online },
                { label: '경고', value: statusCounts.warning },
                { label: '위험', value: statusCounts.critical },
                { label: '확인 필요', value: statusCounts.attention },
              ]
            : [
                { label: 'Layers', value: TOTAL_LAYERS },
                { label: 'Nodes', value: TOTAL_NODES },
                { label: 'Edges', value: TOTAL_EDGES },
              ]
          ).map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center shadow-xs"
            >
              <dt className="text-[10px] font-medium text-slate-600">
                {item.label}
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {displayMode === 'status' && problemServers.length > 0 && (
        <section
          className="flex shrink-0 flex-col gap-2 border-b border-amber-200 bg-amber-50/80 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
          aria-label="현재 문제 서버"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                문제 서버 {problemServers.length}대
              </p>
              <p className="text-xs text-amber-800">
                서버를 선택하면 직접 연결된 upstream/downstream 경로만
                강조합니다.
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {problemServers.slice(0, 3).map((server) => (
              <button
                key={server.id}
                type="button"
                onClick={() => setSelectedServerId(server.id)}
                aria-label={`${server.id} 영향 경로 보기`}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-left text-xs text-slate-700 shadow-xs transition-colors hover:border-amber-400 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span className="font-mono font-semibold text-slate-900">
                  {server.id}
                </span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                  {PROBLEM_STATUS_LABELS[server.status] ?? server.status}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Infrastructure map controls */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
        <fieldset className="inline-flex w-full rounded-md border border-slate-200 bg-slate-50 p-1 sm:w-auto">
          <legend className="sr-only">인프라 맵 표시 모드</legend>
          {INFRASTRUCTURE_MAP_MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = displayMode === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleDisplayModeChange(mode.id)}
                aria-pressed={isActive}
                className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium transition-colors sm:flex-none ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
                title={mode.description}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {mode.label}
              </button>
            );
          })}
        </fieldset>

        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
          <fieldset className="flex min-w-0 flex-wrap items-center gap-1.5">
            <legend className="sr-only">인프라 맵 서버 타입 필터</legend>
            {TOPOLOGY_FILTERS.map((filter) => {
              const isActive = activeFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => handleFilterChange(filter.id)}
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
      </div>

      {selectedServer && (
        <section
          className="grid shrink-0 gap-3 border-b border-indigo-200 bg-indigo-50/70 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center"
          aria-label="선택 서버 영향 관계"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-950">
                {selectedServer.id}
              </span>
              <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                {PROBLEM_STATUS_LABELS[selectedServer.status] ??
                  selectedServer.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-indigo-800">
              CPU {selectedServer.cpu ?? '-'}% · MEM{' '}
              {selectedServer.memory ?? '-'}% · DISK{' '}
              {selectedServer.disk ?? '-'}%
            </p>
            <p className="mt-1 text-[10px] text-indigo-600">
              구성 토폴로지 기반 잠재 영향 경로이며 실제 네트워크 장애 확정값은
              아닙니다.
            </p>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-700 uppercase">
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              Upstream
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {selectedRelations.upstream.length > 0 ? (
                selectedRelations.upstream.map((node) => (
                  <span
                    key={node.id}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                  >
                    {node.label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-600">직접 연결 없음</span>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-700 uppercase">
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              Downstream
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {selectedRelations.downstream.length > 0 ? (
                selectedRelations.downstream.map((node) => (
                  <span
                    key={node.id}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                  >
                    {node.label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-600">직접 연결 없음</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 lg:justify-end">
            <button
              type="button"
              onClick={handleOpenSelectedServer}
              aria-label={`${selectedServer.id} 서버 상세 열기`}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              상세 보기
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedServerId(null)}
              aria-label="영향 경로 선택 해제"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-700 transition-colors hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

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
                <p className="animate-pulse text-sm text-slate-500">
                  인프라 맵 로딩 중...
                </p>
              </div>
            </div>
          }
        >
          {isLoaded && (
            <ReactFlowDiagramDynamic
              key={`${displayMode}-${activeFilter}-${selectedServerId ?? 'none'}`}
              diagram={displayDiagram}
              compact={false}
              showControls={false}
              showMiniMap={true}
              showHeader={false}
              showLegend={false}
              showZoomToolbar={true}
              maximizeViewport={true}
              servers={servers}
              displayMode={displayMode}
              onServerSelect={handleServerSelect}
              selectedServerId={selectedServerId}
            />
          )}
        </Suspense>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
        <div className="text-xs text-gray-500">
          데이터 소스:{' '}
          <span className="font-mono text-gray-700">
            topology catalog dependencies · OpenTelemetry metrics
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
            {filteredEdgeCount} Edges
          </span>
        </div>
      </div>
    </div>
  );
}
