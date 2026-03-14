# CI/CD 파이프라인 & 의존성 관리

> GitHub Actions 기반 CI/CD 파이프라인과 Dependabot 자동 의존성 관리 가이드
> Owner: platform-devops
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-03-14
> Canonical: docs/development/ci-cd.md
> Tags: ci,cd,github-actions,dependabot,automation

## 개요

이 프로젝트는 **9개 GitHub Actions 워크플로우** + **Dependabot 자동 의존성 관리**로 CI/CD를 운영합니다.

```
코드 변경 → CI/CD Core Gates (자동) → Vercel 자동 배포
                                    → Cloud Run 수동 배포 (deploy.sh)

의존성 업데이트 → Dependabot PR 생성 → Patch: 자동 머지 / Minor+: 수동 리뷰
```

### 비용 정책

- **GitHub Free Tier**: Public 리포지토리 = 무제한 Actions 분
- **Vercel**: 자체 Git 연동 빌드 (GitHub Actions 불필요)
- **Cloud Run**: `deploy.sh` + Cloud Build (120분/일 무료)

---

## Part 1: CI/CD 워크플로우 (9개)

### 워크플로우 전체 맵

| # | 워크플로우 | 파일 | 트리거 | 역할 |
|---|----------|------|--------|------|
| 1 | **CI/CD Core Gates** | `ci-optimized.yml` | Push/PR (main, develop) | 🔒 **핵심 차단형 CI** |
| 2 | **Quality Gates** | `quality-gates.yml` | 매주 월요일 / 수동 | 📊 정기 품질 점검 |
| 3 | **Simple Deploy** | `simple-deploy.yml` | 수동 전용 | 🚀 빌드 검증 (Vercel 대체) |
| 4 | **Dependabot Auto-Merge** | `dependabot-auto-merge.yml` | Dependabot PR | 🤖 패치 자동 머지 |
| 5 | **Branch & PR Cleanup** | `branch-cleanup.yml` | 매주 월요일 / 수동 | 🧹 브랜치/PR 정리 |
| 6 | **Keep Services Alive** | `keep-alive.yml` | 주 2회 (수/일) | 💓 Supabase 비활성화 방지 |
| 7 | **Prompt Evaluation** | `prompt-eval.yml` | AI 프롬프트 변경 PR / 수동 | 🔬 Promptfoo 테스트 |
| 8 | **Docs Quality** | `docs-quality.yml` | docs 변경 / 매주 월요일 | 📝 문서 품질 검증 |
| 9 | **Release Manual** | `release-manual.yml` | 수동 전용 | 🏷️ 버전/태그/CHANGELOG 릴리즈 |

---

### 1. CI/CD Core Gates (`ci-optimized.yml`) — 핵심 게이트

**가장 중요한 워크플로우.** 모든 PR과 main/develop 푸시 시 자동 실행.

```
Push/PR
  ├── code-quality (차단형)
  │   ├── Biome Check
  │   └── TypeScript Check
  │
  ├── unit-tests (차단형)
  │   └── npm run test
  │
  ├── e2e-critical (차단형)
  │   └── npm run test:e2e:critical
  │
  ├── security-scan (main/PR 차단형)
  │   └── Hardcoded Secrets Check
  │
  └── deployment-ready (게이트)
      └── 위 차단형 job 통과 시 → ✅ 배포 준비 완료
```

**NPM 429 에러 대응**: CI 환경에서 npm registry 429 (Rate Limit) 에러가 빈번하므로, retry 로직이 내장되어 있습니다:
- 최대 3회 재시도
- 15→25→35초 증분 대기
- 실패 시 npm cache 강제 정리

**스킵 조건**:
- `[skip ci]`가 커밋 메시지에 포함된 push → 완전 스킵
- `docs/**`, `**/*.md` 변경 → paths-ignore로 자동 제외

**동시성 제어**:
```yaml
concurrency:
  group: ci-core-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # 같은 브랜치의 이전 실행 자동 취소
```

---

### 2. Quality Gates (`quality-gates.yml`) — 정기 품질 점검

매주 월요일 오전 7시(KST) 자동 실행. 또는 수동 실행 가능.

| Job | 검사 항목 |
|-----|----------|
| TypeScript Zero-Error Gate | `npm run type-check` 에러 0개 강제 |
| Hook Dependencies Check | Biome 정적 분석 |
| Architecture Health | 대형 컴포넌트 탐지 (500줄+), 순환 의존성 검사 |

**아키텍처 건강성** 검사는 코드 복잡도가 점진적으로 증가하는 것을 방지합니다:
- `find src/components -name "*.tsx" | wc -l > 500` → 경고
- `madge --circular` → 순환 참조 검출

---

### 3. Simple Deploy (`simple-deploy.yml`) — 수동 빌드 검증

**현재 비활성화 상태.** Vercel이 main 브랜치 자동 배포를 수행하므로 GitHub Actions에서 별도 빌드가 불필요합니다.

```yaml
on:
  workflow_dispatch:  # 수동 실행만 가능
  # push: [main]     # ← 비활성화됨
```

수동 실행 시 전체 빌드 → TypeScript 체크 → 테스트 → Lint를 순차 검증합니다.

---

### 4. Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

→ [Part 2: Dependabot 의존성 관리](#part-2-dependabot-의존성-관리) 참조

---

### 5. Branch & PR Cleanup (`branch-cleanup.yml`) — 자동 정리

매주 월요일 오전 9시(KST) 실행.

| Job | 역할 |
|-----|------|
| 🧹 Stale Branch Cleanup | 30일 이상 미사용 원격 브랜치 탐지 (보호 브랜치 제외) |
| 📦 Dependabot PR Status | 7일 이상 미처리 Dependabot PR 경고 |
| 🗑️ Merged Branch Cleanup | 이미 main에 병합된 브랜치 탐지 |
| 📊 Weekly Summary | GITHUB_STEP_SUMMARY에 종합 리포트 |

> 자동 삭제는 수행하지 않고 **탐지 + 리포트**만 수행합니다. 삭제는 수동으로 진행합니다.

---

### 6. Keep Services Alive (`keep-alive.yml`) — 비활성화 방지

**목적**: Supabase 무료 티어는 **1주일 미사용 시 프로젝트 자동 일시 정지(Pause)**. 이를 방지하기 위해 주 2회 ping을 보냅니다.

- **Supabase Ping**: REST API에 `apikey` 헤더로 요청 → HTTP 200 확인
- **Vercel Health Ping**: `/api/health` 엔드포인트 상태 확인

스케줄: 매주 **수요일 + 일요일** 09:00 KST.

---

### 7. Prompt Evaluation (`prompt-eval.yml`) — AI 프롬프트 품질

AI Engine의 프롬프트가 변경될 때 [Promptfoo](https://promptfoo.dev/)로 자동 평가합니다.

```
cloud-run/ai-engine/promptfoo/** 변경 → Promptfoo eval 실행
cloud-run/ai-engine/src/agents/** 변경 → Promptfoo eval 실행
```

- 기본 평가: `promptfooconfig.yaml` 기반
- Red-team 보안 테스트: 수동 실행 시 `run_redteam: true` 옵션으로 활성화
- 결과: GitHub Artifacts에 30일간 보관

---

### 8. Docs Quality (`docs-quality.yml`) — 문서 품질

`docs/` 변경 시 또는 매주 월요일 자동 실행.

| 검사 | 내용 |
|------|------|
| `docs:check` | Markdown 구조, Diataxis 분류, 메타데이터 검증 |
| `docs:lint:changed` | 변경된 문서만 Markdown lint |
| 버전 정합성 | `CLAUDE.md`, `GEMINI.md`에 `package.json` 버전 반영 확인 |
| 외부 링크 | 매주 스케줄 실행 시만 전체 외부 링크 유효성 검사 |

---

### 9. Release Manual (`release-manual.yml`) — 수동 릴리즈

무료 티어 비용을 늘리지 않도록 **workflow_dispatch(수동 실행)** 전용으로 운영합니다.

- 입력값: `release_type` (`patch|minor|major`), `dry_run` (`true|false`)
- 실행 흐름:
  - `npm ci`
  - `npm run release:<type>` (또는 `release:dry-run`)
  - `npm run release:check` (태그/CHANGELOG/버전 + freshness required)
  - `git push --follow-tags`
- 제약: `main` 브랜치에서만 실행 허용

릴리즈 전 일상 배포는 기존과 동일하게 `main` push → Vercel 자동 배포로 처리합니다.

---

## Part 2: Dependabot 의존성 관리

### 설정 파일: `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'          # 1인 개발: 주 1회 적절
    open-pull-requests-limit: 5   # PR 폭탄 방지
    assignees: ['skyasu2']
    reviewers: ['skyasu2']
```

### 의존성 그룹화

관련 패키지를 묶어서 PR 수를 줄입니다:

| 그룹명 | 패턴 | 예시 |
|--------|------|------|
| `typescript-types` | `typescript`, `@types/*` | TypeScript 코어 + 타입 정의 |
| `testing` | `vitest`, `@vitest/*`, `playwright`, `@playwright/*` | 테스트 도구 |
| `linting` | `@biomejs/*` | 린팅/포매팅 |
| `react` | `react`, `react-dom`, `@types/react*` | React 생태계 |
| `ai-sdk` | `ai`, `@ai-sdk/*` | Vercel AI SDK |

### Auto-Merge 워크플로우

`.github/workflows/dependabot-auto-merge.yml`의 자동 머지 정책:

```
Dependabot PR 생성
  │
  ├── Patch (x.x.1 → x.x.2)
  │   └── CI 통과 → ✅ 자동 squash merge (gh pr merge --auto --squash)
  │
  └── Minor/Major (x.1.0 → x.2.0 or 1.x → 2.x)
      ├── "needs-review" 라벨 추가
      └── 코멘트: "⚠️ 수동 리뷰가 필요합니다"
```

### 결정 근거

| 정책 | 이유 |
|------|------|
| Patch 자동 머지 | Semantic Versioning에서 patch는 하위 호환 버그 수정만 포함 |
| Minor/Major 수동 리뷰 | Breaking change, API 변경 가능성 → 수동 검증 필요 |
| 주 1회 실행 | 1인 개발 환경에서 매일 업데이트는 과도한 부담 |
| 최대 5 PR | Dependabot PR이 쌓여 리뷰 부담이 되는 것 방지 |

---

## Part 3: 배포 전략

### Vercel (Frontend) — 자동 배포

```
main 브랜치 push → Vercel Git Integration → 자동 빌드 + 배포
                                            ↓
                                   Preview (PR) / Production (main)
```

- CI/CD Core Gates가 품질 게이트 역할
- Vercel이 자체적으로 빌드하므로 GitHub Actions에서 별도 빌드 불필요
- `SKIP_ENV_VALIDATION=true`로 환경변수 없이도 빌드 성공 보장
- Git push 경로는 SSH 원격(`git@github.com:...`) 사용을 권장

배포 트리거 전 인증 체크(혼입 방지):
```bash
env -u GITHUB_PERSONAL_ACCESS_TOKEN gh auth status -h github.com
env -u GITHUB_PERSONAL_ACCESS_TOKEN gh api user -q .login
git remote -v | head -n 2
```

### Cloud Run (AI Engine) — 수동 배포

```bash
cd cloud-run/ai-engine
bash deploy.sh
```

배포 파이프라인:
```
Free Tier 가드레일 검증 → 로컬 Docker 프리플라이트 → SSOT 데이터 동기화
  → Cloud Build (이미지 빌드) → Cloud Run 배포 → 헬스체크
  → 이전 이미지/리비전 자동 정리 (백그라운드)
```

---

## 관련 문서

- [프로젝트 셋업](./project-setup.md) - 로컬 개발 환경 설정
- [Docker 가이드](./docker.md) - Cloud Run 컨테이너 배포 상세
- [Git Hooks 워크플로우](./git-hooks-workflow.md) - 로컬 Git hooks
- [Free Tier 최적화](../reference/architecture/infrastructure/free-tier-optimization.md)

_Last Updated: 2026-02-17_
