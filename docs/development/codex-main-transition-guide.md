# Codex 메인 전환 가이드

> 목적: 1개월 내 Codex 중심 개발 운영 전환 시, 기존 Claude Skills에서 재사용 가능한 항목을 선별 이식한다.
> 기준일: 2026-02-13

## 요약 결론

- Claude Skill을 그대로 복제하지 말고, 운영상 가치가 높은 워크플로우만 Codex 포맷으로 재작성한다.
- 우선순위는 `배포 안전성`, `비용 리스크 방지`, `비파괴 Git 워크플로우`, `품질 게이트` 순서다.
- Codex 메인 전환 이후에도 Claude Skill은 참고용 레퍼런스로 유지한다.

## Claude Skill 대비 Codex 이식 평가

| 항목 | Claude Skill | 평가 | Codex 반영 상태 |
|---|---|---|---|
| Cloud Run 배포 | `.claude/skills/cloud-run-deploy` | 높음: 배포 전후 점검/롤백 절차가 실무적 | `openmanager-cloud-run-deploy` (완료) |
| GCP 비용 점검 | `.claude/skills/gcp-cost-check` | 높음: 머신타입 과금 리스크 탐지에 직접적 | `openmanager-gcp-cost-check` (완료) |
| Lint/Smoke | `.claude/skills/lint-smoke` | 높음: 품질 게이트 표준화 | `openmanager-lint-smoke` (기존 운영) |
| Commit 워크플로우 | `.claude/skills/commit-commands` | 중간: 구조는 유용, Claude 전용 리뷰 결합은 분리 필요 | `openmanager-commit-workflow` (기존 운영) |
| GitHub Deploy | `.claude/skills/github-deploy` | 중간: MCP 전략은 유용, 파괴적 git 패턴 제거 필요 | `openmanager-github-deploy-safe` (완료) |

## 적용 원칙

1. 파괴적 Git 명령 금지
- `git reset --hard`, 강제 push, 무단 amend 금지

1. MCP 우선, CLI fallback
- PR 생성/조회는 MCP 우선
- MCP 장애 시 `gh` CLI fallback 허용

1. 비용 가드레일 선검사
- Cloud Build 유료 머신 타입 탐지 시 배포 중단
- Cloud Run CPU/메모리 상향 시 사전 승인 필요

1. 검증 결과 포함 보고
- "무엇을 변경했고, 왜 변경했고, 무엇으로 검증했는지"를 짧게 고정 포맷으로 보고

## Codex 메인 운영 시 기본 스킬 세트

- `openmanager-cloud-cli-access-check`
- `openmanager-lint-smoke`
- `openmanager-commit-workflow`
- `openmanager-github-deploy-safe`
- `openmanager-cloud-run-deploy`
- `openmanager-gcp-cost-check`
- `openmanager-stitch-incremental`

## 점검 루틴 (주 1회 권장)

```bash
# 설치/인증 상태 점검
gcloud --version
vercel --version
supabase --version
gcloud auth list
vercel whoami
supabase projects list

# 배포/비용 리스크 점검
rg -n "machineType|--machine-type|E2_HIGHCPU_8|N1_HIGHCPU_8" cloud-run/ai-engine/deploy.sh cloud-run/ai-engine/cloudbuild.yaml
```

## 운영 메모

- `.codex/skills`는 로컬 운영 레이어이며 Git 추적 제외 환경일 수 있다.
- 팀 공유가 필요하면 동일 내용을 `docs/`와 `scripts/`에 문서화해 재현성을 확보한다.
