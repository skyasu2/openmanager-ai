# ReactFlowDiagram.tsx 분리 작업 계획서

**작성일**: 2026-01-22
**대상 파일**: `src/components/shared/ReactFlowDiagram.tsx`
**현재 줄 수**: 996줄
**목표**: 200줄 이하 (메인 컴포넌트)

---

## 1. 현황 분석

### 1.1 파일 구조 (996줄)

```
ReactFlowDiagram.tsx
├── [1-43] Imports & Constants
│   ├── FIT_VIEW_OPTIONS (상수)
│   └── DEFAULT_VIEWPORT (상수)
│
├── [44-114] AutoFitView (함수 컴포넌트)
│   └── useReactFlow 훅 사용, fitView 로직
│
├── [115-139] Types
│   ├── ReactFlowDiagramProps
│   ├── CustomNodeData
│   └── SwimlaneBgData (370-375)
│
├── [140-209] DiagramErrorBoundary (클래스 컴포넌트)
│   └── React Error Boundary 패턴
│
├── [210-252] Constants (스타일)
│   ├── NODE_WIDTH, NODE_HEIGHT
│   ├── LABEL_AREA_WIDTH, etc.
│   └── NODE_STYLES (객체)
│
├── [253-341] CustomNode (memo 컴포넌트)
│   └── Tooltip + Handle + 스타일링
│
├── [343-364] LayerLabelNode (memo 컴포넌트)
│
├── [366-401] SwimlaneBgNode (memo 컴포넌트)
│
├── [403-587] Layout Functions
│   ├── getLayoutedElements (레이어 우선 알고리즘)
│   └── fallbackDagreLayout (Dagre 폴백)
│
├── [589-841] convertToReactFlow (변환 함수)
│   └── 데이터 → React Flow 노드/엣지 변환
│
└── [843-996] Main Component
    ├── nodeTypes 정의
    ├── ariaLabelConfig
    └── ReactFlowDiagram (메인)
```

### 1.2 문제점

| 문제 | 설명 |
|------|------|
| 단일 파일 비대화 | 996줄, 7개+ 컴포넌트/함수 |
| 관심사 미분리 | 레이아웃, 노드, 변환 로직 혼재 |
| 재사용성 저하 | 개별 컴포넌트 재사용 불가 |
| 테스트 어려움 | 단위 테스트 작성 복잡 |

---

## 2. 목표 구조

```
src/components/shared/react-flow-diagram/
├── index.tsx                    # 메인 컴포넌트 (~150줄)
├── types.ts                     # 타입 정의 (~50줄)
├── constants.ts                 # 상수/스타일 (~60줄)
│
├── nodes/
│   ├── index.ts                 # re-export
│   ├── CustomNode.tsx           # 메인 노드 (~90줄)
│   ├── LayerLabelNode.tsx       # 라벨 노드 (~30줄)
│   └── SwimlaneBgNode.tsx       # 배경 노드 (~40줄)
│
├── layout/
│   ├── index.ts                 # re-export
│   ├── layer-layout.ts          # getLayoutedElements (~140줄)
│   └── dagre-fallback.ts        # fallbackDagreLayout (~50줄)
│
├── utils/
│   ├── index.ts                 # re-export
│   └── converter.ts             # convertToReactFlow (~250줄)
│
└── components/
    ├── index.ts                 # re-export
    ├── AutoFitView.tsx          # fitView 로직 (~50줄)
    └── DiagramErrorBoundary.tsx # Error Boundary (~70줄)
```

---

## 3. 분리 상세 계획

### 3.1 Phase 1: 디렉토리 생성 + 타입/상수 분리

**파일**: `types.ts`
```typescript
// src/components/shared/react-flow-diagram/types.ts
import type { Node } from '@xyflow/react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.data';

export interface ReactFlowDiagramProps {
  diagram: ArchitectureDiagram;
  compact?: boolean;
  showControls?: boolean;
  showMiniMap?: boolean;
}

export interface CustomNodeData extends Record<string, unknown> {
  label: string;
  sublabel?: string;
  icon?: string;
  nodeType: 'primary' | 'secondary' | 'tertiary' | 'highlight';
  layerColor: string;
  layerTitle: string;
}

export interface SwimlaneBgData extends Record<string, unknown> {
  width: number;
  height: number;
  color: string;
  title: string;
}
```

**파일**: `constants.ts`
```typescript
// src/components/shared/react-flow-diagram/constants.ts
export const FIT_VIEW_OPTIONS = { ... };
export const DEFAULT_VIEWPORT = { ... };
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 52;
export const LABEL_AREA_WIDTH = 160;
// ... 기타 상수

export const NODE_STYLES: Record<...> = { ... };
```

### 3.2 Phase 2: 노드 컴포넌트 분리

**파일**: `nodes/CustomNode.tsx`
```typescript
'use client';
import { memo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { CustomNodeData } from '../types';
import { NODE_STYLES } from '../constants';

export const CustomNode = memo(({ data }: NodeProps<Node<CustomNodeData>>) => {
  // 현재 로직 그대로 이동
});

CustomNode.displayName = 'CustomNode';
```

**파일**: `nodes/LayerLabelNode.tsx`, `nodes/SwimlaneBgNode.tsx`
- 동일한 패턴으로 분리

### 3.3 Phase 3: 레이아웃 함수 분리

**파일**: `layout/layer-layout.ts`
```typescript
import Dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { NODE_WIDTH, NODE_HEIGHT } from '../constants';
import { fallbackDagreLayout } from './dagre-fallback';

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: { ... }
): { nodes: Node[]; edges: Edge[] } {
  // 현재 로직 그대로 이동
}
```

### 3.4 Phase 4: 변환 유틸리티 분리

**파일**: `utils/converter.ts`
```typescript
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.data';
import { getLayoutedElements } from '../layout';
import { NODE_WIDTH, ... } from '../constants';

export function convertToReactFlow(diagram: ArchitectureDiagram): {
  nodes: Node[];
  edges: Edge[];
} {
  // 현재 로직 그대로 이동
}
```

### 3.5 Phase 5: 보조 컴포넌트 분리

**파일**: `components/AutoFitView.tsx`
**파일**: `components/DiagramErrorBoundary.tsx`

### 3.6 Phase 6: 메인 컴포넌트 재구성

**파일**: `index.tsx`
```typescript
'use client';
import { memo, useMemo, useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ReactFlowDiagramProps, CustomNodeData } from './types';
import { FIT_VIEW_OPTIONS, DEFAULT_VIEWPORT } from './constants';
import { CustomNode, LayerLabelNode, SwimlaneBgNode } from './nodes';
import { convertToReactFlow } from './utils/converter';
import { AutoFitView, DiagramErrorBoundary } from './components';

const nodeTypes = {
  customNode: CustomNode,
  layerLabel: LayerLabelNode,
  swimlaneBg: SwimlaneBgNode,
};

// ... 간결해진 메인 컴포넌트
export default memo(ReactFlowDiagram);
```

---

## 4. 기존 import 호환성

**기존 사용처 (변경 없음)**:
```typescript
// Before & After 동일
import ReactFlowDiagram from '@/components/shared/ReactFlowDiagram';
// 또는
import ReactFlowDiagram from '@/components/shared/react-flow-diagram';
```

**호환성 유지 방법**:
```typescript
// src/components/shared/ReactFlowDiagram.tsx (래퍼)
export { default } from './react-flow-diagram';
export * from './react-flow-diagram/types';
```

---

## 5. 체크리스트

### Phase 1: 준비
- [ ] `react-flow-diagram/` 디렉토리 생성
- [ ] `types.ts` 생성 및 타입 이동
- [ ] `constants.ts` 생성 및 상수 이동

### Phase 2: 노드 분리
- [ ] `nodes/CustomNode.tsx` 생성
- [ ] `nodes/LayerLabelNode.tsx` 생성
- [ ] `nodes/SwimlaneBgNode.tsx` 생성
- [ ] `nodes/index.ts` re-export 생성

### Phase 3: 레이아웃 분리
- [ ] `layout/layer-layout.ts` 생성
- [ ] `layout/dagre-fallback.ts` 생성
- [ ] `layout/index.ts` re-export 생성

### Phase 4: 유틸리티 분리
- [ ] `utils/converter.ts` 생성
- [ ] `utils/index.ts` re-export 생성

### Phase 5: 보조 컴포넌트 분리
- [ ] `components/AutoFitView.tsx` 생성
- [ ] `components/DiagramErrorBoundary.tsx` 생성
- [ ] `components/index.ts` re-export 생성

### Phase 6: 메인 컴포넌트
- [ ] `index.tsx` 생성 (간결화된 버전)
- [ ] 기존 `ReactFlowDiagram.tsx` → 래퍼로 변환

### Phase 7: 검증
- [ ] TypeScript 타입 검사 통과
- [ ] Biome lint 통과
- [ ] 빌드 성공
- [ ] 다이어그램 렌더링 정상 확인

---

## 6. 예상 결과

| 파일 | Before | After |
|------|:------:|:-----:|
| 메인 컴포넌트 | 996줄 | ~150줄 |
| 총 파일 수 | 1개 | 12개 |
| 단위 테스트 가능 | ❌ | ✅ |
| 재사용 가능 | ❌ | ✅ |

---

## 7. 리스크

| 리스크 | 영향도 | 대응 |
|--------|:------:|------|
| Import 경로 변경 | 낮음 | 래퍼 파일로 호환성 유지 |
| React Flow 버전 의존 | 낮음 | 버전 고정 유지 |
| 순환 의존성 | 중간 | 단방향 의존 구조 설계 |

---

**작성 완료**: 2026-01-22
