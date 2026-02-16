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
          <div className="relative flex h-[92vh] w-[96vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/50 px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
                  <Maximize2 size={20} />
                </div>
                <div>
                  <DialogPrimitive.Title className="text-xl font-bold text-white tracking-tight">
                    온프레미스 DC1 서비스 토폴로지
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-slate-400">
                    15대 서버 계층 구조와 의존성 흐름
                  </DialogPrimitive.Description>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-300">
                  단일 사이트: OnPrem-DC1
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-300">
                  synthetic 메트릭 모델
                </div>
                <DialogPrimitive.Close
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-500/20 hover:text-rose-400 cursor-pointer"
                  aria-label="닫기"
                >
                  <X size={22} />
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* Legend (Status) */}
            <div className="flex flex-wrap items-center gap-6 border-b border-white/5 bg-slate-900/30 px-6 py-2 text-[11px] font-medium tracking-wider">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-emerald-400/80">정상</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                <span className="text-amber-400/80">주의</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse" />
                <span className="text-rose-400/80">위험</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-slate-500" />
                <span className="text-slate-500">오프라인</span>
              </div>
              <div className="ml-auto flex items-center gap-4 text-slate-500 font-normal italic">
                <span>* 상태 표시는 5초 주기로 갱신됩니다</span>
              </div>
            </div>

            {/* Model notes */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-slate-900/20 px-6 py-2 text-[11px]">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                현실성: 계층 분리 + DB 복제 + 백업 경로 반영
              </span>
              <span className="rounded-full border border-slate-400/20 bg-slate-500/10 px-2 py-0.5 text-slate-300">
                단순화: 방화벽/WAF/서비스메시/운영툴 체인 생략
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
