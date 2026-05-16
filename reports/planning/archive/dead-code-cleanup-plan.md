# Dead Code & Legacy Export Cleanup Plan

> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: refactor,dead-code,cleanup

## 배경

2026-05-15 정적 분석(Knip + grep)을 통해 생산 코드에서 완전히 미사용이거나 레거시 alias로만 남은 파일/export를 식별했다. 이번 작업은 해당 항목을 제거·정리해 코드베이스 명확성을 높이는 것이 목표다.

---

## 범위 (총 6건)

### A. 데드 파일 (생산 코드 미사용, 테스트만 존재)

| ID | 파일 | 내용 요약 | 영향 |
|----|------|-----------|------|
| A1 | `src/lib/config/env-validation.ts` | `validateTestApiKey()` / `validateEnvironmentVariables()` — 테스트에만 import, 생산에서 미호출 | 테스트 파일 삭제 or 스텁 처리 필요 |
| A2 | `src/lib/api/development-only.ts` | `developmentOnly()` / `blockInProduction()` 래퍼 — 실제 route는 직접 `NODE_ENV` 체크, 이 파일 미사용 | 테스트 파일 삭제 필요 |
| A3 | `src/lib/security/csp-utils.ts` | `generateCSPNonce()` — `middleware.ts`·`layout.tsx` 미연결, 로드맵 인프라로만 남은 상태 | 테스트 파일 삭제 필요 |
| A4 | `src/hooks/ui/useTypewriter.ts` | 타이핑 애니메이션 훅 — 생산 컴포넌트에서 미사용 | 테스트 파일 삭제 필요 |

### B. 레거시 export alias (deprecated, 실사용 없음)

| ID | 위치 | 항목 | 대체 |
|----|------|------|------|
| B1 | `cloud-run/ai-engine/src/services/ai-sdk/agents/nlq-agent.ts` | `createNlqAgent()` 함수 + `agents/index.ts` / `ai-sdk/index.ts` 재수출 | `createMetricsQueryAgent()` |
| B2 | `src/lib/ai/chat-artifacts/artifact-execution.ts` | `ExecutableSurfaceArtifact` 타입 (Knip 플래그) | 내부 `ExecutableSurfaceArtifactKind` 사용으로 충분 |

---

## 계약 (Contract)

### 제거 기준
- 생산 코드(test/spec/stories 제외)에서 import 참조 0건인 파일/export
- Knip이 명시적으로 플래그한 미사용 export

### 비제거 기준 (이번 범위 외)
- `/api/servers` route: `@deprecated` 주석 있으나 `useServerMetrics.ts`, `useTimeSeriesMetrics.ts`, `process-configs.ts`가 `/api/servers/:id` 하위 경로 경유 중 → 별도 마이그레이션 필요
- `AIWorkspace.tsx` deprecated prop: sidebar/fullscreen 공존 구조, 현재 활성 사용 중

### 테스트 정책
- 제거 대상 파일의 테스트 파일도 함께 삭제
- 각 Task 완료 후 `npm run test:quick` + `npm run type-check` 통과 확인
- 전체 완료 후 `npm run knip:ci` 재실행하여 0건 확인

---

## Task 목록

- [x] **T1** A1 제거: `src/lib/config/env-validation.ts` + `env-validation.test.ts` 삭제
  - `instrumentation.ts` production 경로 import가 확인되어 `TEST_API_KEY` 최소 길이 검증은 inline으로 보존했다.
- [x] **T2** A2 제거: `src/lib/api/development-only.ts` + `development-only.test.ts` 삭제
- [x] **T3** A3 제거: `src/lib/security/csp-utils.ts` + `csp-utils.test.ts` 삭제
  - 보안 architecture 문서의 CSP 기준 파일은 `next.config.mjs`로 갱신했다.
- [x] **T4** A4 제거: `src/hooks/ui/useTypewriter.ts` + `useTypewriter.test.ts` 삭제
- [x] **T5** B1 제거: `createNlqAgent()` 함수 본체 + `agents/index.ts` + `ai-sdk/index.ts` 재수출 제거
- [x] **T6** B2 제거: `ExecutableSurfaceArtifact` 타입 export 제거
- [x] **T7** 검증: 타입/테스트/Knip 게이트 통과 확인

### 완료 검증

- `npm run type-check` PASS
- `npm run test:quick` PASS
- `cd cloud-run/ai-engine && npm run type-check` PASS
- `cd cloud-run/ai-engine && npm run test` PASS
- `npm run knip:ci` PASS (compact reporter 출력 없음)

---

## 검증 게이트

```bash
npm run test:quick      # 각 Task 후
npm run type-check      # 각 Task 후
npm run knip:ci         # T7: 0건 목표
npm run validate:all    # 최종 확인
```

---

## 실행 순서 권고

A1~A4는 독립적이므로 순서 무관. B1은 AI Engine 파일이므로 root와 별도 게이트.
권고 순서: T1 → T2 → T3 → T4 → T5 → T6 → T7

---

## 관련 링크
- 분석 세션: 2026-05-15 데드 코드 분석 (대화 컨텍스트)
- Knip 설정: `knip.json`
