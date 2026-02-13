# Documentation Management Guide

> Last verified against code: 2026-02-13
> Status: Active Canonical
> Doc type: Explanation

## Current Inventory

- Total markdown docs: **70**
- Directory breakdown:
  - `docs/reference`: 24
  - `docs/analysis`: 12
  - `docs/guides`: 9
  - `docs/vibe-coding`: 7
  - `docs/development`: 8
  - `docs/troubleshooting`: 2
  - `docs/reviews`: 2
  - root docs (`README.md`, `QUICK-START.md`, etc.): 6
- Auto inventory report: `docs/development/documentation-inventory.md`

## Canonical vs Historical

### Canonical (운영 기준)
- `docs/README.md`
- `docs/reference/README.md`
- `docs/guides/README.md`
- `docs/development/README.md`
- `docs/troubleshooting/README.md`
- `docs/reference/api/endpoints.md`
- `docs/reference/architecture/system/system-architecture-current.md`
- `docs/reference/architecture/folder-structure.md`

### Historical (기록/회고)
- `docs/analysis/*`
- `docs/reviews/*`
- `docs/status.md` (운영 이력 성격)
- 문서 상단 `Status: Historical` 라벨이 있는 문서

## Source of Truth Rules

1. API 목록: `src/app/api/**/route.ts*`
2. 런타임/버전: `package.json`, `cloud-run/ai-engine/package.json`
3. 협업 정책: `AGENTS.md`
4. 아키텍처 기준: `docs/reference/architecture/system/system-architecture-current.md`

## Update Workflow

1. 코드 변경
2. 영향 문서 식별
3. Canonical 문서 우선 갱신
4. 필요한 경우 Historical 문서에 맥락 주석 추가
5. 검증 실행:

```bash
npm run docs:check
npm run docs:lint:changed
npm run docs:links:internal
npm run docs:inventory
```

## Quality Gates

- 내부 링크 깨짐 금지 (`missing_links = 0`)
- Canonical 문서는 코드 기준값과 숫자 일치
- Historical 문서는 반드시 라벨 유지
- CI 문서 게이트: `.github/workflows/docs-quality.yml`
- Lint 정책 분리:
  - Active docs: `active.markdownlint-cli2.jsonc`
  - Historical docs: `historical.markdownlint-cli2.jsonc`

## Doc Type (Diataxis)

- `Tutorial`: 시작/온보딩 중심 문서 (예: `docs/QUICK-START.md`)
- `How-to`: 작업 절차/운영 방법 문서
- `Reference`: API/설정/구조 사실 목록 문서
- `Explanation`: 아키텍처 배경/의사결정 맥락 문서

## Change Policy

- 운영 기준 변경은 Canonical 문서에만 반영
- 과거 분석 문서는 원문 보존, 삭제보다 라벨링 우선
- 문서 간 중복이 생기면 인덱스 문서에 canonical 링크로 수렴
