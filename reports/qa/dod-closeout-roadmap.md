# DoD Closeout Roadmap

## 현재 상태 (기준 시점)
- QA 런 누적: 5회
- 완료 항목: 6개
- 미완료 항목: 14개
- 오픈 전문가 갭: 4개 (`observability-monitoring`, `ai-security-reliability`, `test-automation`, `data-metrics-quality`)

## 1) 즉시 수행 (P0)
1. `feature-dod-tsc-zero-error`
   - 항목: Feature DoD `tsc --noEmit`
   - 근거: `tsc --noEmit` 클린 상태 확보
   - 조치: `npm run type-check`
   - 완료 시 트래커 반영: 이 항목을 `completedImprovements`로 기록

2. `feature-dod-lint-zero-error`
   - 항목: Feature DoD `npm run lint`
   - 근거: 린트 경고 0개
   - 조치: `npm run lint`
   - 완료 시 트래커 반영: 이 항목을 `completedImprovements`로 기록

## 2) Release DoD 정밀화 (P1)
- `release-dod-test-gate`
  - `npm run test:gate`
  - `npm run test:e2e:critical`
  - `npm run validate:all`
- `release-dod-contract-test`
  - `npm run test:contract`

## 3) 영역별 Gap 마감 (P1)
- `observability-monitoring`
  - 오탐/미탐 precision/recall 주간 리포트 자동화
- `security-attack-regression-pack`
  - 프롬프트 인젝션/우회/정보추출 변형 시나리오 10건 이상 추가
- `test-automation`
  - 단위·통합·계약 테스트 최소 1건씩 보강
- `metrics-drift-threshold-standard`
  - 드리프트 임계치 + 경보 정책 표준화

## 4) 문서/운영 보강 (P2)
- `release-dod-doc-gate`
  - 문서 메타데이터(Owner/Status/Doc type/Last reviewed) 갱신 스케줄 고정
- `feature-dod-security-review`
  - OAuth 토큰/이메일 인증/AI 입력 경로 OWASP 체크리스트 반영
- `ai-code-gate-input-policy`
  - Prompt 패턴 15개 방어 정책 운영형 테스트 템플릿 확정

## 실행 규칙
- 개선 완료/미완료는 `completedImprovements` / `pendingImprovements`로만 기록
- 각 실행마다 `reports/qa/templates/qa-run-input.example.json` 기반 템플릿으로 `npm run qa:record` 실행
- `npm run qa:status`로 매일 상태 점검
