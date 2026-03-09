# DoD Closeout Roadmap

> Owner: qa
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-03-09
> Canonical: reports/qa/dod-closeout-roadmap.md

`qa-tracker.json`과 `QA_STATUS.md`가 현재 상태의 SSOT입니다. 이 문서는 "아직 무엇을 닫아야 하는가"보다 "언제 로드맵을 다시 열어야 하는가"를 설명하는 운영 가이드로 유지합니다.

## 현재 상태 (2026-03-09 기준)

- QA 런 누적: 67회
- 완료 항목: 126개
- 미완료 항목: 0개
- Deferred 항목: 0개
- Wont-Fix 항목: 35개
- 오픈 전문가 갭: 0개
- 최신 런: `QA-20260309-0067` (`6/6 PASS`, Vercel + Playwright MCP docs smoke)
- 최신 전체 플로우 런: `QA-20260309-0066` (`10/10 PASS`, Vercel + Playwright MCP)

## 해석

- 현재 `v8.8.0` 릴리즈 라인은 QA 관점에서 닫힌 상태입니다.
- 즉시 수행해야 할 P0/P1 QA 액션은 없습니다.
- 과거 로드맵의 미해결 항목은 현재 트래커에서 `completed` 또는 `wont-fix`로 정리되었습니다.

## 로드맵을 다시 열어야 하는 조건

1. `qa-tracker.json`에 `pendingItems > 0`이 생길 때
2. `QA_STATUS.md`에 `expert open gaps > 0`가 다시 나타날 때
3. 앱 코드 또는 배포 환경이 바뀌어 런타임 경로가 달라질 때
4. Vercel/Cloud Run 헬스 응답, AI 흐름, 인증 동선 중 하나라도 실패할 때

## 다음 릴리즈에서의 실행 순서

1. 상태 확인
   - `npm run qa:status`
   - `reports/qa/qa-tracker.json`
2. DoD 검증
   - `npm run type-check`
   - `npm run lint`
   - `npm run test:quick`
   - 필요 시 `npm run test:contract`
3. 릴리즈 게이트
   - `npm run test:gate`
   - `npm run validate:all`
   - `npm run test:e2e:critical`
4. 실환경 검증
   - Vercel + Playwright MCP로 랜딩, 시스템 시작, 대시보드, AI Chat, Reporter, Analyst, Health 확인
5. 결과 기록
   - `npm run qa:record -- --input <json>`
   - `npm run qa:status`

## 잔여 백로그 해석

- `observability-monitoring`, `security-attack-regression-pack`은 현재 릴리즈 차단 이슈가 아니라 운영형 보강 항목입니다.
- `ai-code-gate-input-policy`와 일부 `P2` 항목은 과도 개선 방지 규칙에 따라 `wont-fix`로 관리됩니다.
- 새 기능이나 보안 요구가 추가되지 않는 한, 이 문서만 보고 추가 QA를 반복할 이유는 없습니다.
