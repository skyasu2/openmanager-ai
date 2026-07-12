'use client';

/**
 * CustomNode Component
 * @description React Flow 커스텀 노드 컴포넌트 (메인 노드)
 */

import * as Tooltip from '@radix-ui/react-tooltip';
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';

import { NODE_STYLES, STATUS_STYLES } from '../constants';
import type { CustomNodeData } from '../types';

const NODE_TYPE_LABELS: Record<CustomNodeData['nodeType'], string> = {
  primary: '주요',
  secondary: '보조',
  tertiary: '일반',
  highlight: '핵심',
};

const SERVER_STATUS_LABELS: Record<
  NonNullable<CustomNodeData['status']>,
  string
> = {
  online: '온라인',
  warning: '경고',
  critical: '위험',
  offline: '오프라인',
  maintenance: '점검 중',
  unknown: '확인 필요',
};

export const CustomNode = memo(({ data }: NodeProps<Node<CustomNodeData>>) => {
  const styles = NODE_STYLES[data.nodeType];
  const statusStyle = data.status ? STATUS_STYLES[data.status] : null;
  const nodeTypeLabel = NODE_TYPE_LABELS[data.nodeType];
  const serverData = data.serverData;
  const isStatusMode = data.displayMode === 'status';
  const isInteractive = Boolean(serverData && data.onServerSelect);

  const nodeBody = (
    <div
      className={`group relative min-h-[78px] overflow-hidden rounded-xl border px-3 pt-3 pb-2.5 transition-all duration-200 ${
        isInteractive
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100'
          : ''
      } ${data.isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''} ${
        data.isRelated ? 'ring-1 ring-indigo-300' : ''
      } ${data.isDimmed ? 'opacity-35 grayscale' : ''} ${styles.bg} ${statusStyle?.border || styles.border} ${statusStyle?.glow || styles.shadow}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${styles.accent}`}
      />
      <div className="flex min-w-0 items-start gap-2.5">
        {data.icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-base transition-transform duration-200 group-hover:scale-105 ${styles.iconBg}`}
            aria-hidden="true"
          >
            {data.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <div className="line-clamp-2 text-[13px] leading-snug font-bold text-slate-800 transition-colors group-hover:text-indigo-700">
                {data.label}
              </div>
              {data.sublabel && (
                <div className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-slate-500 transition-colors group-hover:text-slate-600">
                  {data.sublabel}
                </div>
              )}
            </div>
            {data.status && (
              <div
                className={`mt-1 h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_currentColor] ${
                  data.status === 'warning' || data.status === 'critical'
                    ? 'animate-pulse motion-reduce:animate-none'
                    : ''
                } ${statusStyle?.dot}`}
              />
            )}
          </div>
          {isStatusMode && data.serverData ? (
            <dl className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-100 pt-1.5 text-center">
              {[
                { label: 'CPU', value: data.serverData.cpu },
                { label: 'MEM', value: data.serverData.memory },
                { label: 'DISK', value: data.serverData.disk },
              ].map((metric) => (
                <div key={metric.label} className="min-w-0">
                  <dt className="text-[8px] font-medium text-slate-600">
                    {metric.label}
                  </dt>
                  <dd className="truncate text-[10px] font-semibold text-slate-700">
                    {metric.value}%
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span
                className={`max-w-[5rem] truncate rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${styles.badge}`}
              >
                {nodeTypeLabel}
              </span>
              <span className="truncate text-[9px] font-medium text-slate-400">
                {data.layerTitle}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div className="relative w-[208px]">
          {/* 입력 핸들 (상단) */}
          <Handle
            type="target"
            position={Position.Top}
            className={`!h-1.5 !w-1.5 !border !border-indigo-300 !bg-white ${isStatusMode ? '!opacity-0' : ''}`}
          />

          {/* 노드 본체 */}
          {isInteractive && serverData ? (
            <button
              type="button"
              className="nodrag block w-full rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              aria-label={`${data.label} 영향 경로 보기`}
              aria-pressed={data.isSelected}
              onClick={() => data.onServerSelect?.(serverData)}
            >
              {nodeBody}
            </button>
          ) : (
            nodeBody
          )}

          {/* 출력 핸들 (하단) */}
          <Handle
            type="source"
            position={Position.Bottom}
            className={`!h-1.5 !w-1.5 !border !border-indigo-300 !bg-white ${isStatusMode ? '!opacity-0' : ''}`}
          />

          {/* 좌우 핸들 (수평 연결용) */}
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            className={`!h-1.5 !w-1.5 !border !border-indigo-300 !bg-white ${isStatusMode ? '!opacity-0' : ''}`}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className={`!h-1.5 !w-1.5 !border !border-indigo-300 !bg-white ${isStatusMode ? '!opacity-0' : ''}`}
          />
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-[100] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xl shadow-slate-200/70"
          sideOffset={8}
          side="top"
        >
          <div className="max-w-tooltip space-y-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {data.icon && <span className="text-base">{data.icon}</span>}
                <span className="font-semibold text-slate-900">
                  {data.label}
                </span>
              </div>
              {data.status && (
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${statusStyle?.dot}`}
                  />
                  <span
                    className={`text-[10px] font-bold tracking-wider uppercase ${statusStyle?.text}`}
                  >
                    {SERVER_STATUS_LABELS[data.status]}
                  </span>
                </div>
              )}
            </div>
            {data.sublabel && (
              <p className="text-xs leading-relaxed text-slate-600">
                {data.sublabel}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-100 pt-1.5">
              <span className="text-2xs text-slate-400">Layer:</span>
              <span className="text-2xs text-slate-600">{data.layerTitle}</span>
            </div>
            {data.serverData && (
              <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">CPU</span>
                  <span className="font-medium text-slate-700">
                    {data.serverData.cpu}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MEM</span>
                  <span className="font-medium text-slate-700">
                    {data.serverData.memory}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">DISK</span>
                  <span className="font-medium text-slate-700">
                    {data.serverData.disk}%
                  </span>
                </div>
              </div>
            )}
          </div>
          <Tooltip.Arrow className="fill-white" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});

CustomNode.displayName = 'CustomNode';
