'use client';

import { GitCompare, Layout, Network } from 'lucide-react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';

type FeatureCardDiagramSummaryProps = {
  diagram: ArchitectureDiagram;
};

const getDiagramStats = (diagram: ArchitectureDiagram) => {
  const layerCount = diagram.layers.length;
  const nodeCount = diagram.layers.reduce(
    (total, layer) => total + layer.nodes.length,
    0
  );
  const connectionCount = diagram.connections?.length ?? 0;

  return { layerCount, nodeCount, connectionCount };
};

export function FeatureCardDiagramSummary({
  diagram,
}: FeatureCardDiagramSummaryProps) {
  const { layerCount, nodeCount, connectionCount } = getDiagramStats(diagram);

  const stats = [
    { label: '레이어', value: layerCount, Icon: Layout },
    { label: '노드', value: nodeCount, Icon: Network },
    { label: '연결', value: connectionCount, Icon: GitCompare },
  ];

  return (
    <section
      aria-label="다이어그램 요약"
      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 sm:px-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-cyan-200">
            아키텍처 다이어그램
          </p>
          <h3 className="mt-1 text-sm font-semibold leading-snug text-white sm:text-base">
            {diagram.title}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            {diagram.description}
          </p>
        </div>

        <dl className="grid shrink-0 grid-cols-3 gap-2">
          {stats.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="min-w-[4.75rem] rounded-lg border border-white/10 bg-slate-950/35 px-2.5 py-2 text-center"
            >
              <dt className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
