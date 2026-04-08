# GitLab CI/CD 설정 가이드

> 작성일: 2026-03-31
> 목적: validate → deploy 파이프라인 + WSL2 self-hosted runner 설정

---

## 구조 요약

```
git push gitlab main (코드 변경 포함)
    ↓
GitLab CI main pipeline 트리거
    └── Stage 1: validate (type-check + lint + test:quick)
          └── tags: [wsl2-docker] → self-hosted runner 0분 소진

git push --follow-tags gitlab main (release tag 포함)
    ↓
GitLab CI semver tag pipeline 트리거
    ├── Stage 2: deploy (vercel build + deploy)
    ├── Stage 3: deploy_ai (cloud-run/ai-engine)
    └── Stage 4: smoke
          └── tags: [wsl2-docker] → self-hosted runner 0분 소진
```

docs/reports/QA 아티팩트 전용 push → CI 스킵 (분 소진 없음)

---

## Step 1: Vercel Token 발급

1. https://vercel.com/account/tokens 접속
2. "Create Token" → 이름: `gitlab-ci` → Scope: `openmanager-vibe-v5` 프로젝트
3. 발급된 토큰 값 복사 (한 번만 표시됨)

---

## Step 2: GitLab CI Variables 등록

GitLab 프로젝트 → Settings → CI/CD → Variables → "Add variable"

| Variable | Value | Protected | Masked |
|----------|-------|:---------:|:------:|
| `VERCEL_TOKEN` | (Step 1에서 발급한 토큰) | ✅ | ✅ |
| `VERCEL_ORG_ID` | `team_DdU5kNZmstk2visthKS7MGSe` | ✅ | ❌ |
| `VERCEL_PROJECT_ID` | `prj_WmjP9vVJ1ZlIiSK6O5kuSOuVW7CP` | ✅ | ❌ |

> **Protected**: main 브랜치에서만 사용 가능 (보안)
> **Masked**: 로그에서 값 가림 (VERCEL_TOKEN만)

---

## Step 3: Vercel Git Integration 해제

GitLab push → Vercel 자동 배포가 CI와 병렬로 실행되는 것을 막기 위해 해제합니다.

1. https://vercel.com/skyasus-projects/openmanager-vibe-v5/settings/git 접속
2. "Git Repository" 섹션 → "Disconnect" 클릭
3. 확인 다이얼로그 → 연결 해제

> ⚠️ 해제 후부터는 GitLab CI deploy job이 유일한 배포 경로입니다.
> CI가 실패하면 배포되지 않습니다.

---

## Step 4: 첫 번째 CI 실행 확인

```bash
# 코드 파일 변경 후 push
git push gitlab main

# GitLab 파이프라인 확인
# https://gitlab.com/skyasu2/openmanager-ai/-/pipelines
```

파이프라인 상태:
- `validate` ✅ → `deploy` ✅ → 배포 완료
- `validate` ❌ → `deploy` 실행 안 됨 → 배포 차단

---

## 분 소진 예산 관리

| 상황 | 소진 | 비고 |
|------|:----:|------|
| docs/reports 전용 push | 0분 | CI 스킵 규칙 적용 |
| 코드 변경 push | ~7분 | validate(3) + deploy(4) |
| validate 실패 시 | ~3분 | deploy 미실행 |
| 월 한도 | 400분 | 코드 push ~57회 여유 |

---

## 롤백

배포에 문제가 생기면:

```bash
# Vercel 이전 배포로 즉시 롤백 (Vercel 대시보드)
# Deployments 탭 → 이전 배포 선택 → "Promote to Production"

# 또는 GitLab에서 이전 커밋으로 revert 후 push
git revert HEAD
git push gitlab main
```

---

## 로컬 검증 (변경 없음)

기존 로컬 CI 체계는 그대로 유지됩니다:

```bash
npm run ci:local:docker        # 전체 Docker 검증 (push 전 권장)
npm run validate:all           # 빠른 로컬 검증
HUSKY=0 git push gitlab main   # hook 스킵 (긴급 시)
```

---

## Phase 2: WSL2 Self-hosted Runner 설정 (분 소진 0)

> 목적: GitLab CI job을 WSL2 shell runner로 실행 → shared runner 분 소진 없음
> 환경: Ubuntu 24.04 LTS + systemd + Docker Desktop WSL2 integration

### Step 5: GitLab Runner 토큰 발급

1. https://gitlab.com/skyasu2/openmanager-ai/-/settings/ci_cd 접속
2. Runners → "New project runner" 클릭
3. 설정:
   - OS: Linux
   - Tags: `wsl2-docker` (체크 필수 - .gitlab-ci.yml과 일치해야 함)
   - Description: `WSL2 Docker Runner`
   - Run untagged jobs: ❌ (체크 해제)
4. "Create runner" → 표시된 토큰(`glrt-xxxxxxxxxxxx`) 복사

### Step 6: Runner 설치 및 등록

```bash
# WSL2 터미널에서 실행
bash scripts/ci/setup-gitlab-runner.sh glrt-xxxxxxxxxxxx
```

스크립트가 자동으로 수행:
1. gitlab-runner 설치 (apt)
2. shell executor로 runner 등록
3. systemd 서비스 등록 및 시작
4. GitLab 연결 verify

### Step 7: 동작 확인

```bash
# 서비스 상태 확인
sudo systemctl status gitlab-runner

# 등록된 runner 목록
sudo gitlab-runner list

# GitLab 연결 상태
sudo gitlab-runner verify

# 코드 변경 후 push → validate가 wsl2-docker runner에서 실행되는지 확인
git push gitlab main
```

파이프라인 확인: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines
- validate job → Runner: `wsl2-docker` 표시

---

## Runner 운영 요약 (Phase 2 이후)

| 상황 | validate | deploy | 분 소진 |
|------|----------|--------|:------:|
| WSL2 가동 중 | self-hosted (0분) | self-hosted (0분) | 0분 |
| WSL2 꺼짐 | pending (대기) | tag pipeline pending 또는 직접 배포 fallback 필요 | 0분 |
| 긴급 직접 배포 | validate 없음 | `vercel --prod` | GitLab 0분 |

> WSL2가 꺼진 상태에서 push하면 validate job이 runner를 기다리며 pending 상태가 됩니다.
> 릴리즈 tag 배포에서 protected 변수를 쓰려면 GitLab protected tags에 `v*.*.*`를 함께 등록해야 합니다.
