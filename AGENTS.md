# AGENTS.md - OpenManager Codex 실행 규칙

<!-- Version: 6.0.0 -->
**이 문서는 OpenManager AI 프로젝트 내에서 Codex 에이전트 전용 실행 규칙만 정의합니다.**

## 1) 정책 참조 구조 (SSOT)
- **모든 AI 에이전트 공통 규칙의 SSOT는 `docs/guides/ai/ai-standards.md` 입니다.**
- 공통 정책/에이전트 간 협업 규정은 이 파일에서 정의하지 않습니다.
- Codex 전용 동작 및 환경 규칙은 오직 이 문서(`AGENTS.md`)에서만 관리합니다.
  - Claude 전용: `CLAUDE.md`
  - Gemini 전용: `GEMINI.md`
- **충돌 우선순위**: `docs/guides/ai/ai-standards.md` > 요약된 에이전트 전용 문서 (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`)

## 2) Codex 실행 규칙

### 2.1 기본 동작 모드
- Codex는 기본적으로 구현/개선 중심으로 동작합니다.
- 사용자가 명시적으로 "리뷰만" 요청한 경우에만 리뷰 모드 중심으로 전환합니다.

### 2.2 AGENTS 탐색 규칙
- 전역 계층: `~/.codex/AGENTS.override.md` 우선, 없으면 `~/.codex/AGENTS.md`
- 프로젝트 계층: 루트부터 현재 디렉토리까지 각 디렉토리에서 아래 순서로 최대 1개 파일 채택
  - `AGENTS.override.md` → `AGENTS.md` → `project_doc_fallback_filenames`
- 하위 디렉토리 지침이 상위 지침보다 우선합니다.
- 지침 체인은 실행 시작 시점에 구성되므로 지침 파일 수정 후 세션 재시작으로 반영 확인합니다.

### 2.3 MCP 운영 규칙 (Codex)
- MCP 서버 목록 SSOT는 `.codex/config.toml`의 `[mcp_servers.*]`입니다.
- 상태 점검 스크립트는 하드코딩 목록이 아닌 설정 파일 파싱 기반으로 동작해야 합니다.
- 변경/배포 전 최소 점검:
  - `bash scripts/mcp/codex-local.sh mcp list`
  - `bash scripts/mcp/mcp-health-check-codex.sh`
- 가능하면 서버별 최소 1회 도구 호출로 실동작을 확인합니다.

### 2.4 워크스페이스 경계 및 기본 검증
- Root App(`src` 중심) 변경 시 기본 검증:
  - `npm run type-check`
  - `npm run lint`
  - 필요 시 `npm run test:quick`
- AI Engine(`cloud-run/ai-engine`) 변경 시 별도 검증:
  - `cd cloud-run/ai-engine && npm run type-check`
  - `cd cloud-run/ai-engine && npm run test`

## 3) 공통 지식 및 유지보수 메모
- **[필독] 프로젝트 3대 원칙 (Free Tier, 배포 환경 인지, OTel 데이터 SSOT)** 등 모든 AI 에이전트가 완벽히 숙지해야 할 핵심 규칙은 `docs/guides/ai/ai-standards.md` 파일에 정의되어 있습니다. 작업을 시작하기 전 해당 문서를 반드시 참조하세요.
- 이 문서는 주로 "Codex 전용 실행 환경 및 MCP 설정" 등에 대한 규칙만 제한적으로 유지합니다.
- 공통 정책이 변경되는 경우 이 파일이 아닌 `docs/guides/ai/ai-standards.md`를 갱신해야 합니다.

---
_Last reviewed: 2026-02-21_
