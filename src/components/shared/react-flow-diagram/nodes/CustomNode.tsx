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

export const CustomNode = memo(({ data }: NodeProps<Node<CustomNodeData>>) => {
  const styles = NODE_STYLES[data.nodeType];
  const statusStyle = data.status ? STATUS_STYLES[data.status] : null;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <div className="relative">
          {/* 입력 핸들 (상단) */}
          <Handle
            type="target"
            position={Position.Top}
            className="!h-1.5 !w-1.5 !border !border-white/30 !bg-white/10"
          />

          {/* 노드 본체 (Glassmorphism + Glow Effect) */}
          <div
            className={`group flex min-w-[120px] max-w-[180px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/10 ${styles.bg} ${statusStyle?.border || styles.border} ${statusStyle?.glow || styles.shadow} backdrop-blur-md`}
          >
            {data.icon && (
              <span className="text-base transition-transform duration-300 group-hover:scale-110">
                {data.icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <div className="truncate text-xs font-bold text-gray-100 group-hover:text-white transition-colors">
                  {data.label}
                </div>
                {data.status && (
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_currentColor] animate-pulse ${statusStyle?.dot}`}
                  />
                )}
              </div>
              {data.sublabel && (
                <div className="line-clamp-1 text-[9px] leading-tight text-gray-400 group-hover:text-gray-300 transition-colors">
                  {data.sublabel}
                </div>
              )}
            </div>
          </div>

          {/* 출력 핸들 (하단) */}
          <Handle
            type="source"
            position={Position.Bottom}
            className="!h-1.5 !w-1.5 !border !border-white/30 !bg-white/10"
          />

          {/* 좌우 핸들 (수평 연결용) */}
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            className="!h-1.5 !w-1.5 !border !border-white/30 !bg-white/10"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="!h-1.5 !w-1.5 !border !border-white/30 !bg-white/10"
          />
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="z-[100] rounded-lg border border-white/10 bg-slate-800/95 px-3 py-2 shadow-xl backdrop-blur-sm animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          sideOffset={8}
          side="top"
        >
          <div className="max-w-tooltip space-y-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {data.icon && <span className="text-base">{data.icon}</span>}
                <span className="font-semibold text-white">{data.label}</span>
              </div>
              {data.status && (
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${statusStyle?.dot}`}
                  />
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${statusStyle?.text}`}
                  >
                    {data.status}
                  </span>
                </div>
              )}
            </div>
            {data.sublabel && (
              <p className="text-xs leading-relaxed text-gray-300">
                {data.sublabel}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1.5 border-t border-white/10 pt-1.5">
              <span className="text-2xs text-gray-400">Layer:</span>
              <span className="text-2xs text-gray-300">{data.layerTitle}</span>
            </div>
            {data.serverData && (
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">CPU</span>
                  <span className="text-gray-300 font-medium">
                    {data.serverData.cpu}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">MEM</span>
                  <span className="text-gray-300 font-medium">
                    {data.serverData.memory}%
                  </span>
                </div>
              </div>
            )}
          </div>
          <Tooltip.Arrow className="fill-slate-800/95" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});

CustomNode.displayName = 'CustomNode';
