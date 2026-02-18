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

const TOPOLOGY_DIAGRAM = ARCHITECTURE_DIAGRAMS[
  'infrastructure-topology'
] as ArchitectureDiagram;

const TOTAL_NODES = TOPOLOGY_DIAGRAM.layers.reduce(
  (sum, layer) => sum + layer.nodes.length,
  0
);
const TOTAL_EDGES = TOPOLOGY_DIAGRAM.connections?.length ?? 0;
const TOTAL_LAYERS = TOPOLOGY_DIAGRAM.layers.length;

export function TopologyModal({ open, onClose, servers }: TopologyModalProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsLoaded(false);
      return;
    }
    const timer = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-label="인프라 토폴로지 맵"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
        >
          <div className="relative flex h-[94vh] w-[96vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/50 px-6 py-2.5 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
                  <Maximize2 size={16} />
                </div>
                <div>
                  <DialogPrimitive.Title className="text-lg font-bold text-white tracking-tight">
                    온프레미스 DC1 서비스 토폴로지
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-[11px] text-slate-400">
                    15대 서버 계층 구조와 의존성 흐름
                  </DialogPrimitive.Description>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[10px] text-sky-300">
                  단일 사이트: OnPrem-DC1
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-300">
                  synthetic 메트릭 모델
                </div>
                <DialogPrimitive.Close
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-rose-500/20 hover:text-rose-400 cursor-pointer"
                  aria-label="닫기"
                >
                  <X size={20} />
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* Compact note strip */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-slate-900/20 px-6 py-1.5 text-[10px] text-slate-400">
              <span>현실 반영: 계층 분리, DB 복제, 백업 경로</span>
              <span className="hidden sm:inline">
                상태 표시는 5초 주기로 갱신
              </span>
            </div>

            {/* Content */}
            <div className="relative flex-1 bg-slate-950">
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
            <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/50 px-6 py-3">
              <div className="text-xs text-slate-500">
                데이터 소스:{' '}
                <span className="font-mono text-slate-400">
                  Synthetic Prometheus → Derived OpenTelemetry
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <div className="h-1 w-1 rounded-full bg-blue-400" />
                  {TOTAL_LAYERS} Layers
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <div className="h-1 w-1 rounded-full bg-cyan-400" />
                  {TOTAL_NODES} Nodes
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <div className="h-1 w-1 rounded-full bg-purple-400" />
                  {TOTAL_EDGES} Edges
                </span>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
