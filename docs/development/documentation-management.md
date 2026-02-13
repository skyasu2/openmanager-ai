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

---

## Docs-as-Code Principles

이 프로젝트는 **Docs-as-Code** 접근법을 채택하고 있습니다. 문서를 코드와 동일한 방식으로 관리합니다.

| 원칙 | 구현 상태 |
|------|----------|
| Git 버전 관리 | `docs/` 전체 Git 추적 |
| Markdown 기반 작성 | 전체 문서 Markdown/MDX |
| PR 기반 리뷰 | `.github/CODEOWNERS`에 docs 소유자 지정 |
| CI 자동 검증 | `.github/workflows/docs-quality.yml` |
| Markdown Lint | `markdownlint-cli2` (active/historical 이중 설정) |
| 내부 링크 검증 | `scripts/docs/check-internal-links.js` |
| 외부 링크 검증 | `markdown-link-check` (CI 주간 스케줄) |
| 문서 분류 체계 | Diataxis (Tutorial/How-to/Reference/Explanation) |
| 메타데이터 | 프론트매터: `Last verified`, `Status`, `Doc type` |
| 문서 인벤토리 | `generate-inventory.js` 자동 생성 |
| Stale 감지 | `check-docs.sh`에서 90일 초과 문서 경고 |

## CI Pipeline

문서 변경 시 자동으로 품질 게이트가 실행됩니다.

```
Push / PR (docs/** 변경)
    │
    ├── markdownlint-cli2
    │     active.markdownlint-cli2.jsonc (운영 문서)
    │     historical.markdownlint-cli2.jsonc (기록 문서)
    │
    ├── check-internal-links.js
    │     docs/ 내부 링크 유효성 검증
    │
    ├── check-docs.sh
    │     stale 문서 감지 (90일 초과)
    │     인벤토리 집계
    │
    └── Agent config version check
          CLAUDE.md, GEMINI.md 버전 일치 확인

Weekly Schedule (매주 월요일 09:00 UTC)
    │
    └── markdown-link-check
          docs/ 전체 외부 링크 유효성 검증
          (continue-on-error: 외부 장애 시 비차단)
```

## Toolchain

| 도구 | npm 스크립트 | 용도 |
|------|-------------|------|
| `markdownlint-cli2` | `npm run docs:lint:changed` | Markdown 스타일 린트 |
| `check-internal-links.js` | `npm run docs:links:internal` | 내부 링크 검증 |
| `markdown-link-check` | `npm run docs:links` | 외부 링크 검증 (상위 20개) |
| `markdown-link-check` | `npm run docs:links:full` | 외부 링크 전체 검증 |
| `generate-inventory.js` | `npm run docs:inventory` | 문서 인벤토리 자동 생성 |
| `check-docs.sh` | `npm run docs:check` | 통합 품질 검사 |

## New Document Checklist

새 문서를 작성할 때 다음 항목을 확인하세요.

1. **프론트매터 작성**
   ```markdown
   > Last verified against code: YYYY-MM-DD
   > Status: Active Canonical | Historical
   > Doc type: Tutorial | How-to | Reference | Explanation
   ```

2. **Diataxis 분류 결정**
   - Tutorial: 시작/온보딩 가이드
   - How-to: 작업 절차/운영 방법
   - Reference: API/설정/구조 사실 목록
   - Explanation: 아키텍처 배경/의사결정 맥락

3. **인덱스 등록**: 해당 디렉토리의 `README.md`에 링크 추가

4. **품질 검증 실행**
   ```bash
   npm run docs:check           # 통합 검사
   npm run docs:links:internal  # 내부 링크 확인
   npm run docs:lint:changed    # 린트 검사
   ```

5. **CODEOWNERS 확인**: `docs/` 경로 변경은 자동으로 `@skyasu2` 리뷰 지정

## Maturity & Roadmap

**현재 성숙도: ~70%** — 기반 인프라(Git, Lint, CI, 분류 체계)는 우수하나, 웹 배포/API 자동 문서에서 갭 존재.

| 영역 | 현재 | 향후 검토 |
|------|------|----------|
| 버전 관리 | Git 완비 | - |
| CI 검증 | Lint + 링크 + Stale | 외부 링크 CI 추가 완료 |
| 문서 분류 | Diataxis 적용 | - |
| 웹 사이트 배포 | 미적용 | Nextra (Next.js 네이티브) 검토 |
| API 문서 자동 생성 | 미적용 | TypeDoc 검토 (TSDoc 정비 선행) |
| 문서 소유자 | CODEOWNERS 추가 | 파일별 `review_owner` 메타데이터 확장 |
