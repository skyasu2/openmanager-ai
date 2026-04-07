# [작업 계획서] 패키지 기술 부채 업그레이드

## 1. 개요 (Overview)
- **목표**: 현재 안정 상태를 유지하면서 root app과 `cloud-run/ai-engine`에 남은 패키지 기술 부채를 단계적으로 해소한다.
- **입력 근거**: 2026-04-07 사용자 수집 현황 보고서 기준.
- **원칙**:
  - runtime/runtime-contract 영향이 작은 패치 업그레이드부터 처리
  - Storybook, Knip, TypeScript 6은 각각 별도 검증 단계로 분리
  - TypeScript 6은 선행 설정(`tsconfig.json`의 `types: ["node"]`) 없이 바로 올리지 않는다

## 2. 범위 (Scope)
- **root app 즉시 검토 패키지**
  - `@supabase/supabase-js`
  - `@supabase/ssr`
  - `@opentelemetry/sdk-node`
  - `ai`
  - `rollup`
  - `@types/node`
- **root app 별도 단계 패키지**
  - `storybook`, `@storybook/nextjs-vite`, `@storybook/react-vite`, `@storybook/addon-vitest`
  - `knip`
  - `typescript`
- **ai-engine 별도 트랙**
  - `typescript`
  - `@supabase/supabase-js`
  - `ai`
  - `@types/node`
  - 필요 시 `@ai-sdk/*`, `hono`, `zod` 연동 점검

## 3. 단계별 실행 계획 (Steps)

### Step 1: 안전한 패치 업그레이드 (완료)
- [x] `@supabase/supabase-js`, `@supabase/ssr`, `@opentelemetry/sdk-node`, `rollup`, `@types/node` 업그레이드
- [x] `ai` latest 재확인 (`6.0.145`, 추가 업그레이드 없음)
- [x] `npm run type-check`
- [x] `npm run lint`
- [x] `npm run test:quick`
- [x] 필요 시 `npm run test:contract`

### Step 2: Storybook 안정화 및 stable 추적
- [x] npm registry `latest` 재확인 (`storybook`/`@storybook/nextjs-vite`는 현재 `10.2.10`, `10.3.x`는 `next` dist-tag만 존재)
- [x] 모든 story type import를 `@storybook/react-vite` → `@storybook/nextjs-vite`로 정렬
- [x] `AIWorkspace.stories.tsx`, `AIDebugPanel.stories.tsx`에 `tags: ['autodocs']` 적용
- [x] `AIDebugPanel.stories.tsx`의 비표준 `parameters.mockData` 제거 후 deterministic fetch mocking으로 교체
- [ ] `features.experimentalComponentsManifest`의 stable 승격 여부를 다음 stable release에서 재확인
- [x] `npm run type-check`
- [x] `npm run lint`
- [x] `npm run storybook:build`

### Step 3: Knip v6 전환
- [x] `npm install -D knip@latest`
- [x] `knip.json` schema `@5` → `@6` 정렬
- [x] `npm run knip:ci`
- [x] parser 전환에 따른 config/false positive 점검 (`src/types/server/guards.ts`, `api-config` default export, server enum/type alias 재수출 정리)

### Step 4: TypeScript 6 준비 및 업그레이드
- [x] `tsconfig.json`에 `types: ["node"]` 선행 추가
- [x] `npm install -D typescript@latest`
- [x] `npm run type-check`
- [x] `npm run test:quick`
- [x] `downlevelIteration` 제거 + `src/types/css.d.ts` 추가로 TS6 side-effect CSS import 대응
- [x] `npx @andrewbranch/ts5to6`는 불필요하여 미사용

### Step 5: `cloud-run/ai-engine` 별도 업그레이드 트랙
- [x] `cloud-run/ai-engine/package.json` 기준 현재 버전 현황 재확인 (`typescript 5.9.3`, `@supabase/supabase-js 2.47.7`, `ai 6.0.86`, `@types/node 24.10.13`)
- [x] `typescript`, `@types/node`, `@supabase/supabase-js` 업그레이드
- [x] `ai@latest` 시도 후 Vitest resolver incompatibility로 rollback (`6.0.86` 유지)
- [x] `cd cloud-run/ai-engine && npm run type-check`
- [x] `cd cloud-run/ai-engine && npm run test`

## 4. 리스크 메모 (Risk Notes)
- **TypeScript 6**: 기본값 변경이 많아 가장 마지막 단계로 미룬다.
- **root app vs ai-engine 분리**: 루트 앱과 `cloud-run/ai-engine`은 버전과 tsconfig가 다르므로 동일 단계로 묶지 않는다.
- **Knip 6**: parser 교체로 false positive/negative 양상이 바뀔 수 있다.
- **Storybook**: npm `latest`가 아직 `10.2.x`인 상태라, 현재는 버전 bump보다 story hygiene 정리가 우선이다. `10.3.x`는 stable dist-tag로 올라온 뒤 별도 재평가한다.
- **ai-engine의 `ai` 패키지**: `ai@latest`는 현재 Vitest/Vite import resolution과 충돌해 4개 suite가 실패한다. ai-engine은 test runner 대응 전까지 `6.0.86` 유지가 안전하다.
- **Supabase 패키지군**: peer dependency 호환성은 우선 패치 업그레이드 범위에서 확인한다.

## 5. 현재 상태
- **상태**: In Progress (Step 1/3/4 완료, Step 2 hygiene 완료, Step 5 partial 완료)
- **담당**: AI Agent
- **실행 시점**: 현재 진행 중
