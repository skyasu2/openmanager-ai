'use client';

import type {
  ArchitectureDiagram,
  DiagramNode,
} from '@/data/architecture-diagrams.types';
import {
  type ArchitectureHop,
  buildArchitectureHops,
} from '@/data/architecture-diagrams.utils';

const TYPE_STYLES: Record<DiagramNode['type'], string> = {
  highlight:
    'border-cyan-300/35 bg-cyan-400/[0.10] shadow-[0_10px_30px_rgba(34,211,238,0.08)]',
  primary: 'border-indigo-300/25 bg-indigo-400/[0.08]',
  secondary: 'border-white/12 bg-white/[0.055]',
  tertiary: 'border-white/[0.08] bg-white/[0.025]',
};

const TYPE_LABELS: Record<DiagramNode['type'], string> = {
  highlight: '핵심',
  primary: '주요',
  secondary: '보조',
  tertiary: '일반',
};

type Props = { diagram: ArchitectureDiagram; className?: string };

function hopsOnLane(
  hops: ArchitectureHop[],
  fromLayerIndex: number,
  toLayerIndex: number
) {
  return hops.filter(
    (hop) =>
      hop.fromLayerIndex === fromLayerIndex && hop.toLayerIndex === toLayerIndex
  );
}

function hopsSkippingInto(hops: ArchitectureHop[], layerIndex: number) {
  return hops.filter(
    (hop) =>
      hop.toLayerIndex === layerIndex && hop.fromLayerIndex < layerIndex - 1
  );
}

function hopsInsideLayer(hops: ArchitectureHop[], layerIndex: number) {
  return hopsOnLane(hops, layerIndex, layerIndex);
}

function hopsReturning(hops: ArchitectureHop[]) {
  return hops.filter((hop) => hop.toLayerIndex < hop.fromLayerIndex);
}

function HopList({
  hops,
  caption,
}: {
  hops: ArchitectureHop[];
  caption?: string;
}) {
  if (hops.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {caption ? (
        <p className="text-center text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
          {caption}
        </p>
      ) : null}
      {hops.map((hop) => (
        <HopRow key={`${hop.from.id}-${hop.toLayerIndex}`} hop={hop} />
      ))}
    </div>
  );
}

function HopRow({ hop }: { hop: ArchitectureHop }) {
  const dashed =
    hop.targets.length > 0 &&
    hop.targets.every((target) => target.type === 'dashed');

  return (
    <p
      data-testid="architecture-hop"
      data-hop-type={dashed ? 'dashed' : 'solid'}
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
        dashed
          ? 'border-dashed border-white/12 bg-white/[0.02] text-slate-300'
          : 'border-cyan-300/15 bg-cyan-400/[0.05] text-slate-200'
      }`}
    >
      <span className="font-medium text-slate-100">{hop.from.label}</span>
      <span
        className={dashed ? 'text-slate-500' : 'text-cyan-200/80'}
        aria-hidden="true"
      >
        {dashed ? '⋯' : '↓'}
      </span>
      <span className="min-w-0 text-center">
        {hop.targets.map((target, index) => (
          <span key={target.node.id}>
            {index > 0 ? <span className="text-slate-500"> · </span> : null}
            <span className="font-medium text-slate-100">
              {target.node.label}
            </span>
            {target.label ? (
              <span className="ml-1 text-[10px] text-cyan-200/70">
                {target.label}
              </span>
            ) : null}
          </span>
        ))}
      </span>
    </p>
  );
}

export function StaticArchitectureDiagram({ diagram, className }: Props) {
  const hops = buildArchitectureHops(diagram.layers, diagram.connections);
  const returning = hopsReturning(hops);

  return (
    <section
      className={`overflow-hidden rounded-xl border border-white/[0.08] bg-[#050b14] ${className ?? ''}`}
      data-testid="static-architecture-diagram"
      aria-label={`${diagram.title} 아키텍처 흐름`}
    >
      <div
        className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-b border-white/[0.07] px-3 py-2 text-[10px] text-slate-400 sm:px-4"
        role="note"
        aria-label="연결선 범례"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-px w-6 bg-cyan-200/70" aria-hidden="true" />
          직접 흐름
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="w-6 border-t border-dashed border-slate-500"
            aria-hidden="true"
          />
          선택·보조 흐름
        </span>
      </div>
      <ol className="space-y-3 p-3 sm:p-4" data-testid="architecture-flow">
        {diagram.layers.map((layer, layerIndex) => {
          const incoming = [
            ...hopsOnLane(hops, layerIndex - 1, layerIndex),
            ...hopsSkippingInto(hops, layerIndex),
          ];
          const intra = hopsInsideLayer(hops, layerIndex);

          return (
            <li key={`${layer.title}-${layerIndex}`}>
              {layerIndex > 0 ? (
                incoming.length > 0 ? (
                  <div className="mb-3">
                    <HopList hops={incoming} />
                  </div>
                ) : (
                  <div
                    className="flex h-8 items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="text-sm text-cyan-200/55">↓</span>
                  </div>
                )
              ) : null}
              <section className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 sm:p-4">
                <header className="mb-3 flex items-center gap-3">
                  <span
                    className={`flex h-7 min-w-7 items-center justify-center rounded-full bg-linear-to-br text-xs font-bold text-white ${layer.color}`}
                  >
                    {layerIndex + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                      Layer {String(layerIndex + 1).padStart(2, '0')}
                    </p>
                    <h4 className="truncate text-sm font-semibold text-white sm:text-base">
                      {layer.title}
                    </h4>
                  </div>
                </header>

                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {layer.nodes.map((node) => (
                    <li
                      key={node.id}
                      data-node-id={node.id}
                      className={`min-w-0 rounded-lg border p-3 ${TYPE_STYLES[node.type]}`}
                    >
                      <div className="flex items-start gap-2.5">
                        {node.icon ? (
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/20 text-base"
                            aria-hidden="true"
                          >
                            {node.icon}
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="break-words text-sm font-semibold text-slate-100">
                              {node.label}
                            </span>
                            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">
                              {TYPE_LABELS[node.type]}
                            </span>
                          </div>
                          {node.sublabel ? (
                            <p className="mt-1 break-words text-xs leading-relaxed text-slate-400">
                              {node.sublabel}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {intra.length > 0 ? (
                  <div className="mt-3">
                    <HopList hops={intra} caption="레이어 내부" />
                  </div>
                ) : null}
              </section>
            </li>
          );
        })}
      </ol>

      {returning.length > 0 ? (
        <section
          className="border-t border-white/[0.07] bg-slate-950/50 p-3 sm:p-4"
          aria-label="복귀 흐름"
        >
          <HopList hops={returning} caption="복귀" />
        </section>
      ) : null}
    </section>
  );
}
