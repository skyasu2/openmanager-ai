> Owner: project
> Status: Completed
> Last reviewed: 2026-05-07

# Cloud Run Docker Compose Drift Cleanup Plan

- 상태: Completed
- 작성일: 2026-05-07
- TODO.md 연결: Backlog > Cloud Run local Docker Compose drift cleanup
- 우선순위: Low

## 목표

Cloud Run AI Engine의 로컬 Docker Compose 경로가 현재 운영/CI 토폴로지와 어긋나지 않도록 정리한다.

이 작업의 목적은 Docker 사용 범위를 늘리는 것이 아니라, 이미 존재하는 로컬 보조 런타임이 최신 env 명명, 버전, 문서 기준과 충돌하지 않게 만드는 것이다.

```text
현재 기준
  GitLab CI
    └─ WSL2 shell executor
        ├─ node/npm/vercel/gcloud 직접 실행
        └─ 필요 시 docker CLI -> Docker Desktop Linux engine

Docker 사용
  ├─ Supabase local stack
  ├─ local Docker CI 보강 검증
  └─ AI Engine local compose/preflight

정리 대상
  └─ cloud-run/docker-compose.yml의 legacy naming/version/env drift
```

## 현재 발견 사항

| 대상 | 현재 근거 | 위험 | 판단 |
|------|-----------|------|------|
| `cloud-run/docker-compose.yml` build arg | `APP_VERSION=8.0.0` 고정 | package/version drift로 로컬 이미지 로그·메타데이터 혼선 | 정리 필요 |
| `cloud-run/docker-compose.yml` network | `vibe-network` | 구 프로젝트명 잔재, 운영 의미 없음 | 정리 필요 |
| `cloud-run/docker-compose.yml` Gemini env | `GOOGLE_API_KEY`, `GEMINI_API_KEY_SECONDARY` | AI Engine runtime parser는 `GEMINI_API_KEY` 또는 `GEMINI_API_KEY_PRIMARY` 우선 | 호환 alias 정리 필요 |
| `cloud-run/.env.example` | `GOOGLE_API_KEY` 중심 | GCP Secret Manager 호환 설명과 runtime env 명명 사이의 혼선 | 설명/alias 기준 정리 필요 |
| `cloud-run/README.md` | `docker-compose up --build` legacy command | Docker Compose v2 표준 `docker compose`와 불일치 | 문서 정리 필요 |
| `docs/development/docker.md` | AI Engine compose를 보조 런타임으로 설명 | 방향은 맞음 | 정리 후 링크/명령만 맞추면 됨 |

## 범위

### 포함

- `cloud-run/docker-compose.yml`의 legacy project/network/container naming 정리
- `APP_VERSION` build arg가 stale 고정값으로 남지 않도록 정리
- Gemini/Google AI env alias를 AI Engine runtime parser와 문서 기준에 맞게 정렬
- `cloud-run/.env.example`, `cloud-run/README.md`, `docs/development/docker.md`의 Compose 명령/역할 설명 보정
- Docker Compose config 수준의 deterministic 검증

### 제외

- GitLab CI executor를 Docker executor로 전환
- Frontend 개발을 Docker 기반으로 전환
- Cloud Run production 배포 방식 변경
- GCP Secret Manager secret 이름 변경
- 실 LLM, Supabase cloud, Vercel, Cloud Run live 호출 자동 테스트 추가
- Docker image prune/build cache prune 자동 실행

## 계약 (Contract)

> 2026-05-07 확정: Docker executor 전환 없이 local Compose 보조 경로만 정리한다.
> `APP_VERSION`은 오래된 숫자를 기본값으로 두지 않고 `local` 기본값 또는 명시 override로만 전달한다.
> Gemini env는 `GEMINI_API_KEY`/`GEMINI_API_KEY_PRIMARY`를 우선하고, `GOOGLE_API_KEY`는 legacy local alias 입력으로만 취급한다.

### 변경 후보 파일

- `cloud-run/docker-compose.yml`
- `cloud-run/.env.example`
- `cloud-run/README.md`
- `docs/development/docker.md`
- 필요 시 `docs/development/environment-variables.md`

### Compose/runtime 계약

| 항목 | 계약 |
|------|------|
| CI executor | GitLab CI는 계속 WSL2 shell executor 기준이다. Docker executor 전환 없음 |
| Local Compose 목적 | AI Engine 로컬 보조 검증 전용이다. production 배포 권위 없음 |
| Version metadata | stale hardcoded version을 남기지 않는다. package 기준 또는 명시 override 기준으로만 전달 |
| Network/container naming | 구 프로젝트명(`vibe`)을 새 로컬명으로 교체한다 |
| Gemini env | runtime parser가 읽는 `GEMINI_API_KEY`/`GEMINI_API_KEY_PRIMARY`를 우선 문서화하고, 필요한 경우 legacy alias만 호환 유지 |
| 비용 발생 | 실 LLM/API 호출, Cloud Run deploy, external connectivity test를 기본 검증에 포함하지 않는다 |

### 검증 시나리오

- [x] `cd cloud-run && docker compose config`가 성공한다.
- [x] `cloud-run/docker-compose.yml`에 구 프로젝트명 network/container alias가 남지 않는다.
- [x] Compose env 설명이 AI Engine runtime parser의 Gemini key 우선순위와 충돌하지 않는다.
- [x] 문서상 GitLab CI shell executor와 Docker 보조 런타임 역할이 유지된다.
- [x] 검증 과정에서 실 LLM, Supabase cloud, Vercel, Cloud Run 호출이 발생하지 않는다.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다.

- [x] Task 0 — 계약 확정
  - 완료 기준: env alias 유지/삭제 범위, version 전달 방식, compose command 기준 확정
- [x] Task 1 — Compose 설정 정리
  - 완료 기준: `APP_VERSION`, network/container naming, Gemini env alias drift 제거
- [x] Task 2 — 로컬 env example 정리
  - 완료 기준: `cloud-run/.env.example`이 runtime parser와 GCP Secret Manager 호환 관계를 명확히 설명
- [x] Task 3 — 문서 정리
  - 완료 기준: `cloud-run/README.md`, `docs/development/docker.md`가 Docker 보조 런타임/WSL shell CI 구조를 일관되게 설명
- [x] Task 4 — 저비용 검증
  - 완료 기준: `docker compose config`, 문서/공백 검증 통과. broad build/live smoke는 실행하지 않거나 명시 사유 기록

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `docs(plan):` | 선택 | ❌ | ❌ |
| Task 1 | `chore(docker):` | 선택 | ❌ | ❌ |
| Task 2~3 | `docs(dev):` 또는 `chore(env):` | 선택 | ❌ | ❌ |
| Task 4 | — | 필요 시 | ❌ | ❌ |

## 검증 계획

기본 검증:

```bash
cd cloud-run && docker compose config
npm run docs:budget
npm run docs:ai-consistency
git diff --check
```

조건부 검증:

- Dockerfile 또는 build arg 동작을 바꾸면 `cd cloud-run && docker compose build ai-engine`를 1회만 검토한다.
- build가 캐시를 크게 소모하거나 시간이 과도하면 실행하지 않고 `docker compose config`로 제한한 사유를 보고한다.
- Cloud Run deploy, production smoke, external connectivity, 실 LLM 호출은 이 plan의 기본 완료 기준이 아니다.

## 완료 기준

- `cloud-run/docker-compose.yml`에서 stale project naming/version/env drift가 제거된다.
- AI Engine 로컬 Compose 실행 문서가 현재 GitLab CI shell executor 구조와 충돌하지 않는다.
- env alias가 runtime parser와 문서에서 같은 우선순위로 설명된다.
- 검증이 로컬 deterministic 범위에 머물러 비용 발생 가능성을 만들지 않는다.

## 완료 결과

- `cloud-run/docker-compose.yml`: Docker Compose V2 명령 주석, `APP_VERSION=${APP_VERSION:-local}`, `openmanager-ai-engine-local` naming, `GEMINI_API_KEY`/`GEMINI_API_KEY_PRIMARY` 중심 env, optional env 빈 기본값 적용.
- `cloud-run/.env.example`: local Compose 용도와 production grouped Secret Manager 경계를 분리하고 Gemini/Cerebras/Groq/Mistral 키 예시 정렬.
- `cloud-run/README.md`, `cloud-run/ai-engine/README.md`, `docs/development/docker.md`, `docs/development/environment-variables.md`: Cloud Build 권위, GitLab CI shell executor, local Docker preflight/Compose 보조 역할 설명 정리.
- `reports/planning/dead-code-sentry-cleanup-plan.md`: 기존 trailing whitespace 1건을 blank line으로 정리해 `git diff --check` 통과.

## 검증 결과

- `cd cloud-run && docker compose config --quiet` — PASS
- `npm run docs:budget` — PASS
- `npm run docs:ai-consistency` — PASS
- `git diff --check` — PASS
- stale marker 검색(`APP_VERSION=8.0.0`, `vibe-network`, legacy `docker-compose up`, placeholder `GOOGLE_API_KEY`) — PASS
