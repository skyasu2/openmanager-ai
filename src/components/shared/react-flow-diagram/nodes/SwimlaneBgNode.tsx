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
        <div className="absolute inset-0 rounded-xl border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]" />
        <div
          className={`absolute inset-0 rounded-xl bg-linear-to-br ${data.color} opacity-[0.045]`}
        />
        <div
          className={`absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-linear-to-b ${data.color} opacity-70`}
        />

        {/* 왼쪽 라벨 영역 배경 (Unified Sidebar Style) */}
        <div
          className="absolute top-0 bottom-0 rounded-l-xl border-r border-slate-200 bg-slate-50/90 backdrop-blur-sm"
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
