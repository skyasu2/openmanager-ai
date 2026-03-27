'use client';

/**
 * SwimlaneBgNode Component
 * @description Swimlane 배경 노드 컴포넌트
 */

import type { Node, NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { LABEL_AREA_WIDTH, SWIMLANE_PADDING } from '../constants';
import type { SwimlaneBgData } from '../types';

export const SwimlaneBgNode = memo(
  ({ data }: NodeProps<Node<SwimlaneBgData>>) => {
    return (
      <div
        className="pointer-events-none relative rounded-xl"
        style={{
          width: data.width,
          height: data.height,
        }}
      >
        {/* Swimlane 배경 */}
        <div className="absolute inset-0 rounded-xl border border-white/5 bg-white/[0.03]" />

        {/* 왼쪽 라벨 영역 배경 (Unified Sidebar Style) */}
        <div
          className="absolute top-0 bottom-0 rounded-l-xl border-r border-white/10 bg-slate-900/40 backdrop-blur-sm"
          style={{
            left: SWIMLANE_PADDING,
            width: LABEL_AREA_WIDTH,
          }}
        />
      </div>
    );
  }
);

SwimlaneBgNode.displayName = 'SwimlaneBgNode';
