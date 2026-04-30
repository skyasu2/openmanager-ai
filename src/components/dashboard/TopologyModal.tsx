'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Maximize2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
import {
  ARCHITECTURE_DIAGRAMS,
  type ArchitectureDiagram,
} from '@/data/architecture-diagrams.data';
import type { Server } from '@/types/server';

const ReactFlowDiagramDynamic = dynamic(
  () => import('@/components/shared/react-flow-diagram'),
  { ssr: false }
);

interface TopologyModalProps {
  open: boolean;
  onClose: () => void;
  servers: Server[];
}

interface TopologyViewProps {
  servers: Server[];
  active?: boolean;
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

export function TopologyView({ servers, active = true }: TopologyViewProps) {
  const [isLoaded, setIsLoaded] = useState(false);

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
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] text-sky-700">
            단일 사이트: OnPrem-DC1
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] text-amber-700">
            synthetic 메트릭 모델
          </div>
        </div>
      </div>

      {/* Compact note strip */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-[10px] text-gray-500 sm:px-6">
        <span>현실 반영: 계층 분리, DB 복제, 백업 경로</span>
        <span className="hidden sm:inline">상태 표시는 5초 주기로 갱신</span>
      </div>

      {/* Content */}
      <div
        className="relative flex-1 bg-slate-950"
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
              diagram={TOPOLOGY_DIAGRAM}
              compact={false}
              showControls={true}
              showMiniMap={true}
              showHeader={false}
              showLegend={false}
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
            Vercel static OTel · 24h rotation
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-gray-500">
            <div className="h-1 w-1 rounded-full bg-blue-400" />
            {TOTAL_LAYERS} Layers
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <div className="h-1 w-1 rounded-full bg-cyan-400" />
            {TOTAL_NODES} Nodes
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <div className="h-1 w-1 rounded-full bg-purple-400" />
            {TOTAL_EDGES} Edges
          </span>
        </div>
      </div>
    </div>
  );
}

export function TopologyModal({ open, onClose, servers }: TopologyModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-label="인프라 토폴로지 맵"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
        >
          <div className="relative h-[94vh] w-[96vw] max-w-7xl">
            <TopologyView servers={servers} active={open} />
            <DialogPrimitive.Close
              className="absolute right-6 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
              aria-label="닫기"
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
