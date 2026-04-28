# AI Scripts

현재 `scripts/ai/`는 활성 에이전트 운영 도구만 유지합니다.

## Active

- `agent-bridge.sh` - Claude/Codex/Gemini 교차 검증 브리지
- `check-codex-project-scope.ts` - Codex project-scope 설정 점검
- `check-gemini-global-config.ts` - Gemini global 설정 점검
- `setup-codex-project-scope.sh` - Codex project-scope 설정 보정
- `setup-gemini-global.sh` - Gemini global 설정 보정
- `health/check-ai-tools-updates.sh` - AI CLI/tooling 업데이트 확인

## Archived

2026-04-10 이전의 자동 큐/리뷰/동기화 helper는 호출점 부재로 제거했습니다.
복구가 필요한 경우 Git 이력 또는 `reports/history/legacy-scripts/2026-04-10/`를
먼저 확인합니다.
