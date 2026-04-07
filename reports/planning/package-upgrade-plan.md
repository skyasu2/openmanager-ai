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

### Step 1: 안전한 패치 업그레이드
- [ ] `@supabase/supabase-js`, `@supabase/ssr`, `@opentelemetry/sdk-node`, `ai`, `rollup`, `@types/node` 업그레이드
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm run test:quick`
- [ ] 필요 시 `npm run test:contract`

### Step 2: Storybook minor 업그레이드
- [ ] `npx storybook@latest upgrade`
- [ ] Storybook 관련 설정/스토리 회귀 확인
- [ ] `npm run type-check`
- [ ] `npm run lint`

### Step 3: Knip v6 전환
- [ ] `npm install -D knip@latest`
- [ ] `npm run knip:ci`
- [ ] parser 전환에 따른 config/false positive 점검

### Step 4: TypeScript 6 준비 및 업그레이드
- [ ] `tsconfig.json`에 `types: ["node"]` 선행 추가
- [ ] `npm install -D typescript@latest`
- [ ] `npm run type-check`
- [ ] `npm run test:quick`
- [ ] 필요 시에만 `npx @andrewbranch/ts5to6`

### Step 5: `cloud-run/ai-engine` 별도 업그레이드 트랙
- [ ] `cloud-run/ai-engine/package.json` 기준 현재 버전 현황 재확인
- [ ] `typescript`, `@types/node`, `@supabase/supabase-js`, `ai`를 root app과 분리해서 업그레이드
- [ ] `cd cloud-run/ai-engine && npm run type-check`
- [ ] `cd cloud-run/ai-engine && npm run test`

## 4. 리스크 메모 (Risk Notes)
- **TypeScript 6**: 기본값 변경이 많아 가장 마지막 단계로 미룬다.
- **root app vs ai-engine 분리**: 루트 앱과 `cloud-run/ai-engine`은 버전과 tsconfig가 다르므로 동일 단계로 묶지 않는다.
- **Knip 6**: parser 교체로 false positive/negative 양상이 바뀔 수 있다.
- **Storybook**: minor라도 builder/addon 호환성 회귀가 있을 수 있어 별도 단계로 분리한다.
- **Supabase 패키지군**: peer dependency 호환성은 우선 패치 업그레이드 범위에서 확인한다.

## 5. 현재 상태
- **상태**: Backlog
- **담당**: AI Agent
- **실행 시점**: 현재 Phase 2 타입 시스템 정제 종료 후
