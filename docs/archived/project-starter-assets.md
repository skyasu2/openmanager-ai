# 프로젝트 스타터 자산 가이드

> OpenManager에서 검증된 운영 자산을 새 프로젝트 시작 시 재사용하기 위한 기준 문서
> Owner: dev-experience
> Status: Archived
> Doc type: Reference
> Last reviewed: 2026-05-20
> Canonical: n/a
> Tags: development,starter,template,reuse

## 목적

이 문서는 OpenManager GitLab private repo에 남아 있는 자산 중, **새 프로젝트 시작 시 그대로 가져가거나 약간 수정해 재사용할 수 있는 항목**을 분류한다.

핵심 원칙:
- 무조건 복사하지 않는다.
- `project-agnostic` 자산과 `openmanager-specific` 자산을 구분한다.
- 새 프로젝트에서는 "운영 가능한 시작점"을 빠르게 복원하는 데 집중한다.

## 재사용 분류

### A. 그대로 재사용 가능

경로/프로젝트명만 바꾸면 거의 바로 쓸 수 있는 자산이다.

| 자산 | 경로 | 이유 |
|------|------|------|
| Pre-push 훅 orchestration | `scripts/hooks/pre-push.js` | 빠른 품질 게이트, no-op/docs-only/targeted test routing 포함 |
| Pre-push helper 모듈 | `scripts/hooks/pre-push-*.js` | 역할 분리와 테스트 가능성이 이미 확보됨 |
| Local Docker CI | `scripts/ci/local-docker-ci.sh` | 외부 CI 최소화, free-tier 친화적 검증 경로 |
| GitHub 공개 스냅샷 sync | `scripts/sync/github-sync.sh` | canonical private repo + public snapshot 구조에 재사용 가능 |
| 공개 스크립트 필터 | `scripts/sync/filter-public-scripts.js` | public package.json 스크립트 최소화에 재사용 가능 |
| Renovate 실행 래퍼 | `scripts/renovate/run-self-hosted.sh` | self-hosted dependency automation baseline |
| Renovate 설정 검증 | `scripts/renovate/check-config.sh` | config validation을 런타임과 같은 경로로 고정 |
| 문서 점검 스크립트 | `scripts/docs/check-docs.sh`, `scripts/docs/generate-inventory.ts` | docs-as-code 운영 baseline |

### B. 부분 수정 후 재사용 가능

구조는 재사용 가치가 높지만, 프로젝트 고유 경로나 런타임 가정이 들어 있어 치환이 필요하다.

| 자산 | 경로 | 수정 포인트 |
|------|------|-------------|
| Git hook 문서화 | `docs/development/git-hooks-workflow.md` | 명령어, 테스트 스크립트, 변경 경로 패턴 |
| CI/CD 운영 기준 | `docs/development/ci-cd.md` | 배포 대상, remote 이름, release authority |
| 환경변수 정책 | `docs/development/environment-variables.md` | 실제 인프라 키/주입 경로 |
| 개발 환경 부트스트랩 | `docs/development/project-setup.md` | 런타임 버전, 설치 도구, 비밀값 준비 절차 |
| Scripts 디렉토리 레퍼런스 | `scripts/README.md` | 하위 스크립트 목록과 설명 |
| Renovate config | `renovate.json`, `config/renovate/*` | assignee, schedule, package rule, registry 인증 |
| public snapshot 제외 규칙 | `.github-export-ignore` | 공개/비공개 정책에 맞는 제외 경로 |

### C. OpenManager 전용이라 참조만 할 것

새 프로젝트에 직접 복사하기보다, 설계 판단의 예시로만 보는 편이 낫다.

| 자산 | 경로 | 이유 |
|------|------|------|
| QA 누적 기록 | `reports/qa/*` | OpenManager 운영/검증 이력 그 자체 |
| TODO / Work history | `reports/planning/*` | 프로젝트 히스토리와 의사결정 문맥 의존 |
| OTel precomputed data 체계 | `src/data/otel-*`, `public/data/otel-data/*` | OpenManager 데이터 모델 전용 |
| Cloud Run AI Engine 구현 | `cloud-run/ai-engine/*` | 현재 아키텍처/비용 정책/모델 구성에 종속 |
| Supabase 마이그레이션 | `supabase/migrations/*` | 현재 스키마와 도메인에 강하게 결합 |

## 새 프로젝트 시작 시 권장 적용 순서

1. 품질 게이트부터 복사
- `scripts/hooks/*`
- `scripts/dev/typecheck-*`
- 관련 단위 테스트

1. 로컬 CI 경로 추가
- `scripts/ci/local-docker-ci.sh`
- `package.json` 스크립트 연결

1. 문서 최소 세트 준비
- `docs/development/README.md`
- `docs/development/project-setup.md`
- `docs/development/ci-cd.md`
- `docs/development/environment-variables.md`

1. 공개/비공개 저장소 분리가 필요하면 snapshot sync 도입
- `scripts/sync/github-sync.sh`
- `.github-export-ignore`
- public README override 자산

1. dependency automation이 필요해질 때 Renovate 도입
- `renovate.json`
- `config/renovate/*`
- `scripts/renovate/*`

## 복사 전에 반드시 바꿔야 하는 항목

- remote 이름과 canonical repo 정책
- 배포 대상 (`Vercel`, `Cloud Run`, `Supabase`) 여부
- package.json script 이름
- 테스트 명령어 (`test:node`, `test:dom`, `test:quick`) 구성
- README / public README 문구
- 환경변수 이름과 비밀값 주입 경로
- GitHub 공개 정책과 export-ignore 목록

## 권장 스타터 세트

새 프로젝트에서 가장 먼저 가져갈 최소 세트는 아래다.

```text
scripts/hooks/
scripts/dev/typecheck-changed.sh
scripts/dev/typecheck-scope.js
scripts/ci/local-docker-ci.sh
scripts/docs/check-docs.sh
scripts/docs/generate-inventory.ts
docs/development/README.md
docs/development/ci-cd.md
docs/development/environment-variables.md
renovate.json
```

## 운영 원칙

- OpenManager는 현재 별도 starter-kit repo를 두지 않는다.
- 공통화가 안정되기 전까지는 이 문서를 **starter asset index**로 사용한다.
- 새 프로젝트를 시작할 때는 이 문서를 먼저 보고, 필요한 자산만 선택 복사한다.
- 2개 이상 프로젝트에서 반복 사용된 자산만 별도 템플릿 repo 후보로 승격한다.

## 관련 문서

- [개발 환경 가이드](../development/README.md)
- [CI/CD 파이프라인](../development/ci-cd.md)
- [프로젝트 설정](../development/project-setup.md)
- [환경 변수 관리](../development/environment-variables.md)
- [문서 관리](../development/documentation-management.md)
