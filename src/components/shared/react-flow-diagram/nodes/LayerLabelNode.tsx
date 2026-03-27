'use client';

/**
 * LayerLabelNode Component
 * @description Swimlane 라벨 노드 컴포넌트
 */

import type { Node, NodeProps } from '@xyflow/react';
import { memo } from 'react';

import type { LayerLabelData } from '../types';

export const LayerLabelNode = memo(
  ({ data }: NodeProps<Node<LayerLabelData>>) => {
    return (
      <div className="group flex h-full w-full flex-col justify-center pr-4 text-right transition-opacity">
        <div className="relative z-10" title={data.title}>
          <span className="block truncate text-xs font-bold leading-tight text-white/90 transition-colors group-hover:text-white">
            {data.title}
          </span>
          <div
            className={`ml-auto mt-1 h-0.5 w-6 rounded-full opacity-80 transition-all duration-200 group-hover:w-10 group-hover:opacity-100 bg-linear-to-r ${data.color}`}
          />
        </div>
      </div>
    );
  }
);

LayerLabelNode.displayName = 'LayerLabelNode';
