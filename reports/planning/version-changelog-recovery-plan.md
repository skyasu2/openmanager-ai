# Version/Changelog Recovery Plan

- 상태: 진행 중
- 작성일: 2026-02-14
- 목표: 버전/태그/체인지로그/작업 이력 관리 재정렬

## 배경

현재 저장소는 `standard-version` 기반 릴리즈 도구는 존재하지만, 운영 프로세스가 느슨해져 버전/태그/체인지로그 동기화가 깨진 상태입니다.  
또한 작업 계획서 이력은 "어제 무엇을 했고 다음 방향이 무엇인지"를 남기는 용도로 사용해야 하므로, 계획서/이력 기록 규칙을 명확히 유지할 필요가 있습니다.

## 현황 진단 (팩트)

1. 릴리즈 도구는 설치/동작 가능
- `package.json`에 `release*` 스크립트 존재
- `standard-version@9.5.0` 설치 확인
- `npm run release:dry-run` 정상 동작 확인

2. 버전/태그 동기화 불일치
- 현재 `package.json` 버전: `8.0.0`
- 최신 태그: `v7.1.4`
- `v8.0.0` 태그 부재
- `CHANGELOG.md`는 `8.0.0` 섹션 존재

3. 릴리즈 자동화 부재
- `.github/workflows/`에 릴리즈/태그 생성 워크플로우 없음
- pre-push 훅은 릴리즈 필요성을 "권고"만 하고 강제하지 않음

4. 버전 SSOT 취약 지점
- `src/app/api/version/route.ts`는 버전을 하드코딩 (`8.0.0`)
- 주석에는 자동 업데이트 스크립트(`api-version-updater.js`)를 언급하나 실제 스크립트 부재

## 2026-02-13 작업 이력 요약 (참조용)

- 문서/아키텍처 정리 집중
  - `docs(arch): fix dead refs, rewrite system architecture overview`
  - `docs: consolidate v8 documentation and fix Cloud Run version refs`
  - `chore(docs): add documentation quality tooling`
- 런타임/도구 전환
  - `chore: upgrade Node.js 22 -> 24 LTS across Docker and CI`
  - `chore: add codex-local.sh runner`
  - `chore: add MCP health check script for Codex`
- 코드 리팩토링
  - `refactor(charts): replace SVG RealtimeChart with uPlot`
  - dead code 정리 커밋들

방향성 해석:
- 제품 기능 추가보다 "운영 안정화 + 문서/도구 정렬"에 초점
- 버전 관리도 같은 축으로 운영 표준화가 필요한 상태

## 실행 방안

## 결정 사항 (2026-02-14)

- 사용자 결정: **A안 채택 (`8.0.0` 유지)**
- 복구 기준선: `chore: complete rename cleanup` 커밋(`73ce5aff3`)을 `v8.0.0` 기준점으로 사용

### Phase 1. 기준선 복구 (1회)

1. 버전 기준 결정
- 옵션 A: `8.0.0` 유지 (권장)
- 옵션 B: `7.1.4`로 롤백

2. 태그/체인지로그 동기화
- A 선택 시: `v8.0.0` 릴리즈 커밋/태그 생성 후 푸시
- B 선택 시: 버전 파일/CHANGELOG 정합 복구 후 재릴리즈

3. 하드코딩 버전 점검
- `src/app/api/version/route.ts` 동기화 방식 확정
- 주석의 가짜 자동화 설명 제거 또는 실제 자동화 스크립트 구현

### Phase 2. 운영 루틴 고정 (반복)

1. 릴리즈 규칙
- 기능/수정 누적 후 `npm run release:{patch|minor|major}`
- 생성물(`package.json`, `cloud-run/ai-engine/package.json`, `package-lock.json`, `CHANGELOG.md`) 확인
- `git push --follow-tags`

2. PR/CI 가드
- PR 체크에 "태그 없이 버전만 변경" 감지 규칙 추가
- `CHANGELOG.md` 갱신 누락 감지 규칙 추가
- 적용 완료:
  - `scripts/release/check-release-consistency.js` 추가 (`npm run release:check`)
  - `.github/workflows/ci-optimized.yml`에 Release consistency check 단계 추가
  - PR 이벤트는 `RELEASE_CHECK_TAG=warn`, push 이벤트는 strict 태그 검사

3. 커밋 규칙 가이드
- Conventional Commit 형식 유지 (`feat:`, `fix:`, `chore:` 등)
- 릴리즈 커밋은 `chore(release): x.y.z` 단일 책임 유지

### Phase 3. 작업 계획서 이력 운영 (지속)

목적: "어제 작업 + 오늘 방향 + 다음 액션"을 팀 참조 자산으로 유지

운영 규칙:
- 진행 계획: `reports/planning/*-plan.md`
- 완료 계획: `reports/planning/archive/` 이동
- 일일 이력은 계획서 내 `작업 이력` 섹션 또는 별도 날짜 문서로 남김
- 최소 기록 항목:
  - 날짜 (예: `2026-02-13`)
  - 완료 작업 3~7줄
  - 결정사항/보류사항
  - 다음 작업 방향 (다음날 첫 액션)

## 완료 기준

- 버전/태그/체인지로그가 같은 릴리즈 번호로 일치
- 릴리즈 절차가 문서+명령어 기준으로 재현 가능
- 최근 작업 이력이 날짜 기준으로 추적 가능
- 신규 참여자가 어제 맥락을 5분 내 파악 가능
