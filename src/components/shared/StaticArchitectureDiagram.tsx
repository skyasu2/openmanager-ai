'use client';

import { useMemo } from 'react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';

// ─── Layout constants ────────────────────────────────────────────────────────
const NH = 82; // node height (fixed)
const HG = 14; // horizontal gap between nodes
const VG = 42; // vertical gap between layer rows
const LW = 124; // layer label column width
const LPT = 30; // layer top padding (space for label text above nodes)
const CP = 16; // canvas outer padding

// Node-internal positions (relative to node top-left)
const ICON_BOX = 26;
const ICON_CX = 21;
const ICON_CY = 27;
const ICON_FS = 15;
const TEXT_X_ICON = 42; // label x when icon present
const TEXT_X_NO_ICON = 11;
const LABEL_CY = 25;
const LABEL_FS = 11.5;
const SUB_CY = 42;
const SUB_FS = 9.5;
const SEP_Y = 57;
const BADGE_CY = 70;
const BADGE_H = 14;
const BADGE_W = 40;
const BADGE_X = 9;

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
  if (maxNodes <= 2) return 220;
  if (maxNodes <= 3) return 196;
  if (maxNodes <= 4) return 170;
  if (maxNodes <= 5) return 150;
  return 132; // 6+
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1))}…`;
}

function labelLimit(nodeWidth: number, hasIcon: boolean): number {
  const textWidth = nodeWidth - (hasIcon ? TEXT_X_ICON + 10 : 24);
  return Math.max(9, Math.floor(textWidth / 7.2));
}

function sublabelLimit(nodeWidth: number, hasIcon: boolean): number {
  const textWidth = nodeWidth - (hasIcon ? TEXT_X_ICON + 10 : 24);
  return Math.max(13, Math.floor(textWidth / 5.8));
}

// ─── Layout computation ───────────────────────────────────────────────────────
function computeLayout(diagram: ArchitectureDiagram) {
  const maxNodes = Math.max(1, ...diagram.layers.map((l) => l.nodes.length));
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
      className={`w-full overflow-x-auto rounded-xl border border-white/[0.08] bg-[#050b14] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.07] [&::-webkit-scrollbar-thumb:hover]:bg-white/[0.13] ${className ?? ''}`}
      data-testid="static-architecture-diagram"
    >
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        width="100%"
        height="auto"
        className="block select-none"
        style={{ aspectRatio: `${vw} / ${vh}`, minWidth: Math.min(vw, 520) }}
        data-testid="static-architecture-diagram-canvas"
        role="img"
        aria-label={`${diagram.title} 아키텍처 다이어그램`}
      >
        <defs>
          <linearGradient id="sad-canvas-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0b1727" />
            <stop offset="48%" stopColor="#07111f" />
            <stop offset="100%" stopColor="#050811" />
          </linearGradient>

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
              stroke="rgba(148,163,184,0.05)"
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
          <filter id="band-shadow" x="-4%" y="-12%" width="108%" height="132%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="9"
              floodColor="rgba(0,0,0,0.34)"
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
        <rect width={vw} height={vh} fill="url(#sad-canvas-fill)" rx="14" />
        <rect width={vw} height={vh} fill="url(#sad-grid)" rx="14" />
        <rect
          x="0.5"
          y="0.5"
          width={vw - 1}
          height={vh - 1}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          rx="13.5"
        />

        {/* ── Layer swimlanes ── */}
        {bands.map(({ y, h, fc, tc, li, title }) => (
          <g key={`band-${li}`} filter="url(#band-shadow)">
            {/* Band background */}
            <rect
              x={CP}
              y={y}
              width={vw - CP * 2}
              height={h}
              rx={10}
              fill={fc}
              fillOpacity="0.055"
              stroke={fc}
              strokeOpacity="0.18"
              strokeWidth="0.9"
            />
            <rect
              x={CP + 1}
              y={y + 1}
              width={vw - CP * 2 - 2}
              height={h - 2}
              rx={9}
              fill="rgba(255,255,255,0.018)"
            />
            {/* Left accent bar */}
            <rect
              x={CP}
              y={y}
              width={5}
              height={h}
              rx={2.5}
              fill={`url(#lg-${li})`}
            />
            <rect
              x={CP + 12}
              y={y + 12}
              width={LW - 28}
              height={h - 24}
              rx={8}
              fill="rgba(0,0,0,0.14)"
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="0.6"
            />
            {/* Layer label */}
            <text
              x={CP + 26}
              y={y + h / 2 - 11}
              fontSize={7.5}
              fontWeight="700"
              fill={tc}
              fillOpacity="0.62"
              fontFamily="system-ui,-apple-system,sans-serif"
              letterSpacing="1.4"
              dominantBaseline="middle"
            >
              {`LAYER ${String(li + 1).padStart(2, '0')}`}
            </text>
            <text
              x={CP + 26}
              y={y + h / 2 + 8}
              fontSize={11}
              fontWeight="700"
              fill={fc}
              fillOpacity="0.95"
              fontFamily="system-ui,-apple-system,sans-serif"
              dominantBaseline="middle"
            >
              {truncateText(title, 14)}
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
            ? 'rgba(196,181,253,0.72)'
            : 'rgba(203,213,225,0.38)';
          const marker = isDash ? 'url(#arr-d)' : 'url(#arr-s)';
          const lbl = conn.label;
          const lblW = lbl
            ? Math.max(32, Math.min(82, lbl.length * 5.6 + 14))
            : 0;

          return (
            <g key={`c-${i}`}>
              <path
                d={d}
                stroke="rgba(0,0,0,0.42)"
                strokeWidth={isDash ? 3.1 : 3.35}
                fill="none"
                strokeDasharray={isDash ? '5,4' : undefined}
                opacity="0.6"
              />
              <path
                d={d}
                stroke={stroke}
                strokeWidth={isDash ? 1.25 : 1.55}
                fill="none"
                strokeDasharray={isDash ? '5,4' : undefined}
                markerEnd={marker}
                opacity="0.92"
              />
              {lbl && (
                <g>
                  <rect
                    x={mx - lblW / 2}
                    y={my - 8}
                    width={lblW}
                    height={16}
                    rx={5}
                    fill="rgba(5,11,22,0.92)"
                    stroke={
                      isDash
                        ? 'rgba(196,181,253,0.34)'
                        : 'rgba(255,255,255,0.12)'
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
                    {truncateText(lbl, 12)}
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
            const labelMax = labelLimit(NW, hasIcon);
            const sublabelMax = sublabelLimit(NW, hasIcon);

            return (
              <g key={node.id} filter="url(#node-shadow)">
                <title>
                  {node.sublabel
                    ? `${node.label} - ${node.sublabel}`
                    : node.label}
                </title>
                {/* Node body */}
                <rect
                  x={nr.x}
                  y={nr.y}
                  width={NW}
                  height={NH}
                  rx={9}
                  fill={NODE_BG[typeKey]}
                  stroke={NODE_BORDER[typeKey]}
                  strokeWidth={node.type === 'highlight' ? 1.1 : 0.9}
                />
                <rect
                  x={nr.x + 1}
                  y={nr.y + 1}
                  width={NW - 2}
                  height={NH - 2}
                  rx={8}
                  fill="rgba(255,255,255,0.022)"
                />
                {/* Top accent gradient line */}
                <rect
                  x={nr.x + 1}
                  y={nr.y}
                  width={NW - 2}
                  height={4}
                  rx={2}
                  fill={`url(#na-${li})`}
                  opacity={node.type === 'highlight' ? 1 : 0.55}
                />
                {/* Icon */}
                {hasIcon && (
                  <g>
                    <rect
                      x={nr.x + 8}
                      y={nr.y + 14}
                      width={ICON_BOX}
                      height={ICON_BOX}
                      rx={7}
                      fill={nr.fc}
                      fillOpacity="0.13"
                      stroke={nr.tc}
                      strokeOpacity="0.22"
                      strokeWidth="0.7"
                    />
                    <text
                      x={nr.x + ICON_CX}
                      y={nr.y + ICON_CY}
                      fontSize={ICON_FS}
                      dominantBaseline="middle"
                      textAnchor="middle"
                    >
                      {node.icon}
                    </text>
                  </g>
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
                  {truncateText(node.label, labelMax)}
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
                    {truncateText(node.sublabel, sublabelMax)}
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
                  rx={5}
                  fill={nr.fc}
                  fillOpacity="0.08"
                  stroke={nr.fc}
                  strokeOpacity="0.34"
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
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/[0.07] bg-slate-950/45 px-3 py-2.5">
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
            <span className="text-[10px] font-medium text-white/45">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
