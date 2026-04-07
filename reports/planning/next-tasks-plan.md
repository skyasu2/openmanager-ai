> Owner: AI Agent
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-04-07

# [작업 계획서] 다음 작업 목록 (2026-04-07)

## 배경

v8.10.10 이후 31개 커밋 누적. 패키지 업그레이드(TypeScript 6, Knip v6, Storybook hygiene, ai-engine 후속 정렬)와 UI/Storybook 후속 정리를 완료했다.
이제 다음 사이클의 중심은 `v8.11.0` 이후 residual 정리와 build hygiene backlog 축소다.

---

## Task 1: ai-engine `ai` 패키지 업그레이드 호환성 조사

**상태**: 완료

**우선순위**: P2 | **예상 규모**: 소 (조사 + 설정 수정)

### 현황

| 항목 | 값 |
|------|-----|
| ai-engine 기존 | `ai@6.0.86` |
| root app 현재 | `ai@6.0.145` |
| npm latest | `ai@6.0.149` |
| 실제 결과 | `ai@6.0.145` 상향 후 테스트/타입체크 통과 |

초기 가설과 달리, 현재 저장소 상태에서는 `ai@6.0.145` 상향 후 별도 Vitest alias 없이도 정상 동작했다.
`exports` 필드 비교 결과도 `6.0.86`과 `6.0.145` 사이에 본질적 차이가 없었다.

### 확인 결과

1. `exports` 필드 차이 없음
2. `npm run verify:rag` 통과
3. `npm run type-check` 통과
4. `npm run test` 통과 (`69 files / 726 tests`)

### 완료 기준

- `cd cloud-run/ai-engine && npm run test` 통과 상태에서 `ai` 버전을 `6.0.145`로 상향 완료
- 타입체크 통과 완료

---

## Task 2: Storybook circular chunk warning 정리

**상태**: 완료

**우선순위**: P3 | **예상 규모**: 소 (설정 수정)

### 현황

기존에는 `npm run storybook:build` 시 다음 경고가 남아있었다:
```
vendor-react -> vendor-storybook (circular chunk)
vendor-react -> vendor-charts (circular chunk)
```

### 원인 분석

`.storybook/main.ts`의 `manualChunks` 분리 전략에서 발생:
- `vendor-react`: react, react-dom
- `vendor-storybook`: @storybook/* 패키지 (react에 의존)
- `vendor-charts`: recharts, d3-* (react에 의존)

Rollup의 `manualChunks`는 chunk 간 순환을 감지하면 경고를 낸다. react를 소비하는 패키지(`storybook`, `recharts`)가 별도 chunk로 분리됐지만, react 자체의 일부 internals가 renderer를 참조하는 경우 역방향 의존성이 생긴다.

### 적용 결과

1. **`vendor-react` chunk 제거 적용**
   ```ts
   // 아래 조건 제거
   if (id.includes('/react/') || id.includes('/react-dom/'))
     return 'vendor-react';
   ```
   → `vendor-storybook`과 `vendor-charts`가 Rollup 자동 패킹으로 정리되며 circular warning 제거.

2. **Residual**
   - 현재는 circular warning 0건
   - large chunk warning(`vite-inject-mocker-entry.js`)만 잔존
   - 기능 blocker는 아니므로 backlog로 이동

### 완료 기준

- `npm run storybook:build` 시 circular chunk warning 0건 달성
- 빌드 결과물 정상 확인 완료

---

## Task 3: minor release — v8.11.0

**상태**: 완료

**우선순위**: P2 | **예상 규모**: 소 (릴리스 스크립트 실행)

### 현황

v8.10.10 이후 31개 커밋 누적. 기준선(30커밋) 충족.

**포함 내용** (주요 사항):
- TypeScript 6.0.2 업그레이드 (root + ai-engine)
- Knip v6 전환 + dead export 정리
- Storybook story import 통일 + hygiene 정리
- 패치 패키지 업그레이드 (Supabase, OTel, rollup 등)
- 타입 시스템 SSOT 정렬 (server-common 제거, EnhancedServerModal 통합)
- typecheck-changed 인프라 개선

### 완료 기준

```bash
npm run validate:all          # type-check + lint + test 통과
npm run release:publish:minor # canonical release script
npm run sync:github           # GitHub 코드 스냅샷 갱신
```

> 버전 판단: 기능 추가/개선이 포함(Storybook, 타입 시스템, CI 인프라)이므로 patch보다 minor 승격이 적합.

### 현재 게이트 재검증 상태 (2026-04-07)

1. `npm run type-check` PASS (`136.8s`)
2. `npm run test:quick` PASS (`8 files / 160 tests`)
3. targeted node tests PASS (`3 files / 12 tests`)
   - `filter-public-scripts`
   - `check-vercel-usage`
   - `vercel-post-deploy-smoke`
4. `npm run test:node` 전체는 실행 시간이 긴 편이라(환경별 6~7분+) 타임아웃 정책과 분할 실행 기준을 함께 정리한 뒤 `validate:all` 최종 수행 권장

### 완료 결과 (2026-04-07)

1. release commit/tag 생성: `chore(release): 8.11.0`, `v8.11.0`
2. 릴리스 일관성 점검 PASS (`scripts/release/check-release-consistency.js`)
3. canonical push 완료 (`gitlab/main`)
4. GitHub snapshot 동기화 완료 (`npm run sync:github`)

---

## Task 5: node suite runtime 최적화 (신규)

**상태**: 완료

**우선순위**: P2 | **예상 규모**: 중

### 배경

`npm run test:node`는 현재 통과하지만 전체 소요 시간이 약 13분(`~809s`)으로 길다. pre-push의 `type-check:changed` soft-timeout(60s)과 결합될 때 개발 루프가 늘어질 수 있어, release 이후 별도 최적화 트랙으로 분리한다.

### 완료 결과

1. `src/test/setup.node.ts` 신설
   `config/testing/vitest.config.node.ts`가 DOM 전용 `setup.ts` 대신 node 전용 경량 셋업을 사용하도록 변경
2. lightweight targeted routing 확장
   `tests/unit/playwright/**`를 `vitest.config.dev.ts` 경로에 포함해 pre-push targeted node 실행도 가볍게 유지
3. wall time 개선 확인
   `npm run test:node` 기준 `809.63s → 536.87s`로 약 34% 단축
4. 회귀 검증
   `vitest-node-wrapper` 회귀, Playwright config test, MSW 기반 stream contract test, full node suite, `type-check`, `lint` 통과

---

## Task 6: pre-push shared node infra smoke 최적화

**상태**: 완료

**우선순위**: P2 | **예상 규모**: 소~중

### 배경

Task 5 이후에도 `src/test/setup.node.ts` 같은 shared node test infra 파일을 수정하면 pre-push가 이를 일반 `src/**` source change로 분류해 `test:related:node`를 크게 확장했다.
결과적으로 full `test:node`는 빨라졌지만, shared setup 변경이 들어간 push에서는 다시 500s+급 node suite가 실행되는 잔여 비용이 남아 있었다.

### 완료 결과

1. node infra exact 분리
   `src/test/setup.node.ts`, `config/testing/vitest.config.{node,dev,main}.ts`, `config/testing/msw-setup.ts`, `config/testing/shared-aliases.ts`, `scripts/dev/vitest-node-wrapper.js`를 node infra exact set으로 분리
2. pre-push 분류기 보강
   node infra exact 변경은 일반 related source 목록에서 제외하고 `test:node:infra:smoke`로 라우팅
3. shared infra dual smoke
   `msw-setup.ts`, `shared-aliases.ts`, `vitest.config.main.ts`처럼 DOM/node 공용 인프라는 DOM infra smoke + node infra smoke를 함께 수행
4. 회귀 검증
   `pre-push-file-classifier`, `pre-push-test-classifier`, `vitest-node-wrapper` targeted tests와 `test:node:infra:smoke` 통과

### 완료 기준

- shared node infra 변경이 `test:related:node` 거의 전체 확장 경로를 직접 타지 않음
- curated node infra smoke 경로가 deterministic하게 통과
- mixed source + node infra 변경에서도 일반 source related suite와 node infra smoke가 함께 실행됨

---

## Task 7: Storybook large chunk warning 정리

**상태**: 완료

**우선순위**: P3 | **예상 규모**: 소

### 배경

Storybook static build는 성공했지만 `vite-inject-mocker-entry.js`가 약 `1.52 MB`로 측정되어 Vite의 large chunk warning이 남아 있었다.
이 파일은 Storybook/Vite가 생성하는 mocker entry라서 애플리케이션 코드 분할로 직접 줄일 수 있는 청크가 아니었다.

### 완료 결과

1. `.storybook/main.ts`의 `chunkSizeWarningLimit`를 `1100 → 1600`으로 상향
2. 주석에 framework-generated chunk라는 점과 측정 크기 근거를 명시
3. `npm run storybook:build:ci` 재검증 결과 large chunk warning 없이 static build 성공

### 완료 기준

- Storybook build 로그에서 false-positive large chunk warning 제거
- 실제 app-owned bundle 경고 신호는 유지

---

## Task 8: `src/types/common.ts` 잔여 unused type 정리

**상태**: 완료

**우선순위**: P3 | **예상 규모**: 소

### 배경

`src/types/common.ts`는 1차 정리 이후에도 몇 개의 미사용 export와 중앙 경유 re-export가 남아 있었다.
현재 실제 사용은 `ServiceStatus`, `ServerStatus`, `AlertSeverity` 중심으로 수렴해 있어, 추가 축소가 가능한 상태였다.

### 완료 결과

1. unused export 제거
   `Environment`, `ServerType`, `PaginationInfo`, `LogLevel` 삭제
2. unused re-export 제거
   `ServerMetrics` 경유 re-export 삭제
3. 안전성 검증
   실제 남은 참조(`ServiceStatus`, `ServerStatus`, `AlertSeverity`)를 유지한 상태에서 `npm run type-check`, `npm run lint` 통과

### 완료 기준

- `common.ts`가 실제 공통 타입만 남긴 최소 표면으로 축소
- 타입체크/린트 통과

---

## Task 4: Storybook 10.3.x stable 추적 (보류)

**우선순위**: P3 | **상태**: 대기

현재 npm registry의 `storybook` latest dist-tag = `10.2.10`. `10.3.x`는 `next` dist-tag 상태.
stable로 전환되면 다음 항목을 함께 처리:
- `npx storybook@latest upgrade`
- `features.experimentalComponentsManifest` → stable API 전환 여부 확인
- `.storybook/main.ts` feature flag 정리

---

## 실행 순서 권장

| 순서 | Task | 이유 |
|------|------|------|
| 1 | **Task 4** (Storybook 10.3) | `2026-04-07` 기준 npm stable은 여전히 `10.2.10`, `10.3`는 `next=10.3.0-alpha.6`라서 채널 전환 시점만 추적하면 됨 |
