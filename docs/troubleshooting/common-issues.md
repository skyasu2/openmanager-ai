# Common Issues

> 자주 발생하는 빌드/API/CI 문제의 증상별 해결 가이드
> Owner: documentation
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-04-25
> Canonical: docs/troubleshooting/common-issues.md
> Tags: troubleshooting,issues,debugging

## Build and Type Errors

### Symptoms
- `npm run build` 실패
- TypeScript strict 오류

### Actions
```bash
npm run type-check
npm run lint
npm run test:quick
npm run build
```

- `npm run type-check`가 로컬에서 중단되면 wrapper가 `SIGINT`/`SIGTERM` 또는 timeout과 경과 시간을 출력한다.
- 반복 timeout이면 `scripts/dev/tsc-wrapper.js` 로그 기준으로 orphan `tsc`가 남는지 먼저 확인하고, 그다음 `scripts/dev/typecheck-changed.sh`로 변경 범위를 좁혀 재현한다.
- 필요하면 `TSC_WRAPPER_TIMEOUT_MS=60000 npm run type-check`처럼 opt-in timeout으로 local full check를 제한할 수 있다.

## API Route Mismatch

### Symptoms
- 문서 엔드포인트와 실제 API가 다름

### Actions
```bash
find src/app/api -name 'route.ts' -o -name 'route.tsx' | wc -l
```
- API 기준 문서: `docs/reference/api/endpoints.md`
- 소스 오브 트루스: `src/app/api/**/route.ts*`

## Cloud Run Connectivity

### Symptoms
- `/api/ai/supervisor` 응답 지연/실패

### Actions
- `CLOUD_RUN_AI_URL` 환경변수 확인
- `src/app/api/ai/supervisor/route.ts`에서 프록시 에러 로그 확인
- `/api/ai/wake-up`로 cold-start 완화 확인

## GitLab CI Runner Executor Transition

### Symptoms
- `ci: route all jobs to wsl2-docker` 같은 executor 전환 직후 tag deploy가 연속 실패
- `deploy` job이 `Missing required GitLab CI variable: VERCEL_TOKEN`로 즉시 종료
- `deploy_ai_engine` job이 `gcloud: command not found` 또는 권한 오류로 실패
- shared runner에서는 되던 `npm install -g` / `image:` 기반 job이 shell runner에서 갑자기 깨짐

### Cause
- shared Docker runner에서 self-hosted shell runner로 바꾸면 실행 전제가 달라진다.
- shell executor에서는 `.gitlab-ci.yml`의 `image:`가 적용되지 않는다.
- protected CI 변수는 protected branch뿐 아니라 protected tag에도 맞아야 semver tag pipeline에서 노출된다.
- host에 설치된 `node`, `npm`, `vercel`, `gcloud`와 `gitlab-runner` 사용자 권한이 곧 배포 환경이 된다.

### Actions
```bash
# 1) GitLab deploy 준비 상태 점검
npm run gitlab:deploy:check

# 2) runner 자체 상태 확인
bash scripts/ci/runner-health-check.sh

# 3) runner 사용자의 실제 PATH / 권한 확인
sudo -u gitlab-runner -H bash -lc 'whoami && which node npm vercel gcloud && npm config get prefix'
```

- GitLab `Protected tags`에 `v*.*.*`가 있는지 확인한다.
- GitLab CI/CD variables의 `VERCEL_TOKEN`, `GCP_SERVICE_KEY`, `GCP_PROJECT_ID`가 tag pipeline에 노출되는지 확인한다.
- shell executor 전환 시 `image: node:*`, `image: google/cloud-sdk:slim` 같은 선언은 무시된다고 가정한다.
- `npm install -g`가 필요하면 `gitlab-runner` 사용자 기준 writable prefix를 먼저 준비하거나, host에 미리 설치한다.
- `gcloud`가 사용자 홈 아래 설치돼 있으면 홈 디렉터리 execute 권한과 runner PATH를 같이 확인한다.
- deploy 복구 중에는 `--silent` 옵션을 제거해 실제 stderr를 먼저 본다.
- executor 전환은 `main` 직접 반영 전에 별도 branch/MR pipeline에서 `deploy`와 `deploy_ai_engine`를 한 번씩 dry-run한다.

### Checklist
- 비용 절감 목표와 executor 전환을 같은 커밋에서 처리하지 않는다.
- `validate`만 green이라고 deploy 전제가 맞는 것으로 판단하지 않는다.
- semver tag deploy를 쓰면 protected tag + protected variable 조합을 먼저 점검한다.
- 상세 운영 구조와 현재 runner 정책은 `docs/development/ci-cd.md`를 기준으로 본다.

## Docs Link Breakage

### Symptoms
- 문서 내 링크 클릭 시 404

### Actions
```bash
npm run docs:check
```

## Git / IDE Remote Confusion

### Symptoms
- VS Code Git Graph or SCM UI가 계속 GitHub `origin` 기준처럼 보임
- 현재 브랜치는 `gitlab/main`을 추적하는데도 IDE 링크가 GitHub로 열림
- GitLab로 옮겼는데도 "아직 GitHub가 canonical 인가?"라는 혼선이 생김

### Cause
- 이 저장소는 `gitlab=canonical private repo`, `github-public=GitHub public snapshot` 구조를 권장한다.
- 기존 로컬 clone은 `origin=GitHub public snapshot` legacy 구성을 아직 유지할 수 있다.
- 일부 IDE/확장은 remote provider 해석에서 `origin`을 우선 보여준다.
- 따라서 GitHub 링크가 보이는 것만으로 canonical upstream이나 배포 권한이 GitHub라는 뜻은 아니다.

### Actions
```bash
# 1) 현재 canonical 추적 상태 확인
git remote -v
git branch -vv
git config --get branch.main.remote
git config --get remote.pushDefault

# 2) 저장소 토폴로지 설명 확인
bash scripts/git/show-topology.sh doctor

# 3) 로컬 Git metadata에서 gitlab HEAD도 명시
git remote set-head gitlab main

# 4) GitHub 공개 remote를 origin에서 분리 (권장)
npm run git:rename-public-remote

# 5) checkout/switch 모호성에서 gitlab 우선
git config --local checkout.defaultRemote gitlab
```

- 정상 기준:
  - `main` upstream은 `gitlab/main`
  - `remote.pushDefault`는 `gitlab`
  - GitHub public remote는 `github-public`이 권장
  - `origin`은 legacy fallback 으로 남아 있어도 동작은 함
- 주의:
  - `origin`을 GitLab로 재지정하지 않는다.
  - GitHub 공개 갱신은 `npm run sync:github`로만 수행한다.
  - Frontend canonical 배포는 `git push gitlab main` 이후 GitLab CI가 담당한다.
- Git Graph 표시가 거슬리면 로컬 IDE 설정에서 아래 값을 사용한다:

```jsonc
{
  "git-graph.repository.onLoad.showCheckedOutBranch": true,
  "git-graph.repository.onLoad.showSpecificBranches": [
    "main",
    "remotes/gitlab/main"
  ],
  "git-graph.repository.showRemoteHeads": false
}
```

- 참고:
  - `.vscode/settings.json`은 현재 git ignore 대상이라 위 설정은 기본적으로 로컬 전용이다.
  - Git Graph 공식 설정 문서: https://docs.mhutchie.com/vscode-git-graph/general/extension-settings
- 상대 경로 링크 사용
- 존재하지 않는 문서는 제거하거나 canonical 문서로 대체

## WSL Interop Issues

### `gh auth login -w` 브라우저 안 열림 (WSLInterop 누락)

```
증상: grep: /proc/sys/fs/binfmt_misc/WSLInterop: No such file or directory
      WSL Interopability is disabled.
```

**원인**: `/etc/wsl.conf`에 `[interop]` 섹션 누락 + binfmt_misc 엔트리 미등록.

**해결**:
```bash
# 1. /etc/wsl.conf에 interop 추가
sudo tee -a /etc/wsl.conf <<'EOF'

[interop]
enabled=true
appendWindowsPath=true
EOF

# 2. PowerShell에서 WSL 재시작
wsl --shutdown

# 3. 재시작 후에도 WSLInterop 파일 없으면 수동 등록
sudo sh -c 'echo ":WSLInterop:M::MZ::/init:PF" > /proc/sys/fs/binfmt_misc/register'

# 4. 확인
cat /proc/sys/fs/binfmt_misc/WSLInterop  # enabled 출력되면 정상
```

**대안 1 (권장)**: 브라우저 자동 열기 실패 시 디바이스 코드를 수동 입력:
```bash
gh auth login -h github.com -p ssh --web
# 터미널 코드 복사 → https://github.com/login/device 직접 열어 입력
```

**대안 2**: 브라우저 인증이 불가하면 Classic PAT 사용:
```bash
gh auth login -h github.com -p ssh --insecure-storage
# → "Paste an authentication token" 선택
```

### `gh auth status` 실패인데 `gh api user`는 성공

```
증상: gh auth status -> token invalid
      gh api user -q .login -> 계정명 정상 출력
```

**원인**: 셸의 `GITHUB_PERSONAL_ACCESS_TOKEN`이 `gh` 저장 자격증명(`~/.config/gh/hosts.yml`)보다 우선 사용되어 상태가 엇갈림.

**해결**:
```bash
# 1) 환경변수 영향 제거 후 실제 저장 자격증명 확인
env -u GITHUB_PERSONAL_ACCESS_TOKEN gh auth status -h github.com
env -u GITHUB_PERSONAL_ACCESS_TOKEN gh api user -q .login

# 2) 현재 셸에서 혼입 제거
unset GITHUB_PERSONAL_ACCESS_TOKEN

# 3) 셸 시작 스크립트에서 자동 export 제거
rg -n "GITHUB_PERSONAL_ACCESS_TOKEN" ~/.bashrc ~/.profile ~/.zshrc 2>/dev/null

# 4) GitHub public remote URL도 SSH로 통일 (권장)
git remote set-url github-public git@github.com:`owner`/`repo`.git
# legacy origin 사용 중이면 아래도 가능
git remote set-url origin git@github.com:`owner`/`repo`.git
```

### `github-auth-helper.cjs setup`가 바로 실패함

```
증상: Setup 실패: ENCRYPTION_KEY가 필요합니다.
```

**원인**: PAT 파일 저장 helper는 더 이상 기본 암호화 키를 사용하지 않습니다. `ENCRYPTION_KEY` 없이 실행하면 실패가 정상입니다.

**해결**:
```bash
# 1) 세션에 직접 암호화 키 지정
export ENCRYPTION_KEY='long-random-passphrase'

# 2) PAT 저장
GITHUB_PAT=ghp_placeholder node scripts/test/github-auth-helper.cjs setup

# 3) push 시에도 같은 ENCRYPTION_KEY 필요
node scripts/test/github-auth-helper.cjs push main
```

권장 경로는 여전히 `gh auth login` 또는 SSH 인증입니다. `github-auth-helper.cjs`는 브라우저 인증이 막힌 예외 환경에서만 사용합니다.

## Docker / Container Issues

> 상세: [Docker 개발 환경 가이드](../development/docker.md)

### `docker: command not found` (WSL)

Docker Desktop이 WSL Integration을 제공하지 않는 상태.

```
Docker Desktop → Settings → Resources → WSL Integration
→ Ubuntu-24.04: ON → Apply & Restart
```

### `docker compose up` 빌드 실패

```bash
# 캐시 무시하고 클린 빌드
docker compose build --no-cache
docker compose up

# 또는 전체 정리 후 재빌드
docker compose down --rmi local --volumes
docker compose up --build
```

### 포트 8080 충돌

```bash
# 8080 사용 중인 프로세스 확인
lsof -i :8080

# 다른 포트로 실행 (docker-compose.yml의 ports 수정 없이)
docker compose run --service-ports -p 9090:8080 ai-engine
```

### Container OOM (메모리 부족)

AI Engine은 512MB 제한. `NODE_OPTIONS` heap이 384MB로 설정되어 있어 정상 범위 내.

```bash
# 컨테이너 메모리 사용량 확인
docker stats ai-engine-local
```

OOM 반복 시 `docker-compose.yml`의 `deploy.resources.limits.memory`를 `768M`으로 임시 증가 가능 (프로덕션 Cloud Run은 512Mi 고정).

### `gcloud builds submit` 실패

```bash
# 인증 확인
gcloud auth list

# 프로젝트 설정 확인
gcloud config get-value project

# Artifact Registry 권한 확인
gcloud artifacts repositories list --location=asia-northeast1
```

> Cloud Build는 GCP 서버에서 Docker 빌드를 수행하므로 로컬 Docker 상태와 무관합니다.

## Langfuse Issues

> 상세: [Observability 가이드](../guides/observability.md)

### Langfuse 이벤트가 대시보드에 안 보임

1. **쿼터 초과 (자동 차단) 확인**
```bash
curl -H "X-API-Key: $CLOUD_RUN_API_SECRET" \
  https://ai-engine-xxx.run.app/monitoring | jq '.langfuse'
# isDisabled: true → 월 45,000 이벤트 초과로 자동 차단됨
# → 다음 달 1일에 자동 리셋
```

1. **API 키 확인**
```bash
curl -H "X-API-Key: $CLOUD_RUN_API_SECRET" \
  https://ai-engine-xxx.run.app/monitoring/traces
# 401/403 → LANGFUSE_SECRET_KEY 또는 LANGFUSE_PUBLIC_KEY 오류
```

1. **모듈 미설치** — Cloud Run 로그에서 `[Langfuse] Module not installed` 검색. 이 경우 no-op 모드로 동작하며 이벤트가 전송되지 않음.

### Langfuse 사용량 급증

- 기본 샘플링: 10% (무료 티어 기준 안전, 필요 시 `LANGFUSE_SAMPLE_RATE`로 조정)
- 대응: `LANGFUSE_TEST_MODE` 환경변수 제거 확인, Cloud Run 로그에서 `⚠️ [Langfuse]` 경고 확인

## Sentry Issues

> 상세: [Observability 가이드](../guides/observability.md)

### Sentry에 에러가 안 보임

1. **개발 환경인지 확인** — Sentry는 `production`에서만 활성화됩니다.
```bash
curl http://localhost:3000/api/debug/sentry-test?action=info | jq '.sentry.enabled'
# false → 정상 (개발 환경)
```

1. **DSN 설정 확인**
```bash
curl -H "x-api-key: $TEST_API_KEY" \
  "https://...vercel.app/api/debug/sentry-test?action=info" | jq '.sentry.dsn'
# "configured" → 정상, "missing" → 환경변수 확인 (fallback DSN이 있으므로 보통 configured)
```

1. **테스트 에러 전송으로 확인**
```bash
curl -H "x-api-key: $TEST_API_KEY" \
  "https://...vercel.app/api/debug/sentry-test?action=error"
# → Sentry 대시보드에서 "Sentry Test Error" 확인 (1-2분 소요)
```

### Sentry Tunnel 오류

클라이언트 에러가 Sentry에 도달하지 않는 경우:
```bash
# Tunnel 엔드포인트 직접 확인
curl -X POST https://...vercel.app/api/sentry-tunnel
# → 400 Bad Request 면 정상 (빈 body)
# → 404 면 라우트 문제
```

## Related

- [Troubleshooting Home](./README.md)
- [Observability 가이드](../guides/observability.md)
- [System Architecture](../reference/architecture/system/system-architecture-current.md)
- [API Endpoints](../reference/api/endpoints.md)
