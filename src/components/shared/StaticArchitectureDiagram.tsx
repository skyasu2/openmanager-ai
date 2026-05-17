'use client';

import { useMemo } from 'react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';

// ─── Layout constants ────────────────────────────────────────────────────────
const NH = 72; // node height (fixed)
const HG = 12; // horizontal gap between nodes
const VG = 38; // vertical gap between layer rows
const LW = 106; // layer label column width
const LPT = 26; // layer top padding (space for label text above nodes)
const CP = 14; // canvas outer padding

// Node-internal positions (relative to node top-left)
const ICON_CX = 14;
const ICON_CY = 20;
const ICON_FS = 14;
const TEXT_X_ICON = 32; // label x when icon present
const TEXT_X_NO_ICON = 9;
const LABEL_CY = 20;
const LABEL_FS = 11;
const SUB_CY = 35;
const SUB_FS = 9;
const SEP_Y = 48;
const BADGE_CY = 60;
const BADGE_H = 14;
const BADGE_W = 36;
const BADGE_X = 7;

// ─── Tailwind color map ───────────────────────────────────────────────────────
const TW: Record<string, string> = {
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'indigo-500': '#6366f1',
  'purple-600': '#9333ea',
  'purple-500': '#a855f7',
  'pink-500': '#ec4899',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  'violet-500': '#8b5cf6',
  'green-500': '#22c55e',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  'cyan-500': '#06b6d4',
  'teal-600': '#0d9488',
  'red-500': '#ef4444',
  'rose-500': '#f43f5e',
  'yellow-500': '#eab308',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
};

function twc(name: string): string {
  return TW[name] ?? '#6366f1';
}

function parseLayerColors(cls: string): [string, string] {
  const f = cls.match(/from-([a-z]+-\d+)/)?.[1] ?? 'indigo-500';
  const t = cls.match(/to-([a-z]+-\d+)/)?.[1] ?? 'purple-600';
  return [twc(f), twc(t)];
}

// ─── Types ────────────────────────────────────────────────────────────────────
type NR = {
  id: string;
  x: number;
  y: number;
  cx: number; // center-x
  li: number; // layer index
  fc: string;
  tc: string;
};

type Band = {
  y: number;
  h: number;
  fc: string;
  tc: string;
  title: string;
  li: number;
};

// ─── Dynamic NW calculation ───────────────────────────────────────────────────
function calcNW(maxNodes: number): number {
  if (maxNodes <= 2) return 200;
  if (maxNodes <= 3) return 178;
  if (maxNodes <= 4) return 152;
  if (maxNodes <= 5) return 126;
  return 110; // 6+
}

// ─── Layout computation ───────────────────────────────────────────────────────
function computeLayout(diagram: ArchitectureDiagram) {
  const maxNodes = Math.max(...diagram.layers.map((l) => l.nodes.length));
  const NW = calcNW(maxNodes);
  const contentW = maxNodes * NW + Math.max(0, maxNodes - 1) * HG;
  const vw = CP + LW + contentW + CP;

  const nrMap = new Map<string, NR>();
  const bands: Band[] = [];
  let curY = CP;

  for (let li = 0; li < diagram.layers.length; li++) {
    const layer = diagram.layers[li];
    if (!layer) continue;
    const [fc, tc] = parseLayerColors(layer.color);
    const nc = layer.nodes.length;
    const nodesW = nc * NW + Math.max(0, nc - 1) * HG;
    const bandH = LPT + NH;
    // Center nodes within layer if fewer than maxNodes
    const startX = CP + LW + Math.floor((contentW - nodesW) / 2);

    bands.push({ y: curY, h: bandH, fc, tc, title: layer.title, li });

    for (let ni = 0; ni < nc; ni++) {
      const node = layer.nodes[ni];
      if (!node) continue;
      const x = startX + ni * (NW + HG);
      const y = curY + LPT;
      nrMap.set(node.id, {
        id: node.id,
        x,
        y,
        cx: x + NW / 2,
        li,
        fc,
        tc,
      });
    }
    curY += bandH + VG;
  }

  const vh = curY - VG + CP;
  return { vw, vh, nrMap, bands, NW };
}

// ─── Bezier path computation ──────────────────────────────────────────────────
function connPath(
  from: NR,
  to: NR,
  _NW: number,
  vw: number
): { d: string; mx: number; my: number } {
  const sx = from.cx;
  const sy = from.y + NH; // source exits bottom
  const tx = to.cx;
  const ty = to.y; // target enters top

  // Same layer → U-curve below the swimlane
  if (from.li === to.li) {
    const offY = sy + 22;
    return {
      d: `M${sx},${sy} C${sx},${offY} ${tx},${offY} ${tx},${ty}`,
      mx: (sx + tx) / 2,
      my: offY + 4,
    };
  }

  // Normal downward → smooth cubic bezier
  if (sy < ty - 4) {
    const dy = ty - sy;
    const c1y = sy + dy * 0.44;
    const c2y = ty - dy * 0.44;
    return {
      d: `M${sx},${sy} C${sx},${c1y} ${tx},${c2y} ${tx},${ty}`,
      mx: (sx + tx) / 2,
      my: (sy + ty) / 2,
    };
  }

  // Upward → route via right edge of canvas
  const rightX = vw - CP + 8;
  const midY = (sy + ty) / 2;
  return {
    d: `M${sx},${sy} C${sx},${sy + 28} ${rightX},${midY - 10} ${rightX},${midY} C${rightX},${midY + 10} ${tx},${ty - 28} ${tx},${ty}`,
    mx: rightX - 10,
    my: midY,
  };
}

// ─── Node type styles ─────────────────────────────────────────────────────────
const NODE_BG: Record<string, string> = {
  highlight: 'rgba(255,255,255,0.11)',
  primary: 'rgba(255,255,255,0.065)',
  secondary: 'rgba(255,255,255,0.040)',
  tertiary: 'rgba(255,255,255,0.022)',
};
const NODE_BORDER: Record<string, string> = {
  highlight: 'rgba(255,255,255,0.26)',
  primary: 'rgba(255,255,255,0.15)',
  secondary: 'rgba(255,255,255,0.09)',
  tertiary: 'rgba(255,255,255,0.06)',
};
const TYPE_LABEL: Record<string, string> = {
  highlight: '핵심',
  primary: '주요',
  secondary: '보조',
  tertiary: '일반',
};

// ─── Component ────────────────────────────────────────────────────────────────
type Props = { diagram: ArchitectureDiagram; className?: string };

export function StaticArchitectureDiagram({ diagram, className }: Props) {
  const { vw, vh, nrMap, bands, NW } = useMemo(
    () => computeLayout(diagram),
    [diagram]
  );

  return (
    <div
      className={`w-full overflow-auto rounded-xl ${className ?? ''}`}
      style={{ maxHeight: 'calc(80dvh - 80px)' }}
    >
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        width={vw}
        height={vh}
        className="block select-none"
        style={{ minWidth: Math.min(vw, 480) }}
        role="img"
        aria-label={`${diagram.title} 아키텍처 다이어그램`}
      >
        <defs>
          {/* Grid */}
          <pattern
            id="sad-grid"
            width="36"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M36 0L0 0 0 36"
              fill="none"
              stroke="rgba(148,163,184,0.042)"
              strokeWidth="0.6"
            />
          </pattern>

          {/* Blur filter for node shadow */}
          <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow
              dx="1"
              dy="2"
              stdDeviation="4"
              floodColor="rgba(0,0,0,0.6)"
            />
          </filter>

          {/* Arrow markers */}
          <marker
            id="arr-s"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,1.5 L8.5,5 L0,8.5z" fill="rgba(255,255,255,0.4)" />
          </marker>
          <marker
            id="arr-d"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,1.5 L8.5,5 L0,8.5z" fill="rgba(167,139,250,0.75)" />
          </marker>

          {/* Layer gradient definitions */}
          {bands.map(({ li, fc, tc }) => (
            <linearGradient
              key={`lg-${li}`}
              id={`lg-${li}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor={fc} />
              <stop offset="100%" stopColor={tc} />
            </linearGradient>
          ))}

          {/* Node top-accent gradient (per layer, vertical) */}
          {bands.map(({ li, fc, tc }) => (
            <linearGradient
              key={`na-${li}`}
              id={`na-${li}`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor={fc} stopOpacity="0.9" />
              <stop offset="100%" stopColor={tc} stopOpacity="0.7" />
            </linearGradient>
          ))}
        </defs>

        {/* ── Canvas background ── */}
        <rect width={vw} height={vh} fill="#060c17" rx="12" />
        <rect width={vw} height={vh} fill="url(#sad-grid)" rx="12" />

        {/* ── Layer swimlanes ── */}
        {bands.map(({ y, h, fc, li, title }) => (
          <g key={`band-${li}`}>
            {/* Band background */}
            <rect
              x={CP}
              y={y}
              width={vw - CP * 2}
              height={h}
              rx={7}
              fill={fc}
              fillOpacity="0.052"
              stroke={fc}
              strokeOpacity="0.16"
              strokeWidth="0.8"
            />
            {/* Left accent bar */}
            <rect
              x={CP}
              y={y}
              width={4}
              height={h}
              rx={2}
              fill={`url(#lg-${li})`}
            />
            {/* Layer label */}
            <text
              x={CP + 10}
              y={y + h / 2 + 1}
              fontSize={10}
              fontWeight="600"
              fill={fc}
              fillOpacity="0.88"
              fontFamily="system-ui,-apple-system,sans-serif"
              dominantBaseline="middle"
            >
              {title.length > 12 ? `${title.slice(0, 11)}…` : title}
            </text>
          </g>
        ))}

        {/* ── Connections (under nodes) ── */}
        {(diagram.connections ?? []).map((conn, i) => {
          const from = nrMap.get(conn.from);
          const to = nrMap.get(conn.to);
          if (!from || !to) return null;

          const { d, mx, my } = connPath(from, to, NW, vw);
          const isDash = conn.type === 'dashed';
          const stroke = isDash
            ? 'rgba(167,139,250,0.52)'
            : 'rgba(255,255,255,0.22)';
          const marker = isDash ? 'url(#arr-d)' : 'url(#arr-s)';
          const lbl = conn.label;
          const lblW = lbl
            ? Math.max(24, Math.min(50, lbl.length * 5.2 + 10))
            : 0;

          return (
            <g key={`c-${i}`}>
              <path
                d={d}
                stroke={stroke}
                strokeWidth={isDash ? 1.1 : 1.35}
                fill="none"
                strokeDasharray={isDash ? '5,4' : undefined}
                markerEnd={marker}
                opacity="0.88"
              />
              {lbl && (
                <g>
                  <rect
                    x={mx - lblW / 2}
                    y={my - 8}
                    width={lblW}
                    height={15}
                    rx={4}
                    fill="rgba(4,8,16,0.88)"
                    stroke={
                      isDash
                        ? 'rgba(167,139,250,0.28)'
                        : 'rgba(255,255,255,0.10)'
                    }
                    strokeWidth="0.6"
                  />
                  <text
                    x={mx}
                    y={my + 0.5}
                    fontSize={8}
                    fontWeight="500"
                    fill={
                      isDash
                        ? 'rgba(196,181,253,0.95)'
                        : 'rgba(255,255,255,0.72)'
                    }
                    fontFamily="system-ui,-apple-system,sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {lbl.length > 8 ? `${lbl.slice(0, 7)}…` : lbl}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Nodes (over connections) ── */}
        {diagram.layers.flatMap((layer, li) =>
          layer.nodes.map((node) => {
            const nr = nrMap.get(node.id);
            if (!nr) return null;
            const hasIcon = Boolean(node.icon);
            const textX = nr.x + (hasIcon ? TEXT_X_ICON : TEXT_X_NO_ICON);
            const typeKey = node.type as keyof typeof NODE_BG;

            return (
              <g key={node.id} filter="url(#node-shadow)">
                {/* Node body */}
                <rect
                  x={nr.x}
                  y={nr.y}
                  width={NW}
                  height={NH}
                  rx={7}
                  fill={NODE_BG[typeKey]}
                  stroke={NODE_BORDER[typeKey]}
                  strokeWidth="0.9"
                />
                {/* Top accent gradient line */}
                <rect
                  x={nr.x + 1}
                  y={nr.y}
                  width={NW - 2}
                  height={3}
                  rx={2}
                  fill={`url(#na-${li})`}
                  opacity={node.type === 'highlight' ? 1 : 0.55}
                />
                {/* Icon */}
                {hasIcon && (
                  <text
                    x={nr.x + ICON_CX}
                    y={nr.y + ICON_CY}
                    fontSize={ICON_FS}
                    dominantBaseline="middle"
                    textAnchor="middle"
                  >
                    {node.icon}
                  </text>
                )}
                {/* Label */}
                <text
                  x={textX}
                  y={nr.y + LABEL_CY}
                  fontSize={LABEL_FS}
                  fontWeight="600"
                  fill="rgba(255,255,255,0.93)"
                  fontFamily="system-ui,-apple-system,sans-serif"
                  dominantBaseline="middle"
                >
                  {node.label.length > 16
                    ? `${node.label.slice(0, 15)}…`
                    : node.label}
                </text>
                {/* Sublabel */}
                {node.sublabel && (
                  <text
                    x={textX}
                    y={nr.y + SUB_CY}
                    fontSize={SUB_FS}
                    fill="rgba(255,255,255,0.42)"
                    fontFamily="system-ui,-apple-system,sans-serif"
                    dominantBaseline="middle"
                  >
                    {node.sublabel.length > 22
                      ? `${node.sublabel.slice(0, 21)}…`
                      : node.sublabel}
                  </text>
                )}
                {/* Separator */}
                <line
                  x1={nr.x + 8}
                  y1={nr.y + SEP_Y}
                  x2={nr.x + NW - 8}
                  y2={nr.y + SEP_Y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="0.7"
                />
                {/* Type badge */}
                <rect
                  x={nr.x + BADGE_X}
                  y={nr.y + BADGE_CY - BADGE_H / 2}
                  width={BADGE_W}
                  height={BADGE_H}
                  rx={4}
                  fill="rgba(255,255,255,0.045)"
                  stroke={nr.fc}
                  strokeOpacity="0.3"
                  strokeWidth="0.5"
                />
                <text
                  x={nr.x + BADGE_X + BADGE_W / 2}
                  y={nr.y + BADGE_CY + 0.5}
                  fontSize={8}
                  fontWeight="600"
                  fill={nr.fc}
                  fillOpacity="0.88"
                  fontFamily="system-ui,-apple-system,sans-serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {TYPE_LABEL[node.type]}
                </text>
              </g>
            );
          })
        )}
      </svg>

      {/* ── Legend ── */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-3 pb-1">
        {[
          { type: 'line-solid', label: '일반 연결' },
          { type: 'line-dashed', label: '위임/참조 연결' },
          { type: 'highlight', label: '핵심' },
          { type: 'primary', label: '주요' },
          { type: 'secondary', label: '보조' },
        ].map((item) => (
          <div key={item.type} className="flex items-center gap-1.5">
            {item.type === 'line-solid' && (
              <div className="h-px w-5 bg-white/35" />
            )}
            {item.type === 'line-dashed' && (
              <div className="h-px w-5 border-t border-dashed border-violet-400/70" />
            )}
            {item.type === 'highlight' && (
              <div className="h-2.5 w-3.5 rounded-sm bg-white/20 ring-[0.5px] ring-white/30" />
            )}
            {item.type === 'primary' && (
              <div className="h-2.5 w-3.5 rounded-sm bg-white/10 ring-[0.5px] ring-white/18" />
            )}
            {item.type === 'secondary' && (
              <div className="h-2.5 w-3.5 rounded-sm bg-white/[0.06] ring-[0.5px] ring-white/10" />
            )}
            <span className="text-[10px] text-white/38">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
