> Owner: AI Agent
> Status: Draft
> Doc type: Plan
> Last reviewed: 2026-04-16

# [작업 계획서] Vibe Coding 공개 카피 정리 (2026-04-16)

## Objective
- 랜딩 페이지 `Vibe Coding` 소개 모달과 히스토리 모달의 공개용 카피를 포트폴리오 관점에 맞게 정리한다.
- `Gemini CLI`, `Google Antigravity`, `Cursor`, `Windsurf/VSCode` 설명에서 제품의 공식 포지셔닝과 이 프로젝트에서의 실제 사용 맥락을 분리한다.
- 공개 페이지에서는 모델 세부 버전과 과도한 기여율 표현을 제거하고, 내부 추적 문서에서만 정밀 버전을 유지하는 기준을 확립한다.

## Verified Facts
- 랜딩 `Vibe Coding` 모달은 [FeatureCardModal.tsx](/mnt/d/dev/openmanager-ai/src/components/shared/FeatureCardModal.tsx:1) → [TechStackSection.tsx](/mnt/d/dev/openmanager-ai/src/components/shared/TechStackSection.tsx:1) → [TechCard.tsx](/mnt/d/dev/openmanager-ai/src/components/shared/TechCard.tsx:1) 경로로 렌더된다.
- [TechCard.tsx](/mnt/d/dev/openmanager-ai/src/components/shared/TechCard.tsx:37) 는 `tech.version`이 있으면 화면에 그대로 출력한다.
- 공개 모달 데이터는 [feature-cards.data.ts](/mnt/d/dev/openmanager-ai/src/data/feature-cards.data.ts:122) 와 [vibe-coding.ts](/mnt/d/dev/openmanager-ai/src/data/tech-stacks/vibe-coding.ts:1) 에서 공급된다.
- 현재 public-facing 카피에는 아래 표현이 포함된다.
  - `claude-sonnet-4-6`
  - `전체 개발의 99% 주도`
  - `자동 개발의 시작`
  - `Google Antigravity ... 현재는 터미널 뷰어와 시각 보조 도구`
- 내부 상태 문서 [docs/status.md](/mnt/d/dev/openmanager-ai/docs/status.md:424) 에는 여전히 `Opus 4.6` 표기가 남아 있다.
- 공식 제품 포지셔닝은 아래와 다르지 않다.
  - Gemini CLI: terminal-based open-source AI agent
  - Google Antigravity: agentic development platform
  - Cursor: AI-powered code editor
  - Windsurf: AI IDE / flow-oriented editor

## Problem Statement
- 현재 카피는 `공식 제품 설명`, `이 프로젝트에서의 실제 사용 방식`, `내부 회고성 평가`를 한 문단 안에 섞고 있다.
- 공개 모달에서 모델 SKU와 과도한 기여율(`99%`)을 노출하면 포트폴리오 톤이 불필요하게 방어적이거나 과장되어 보일 수 있다.
- `Antigravity`, `Windsurf` 같은 도구를 프로젝트 내 보조 역할만으로 축소해 적으면 제품 정체성을 왜곡할 위험이 있다.

## Scope
1. `Vibe Coding` 공개 모달과 히스토리 모달에서 노출되는 카피를 정리한다.
2. `Gemini CLI`, `Google Antigravity`, `Cursor`, `Windsurf/VSCode` 항목을 공식 포지셔닝과 사용 맥락으로 분리한다.
3. 공개 페이지에서 불필요한 모델 버전/SKU/정량 기여율 문구를 제거하거나 완화한다.
4. 공개용 표현 원칙을 문서화해 이후 동일한 drift를 막는다.

## Out of Scope
- 실제 AI 개발 도구 사용 이력의 삭제 또는 미화
- 내부 forensic/history 문서의 정확 버전 로그 제거
- `AI Assistant`, `Cloud Platform`, `Tech Stack` 카드 카피 전면 재작성
- 기능 코드, 라우팅, QA 로직 변경

## Copy Principles
1. 공개 페이지는 `도구 계열`과 `사용 맥락` 중심으로 설명한다.
2. 모델 세부 버전은 public surface에서 제거하고, 내부 문서에서만 유지한다.
3. `99%`, `단독 주도`, `자동 개발의 시작` 같은 정량/선언형 표현은 중립 문구로 낮춘다.
4. 제품 설명과 프로젝트 내 역할 설명을 한 문장에 섞지 않는다.
5. 포트폴리오 문장은 “무엇을 썼는가”보다 “어떻게 워크플로우를 구성했는가”에 초점을 둔다.

## Proposed Work Breakdown

### Task 1. Public Surface Audit
- `Vibe Coding` 모달과 히스토리 모달에서 실제 노출되는 문구를 항목별로 추출한다.
- `버전`, `기여율`, `도구 역할`, `공식 설명 차용`을 분리 표로 정리한다.

### Task 2. Official Positioning Cross-Check
- `Gemini CLI`, `Google Antigravity`, `Cursor`, `Windsurf`의 공식 소개 문구를 기준선으로 정리한다.
- 제품 정체성과 프로젝트 사용 맥락이 충돌하는 표현을 식별한다.

### Task 3. Public-Safe Copy Rewrite
- 아래 항목의 문구를 중립적으로 재작성한다.
  - overview
  - stage summary
  - `Google Antigravity`
  - `Gemini CLI`
  - `Cursor AI (Auto Dev)`
  - `Visual Aux (Windsurf/VSCode)`
  - `Multi-AI CLI (Manual Cross-Use)`
- 원칙:
  - `Claude Code 중심 + Codex/Gemini 보조`
  - `도구 선택 이유` 중심
  - `버전/SKU/과도한 정량 표현` 제거

### Task 4. Internal/Public Boundary Cleanup
- 공개 모달에서 제거한 세부 버전 정보가 내부 문서에는 남아 있어야 하는지 분리 판단한다.
- [docs/status.md](/mnt/d/dev/openmanager-ai/docs/status.md:424) 같은 내부 문서의 정확 버전 표기는 별도 유지 또는 정리 기준을 정한다.

### Task 5. UI Validation
- 수정 후 랜딩 `Vibe Coding` 모달과 히스토리 뷰에서 아래를 확인한다.
  - 버전 문자열 과노출 없음
  - 과장 문구 제거
  - 도구별 역할이 읽기 쉽게 정리됨
  - 히스토리 흐름이 과거 → 현재로 자연스럽게 읽힘

## Deliverables
- 수정 대상 카피 목록
- public-safe 문구 초안
- 내부/공개 문서 경계 기준
- 랜딩 모달 검증 결과

## Validation
- `Vibe Coding` 모달에서 모델 SKU가 직접 노출되지 않는다.
- `99%`, `단독 주도`, `자동 개발의 시작` 같은 과장 문구가 공개 surface에서 제거되거나 완화된다.
- `Gemini CLI`, `Antigravity`, `Cursor`, `Windsurf` 설명이 공식 제품 정체성과 정면 충돌하지 않는다.
- 사용자는 각 도구의 `공식 성격`과 `이 프로젝트에서의 실제 역할`을 구분해 읽을 수 있다.

## Implementation Notes
- 우선 수정 대상은 [feature-cards.data.ts](/mnt/d/dev/openmanager-ai/src/data/feature-cards.data.ts:122) 와 [vibe-coding.ts](/mnt/d/dev/openmanager-ai/src/data/tech-stacks/vibe-coding.ts:1) 이다.
- 필요 시 [TechCard.tsx](/mnt/d/dev/openmanager-ai/src/components/shared/TechCard.tsx:37) 의 `version` 렌더 정책도 검토할 수 있다. 다만 이번 계획 단계에서는 확정하지 않는다.
- 내부 문서 [docs/status.md](/mnt/d/dev/openmanager-ai/docs/status.md:424) 정리는 별도 follow-up으로 분리할 수 있다.
