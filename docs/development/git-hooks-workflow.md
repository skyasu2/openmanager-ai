# Git Hooks 워크플로우 가이드

> Git Hooks와 CI 검증 계층 운영 방법을 설명하는 개발 가이드
> Owner: dev-experience
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-05-05
> Canonical: docs/development/git-hooks-workflow.md
> Tags: git,hooks,cicd,workflow
>
> Pre-commit, Pre-push, CI/CD 최적화 베스트 프랙티스 (2026년 기준)

## 개요

이 프로젝트는 **3단계 검증 계층**을 사용합니다:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Git Workflow Pipeline                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ [코드 작성] → [Pre-commit] → [Commit] → [Pre-push] → [Push] → [GitLab CI] │
│                  <1초          즉시       <10초(기본)   + 로컬 Docker CI │
│                                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                         │
│  │ 빠른 검증 │   │ 정책     │   │ 권위있는 │                         │
│  │ (로컬)   │ → │ 가드      │ → │ 전체검증 │                         │
│  │ Lint+    │   │ (pre-push)│   │ (CI/CD)  │                         │
│  │ Secrets  │   │          │   │          │                         │
│  └──────────┘   └──────────┘   └──────────┘                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Pre-commit Hook (목표: <1초)

### 위치 및 내용

**`.husky/pre-commit`**:
```sh
#!/bin/sh

# 1. 🔐 Secret Detection (빠름 - staged 파일만)
node scripts/env/precommit-check-secrets.cjs || exit 1

# 2. 🔍 Biome (Check & Format)
echo "🔍 Running Biome (Check & Format)..."
npm run hook:pre-commit || {
  echo "❌ Biome check failed"
  exit 1
}

exit 0
```

### 검증 항목

| 항목 | 도구 | 목적 | 시간 |
|------|------|------|------|
| **Secret Detection** | `precommit-check-secrets.cjs` | API 키/토큰 유출 방지 | ~94ms |
| **Lint + Format** | Biome | 코드 스타일 일관성 | ~500ms |

### Secret Detection 패턴

```javascript
const PATTERNS = [
  // API Keys
  { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'Anthropic API Key', pattern: /sk-ant-[a-zA-Z0-9-]{20,}/ },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z-_]{35}/ },
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/ },

  // Webhooks
  { name: 'Slack Webhook', pattern: /hooks\.slack\.com\/services\/.../ },
  { name: 'Discord Webhook', pattern: /discord(?:app)?\.com\/api\/webhooks\/.../ },

  // Private Keys
  { name: 'RSA Private Key', pattern: /-----BEGIN RSA PRIVATE KEY-----/ },
  { name: 'SSH Private Key', pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/ },

  // Database URLs with credentials
  { name: 'Database URL', pattern: /(?:mysql|postgres|mongodb):\/\/[^:]+:[^@]+@/ },

  // Supabase JWT
  { name: 'Supabase Service Role Key', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{50,}/ }
];
```

### 제외 파일

```javascript
const SKIP_FILES = [
  /\.env\.example$/,        // 예제 파일
  /\.md$/,                  // 문서
  /package-lock\.json$/,    // 락 파일
  /\.test\.(ts|js)x?$/,     // 테스트
  /__mocks__\//,            // 목
  /precommit-check-secrets\.cjs$/  // 스캐너 자체
];
```

---

## Pre-push Hook (목표: fast 기본 <10초)

### 위치 및 설정

**`scripts/hooks/pre-push.js`**

### 동작 모드

| 모드 | 환경변수 | 검증 항목 | 시간 |
|------|---------|----------|------|
| **Fast (기본)** | `PRE_PUSH_MODE=fast` 또는 미지정 | canonical remote/main 보호, node_modules, GitLab CI semantic, Cloud Build free-tier, docs/report artifact | ~3-10초 |
| **Verify** | `PRE_PUSH_MODE=verify` | Fast + 변경 범위 기반 테스트 + TypeScript | ~20-100초 |
| **Strict** | `PRE_PUSH_MODE=strict` | Verify + runner health/release advisory | Verify + α |
| **Skip All** | `HUSKY=0` | 없음 | 0초 |

### Fast Mode (기본값)

```bash
git push
```

기본 pre-push는 **빠른 go/no-go 정책 가드**만 실행합니다.  
무거운 로컬 검증은 필요 시에만 명시적으로 실행합니다.

### Verify / Strict Mode

```bash
# 로컬 테스트 + 타입체크까지 포함
PRE_PUSH_MODE=verify git push

# verify + runner/release advisory
PRE_PUSH_MODE=strict git push

# verify/strict 모드에서만 legacy 플래그 적용
QUICK_PUSH=false PRE_PUSH_MODE=verify git push
STRICT_PUSH_ENV=true PRE_PUSH_MODE=verify git push
```

### 검증 항목 상세

```
┌─────────────────────────────────────────────────────────┐
│                  Pre-push 검증 체인                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. node_modules 상태 검증                               │
│     └─ 필수 패키지 존재 여부                             │
│     └─ WSL/Windows 바이너리 호환성                       │
│                                                          │
│  2. 변경 범위 분류 기반 테스트                           │
│     └─ targeted node / targeted DOM                      │
│     └─ related node / related DOM                        │
│     └─ DOM infrastructure smoke                          │
│     └─ docs/report-only push는 테스트 생략 가능          │
│                                                          │
│  3. TypeScript 검증                                      │
│     └─ 관련 TS 파일이 있을 때만 실행                     │
│     └─ soft-timeout 시 Vercel/로컬 Docker CI로 위임 가능 │
│                                                          │
│  4. Cloud Build Guard (변경 파일 있을 때만)              │
│     └─ cloudbuild.yaml / deploy.sh 변경 시만 검사        │
│                                                          │
│  5. 환경변수 검증 (STRICT_PUSH_ENV=true + verify/strict) │
│     └─ npm run env:check                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

> `scripts/dev/vitest-main-wrapper.js`는 zero-test DOM related 실행에서만 알려진 Vite dep-scan 노이즈를 단일 note로 축약합니다. 실제 테스트 실패/경고는 그대로 출력됩니다.

---

## CI/CD (GitLab Canonical)

### 역할 분담

| 계층 | 역할 | 책임 |
|------|------|------|
| **Pre-commit** | 빠른 피드백 | 포맷팅, 시크릿 감지 |
| **Pre-push** | 빠른 정책 가드 | push 전 즉시 차단해야 하는 정책 위반 |
| **GitLab CI** | 권위있는 검증/배포 게이트 | validate, semver tag deploy, smoke |
| **Vercel** | Frontend 배포 대상 | GitLab CI `deploy` job이 호출 |

### 외부 CI 최소화 정책

```yaml
# historical GitHub workflow reference
on:
  # 🚫 primary delivery path 아님
  # GitLab CI + Vercel deploy target 기준으로 운영
  workflow_dispatch:
    inputs:
      reason:
        description: '수동 빌드 사유'
```

**이유**:
- 현재는 Vercel Git Integration이 해제되어 있고 GitLab CI가 배포 권위
- Vercel은 GitLab CI `deploy` job이 호출하는 production target으로만 사용
- GitHub Actions 중복 빌드 = 불필요한 비용/혼선
- GitHub public remote는 배포 source가 아니라 snapshot

---

## 환경별 검증 비교

### 베스트 프랙티스 (2026년 기준)

| 항목 | Pre-commit | Pre-push | CI/CD |
|------|:----------:|:--------:|:-----:|
| **Lint** | ✅ | ⚪ | ✅ |
| **Format** | ✅ | ⚪ | ⚪ |
| **Secret Detection** | ✅ | ⚪ | ✅ |
| **TypeScript** | ⚪ | ⚪ (verify/strict에서만) | ✅ |
| **Unit Tests** | ⚪ | ⚪ (verify/strict에서만) | ✅ (전체) |
| **Full Build** | ⚪ | ⚪ | ✅ |
| **E2E Tests** | ⚪ | ⚪ | ✅ |
| **배포** | ⚪ | ⚪ | ✅ |

### 업계 표준 비교

```
┌────────────────────────────────────────────────────────────────┐
│ Claude Code 공식 권장사항 (Anthropic)                          │
├────────────────────────────────────────────────────────────────┤
│ • Pre-commit: <1초 목표                                        │
│ • Pre-push: 가벼운 검증 (Full build는 CI로)                    │
│ • CI: 권위있는 검증 (모든 테스트, 빌드, 배포)                  │
├────────────────────────────────────────────────────────────────┤
│ 현재 프로젝트 점수: 9/10                                       │
│ ✅ Pre-commit <1초                                             │
│ ✅ Pre-push Fast Guard-Only 기본값                             │
│ ✅ Secret Detection                                            │
│ ✅ CI/CD 자동화 (GitLab CI + Vercel deploy target)             │
└────────────────────────────────────────────────────────────────┘
```

---

## 우회 방법 (필요 시)

### Hook 일시 우회

```bash
# 모든 Hook 우회 (긴급 상황만)
HUSKY=0 git push

# verify 모드에서 테스트만 스킵
SKIP_TESTS=true PRE_PUSH_MODE=verify git push

# verify 모드에서 빌드 검증만 스킵
SKIP_BUILD=true PRE_PUSH_MODE=verify git push

# node_modules 검사 스킵
SKIP_NODE_CHECK=true git push
```

### 주의사항

- `HUSKY=0`은 모든 검증을 우회하므로 **긴급 상황에만** 사용
- 우회 시 CI/CD가 최종 검증 수행
- 반복적 우회 필요 시 Hook 설정 검토 필요

---

## 트러블슈팅

### Secret Detection 오탐

```
증상: "SECRET DETECTED" 하지만 실제 시크릿 아님
해결:
1. SKIP_FILES 패턴에 파일 추가
2. 또는 해당 패턴이 실제로 필요한지 검토
```

### Pre-push 타임아웃

```
증상: Pre-push가 5분 이상 소요
해결:
1. 기본 모드 확인: `PRE_PUSH_MODE=fast`
2. node_modules 상태 확인: npm ci
3. WSL 메모리 설정 확인: .wslconfig
```

### TypeScript 에러

```
증상: "TypeScript check failed"
해결:
1. npm run type-check로 에러 확인
2. 수정 후 다시 push
3. 긴급 시: HUSKY=0 git push gitlab main 후 GitLab CI validate 상태를 확인하고, 실제 deploy가 필요하면 `./scripts/release/publish.sh patch|minor|major` 경로로 이어서 수행
```

---

## 성능 최적화 히스토리

| 날짜 | 변경 | 효과 |
|------|------|------|
| 2026-04-09 | `PRE_PUSH_MODE=fast` 기본 전환 | 무거운 로컬 검증 opt-in화, push 대기시간 안정화 |
| 2026-01-27 | QUICK_PUSH 기본값 true로 변경 | Push 407s → 78s (5.2x 개선) |
| 2026-01-27 | Secret Detection pre-commit 추가 | 보안 강화, 94ms 추가 |
| 2026-01-27 | 외부 CI 자동 트리거 최소화 | CI 비용 절감 |

---

## 도구 검토 메모 (2026-02-16)

- `Entire CLI` 도입은 보류했습니다.
- 보류 사유:
  - 공식 통합 대상이 현재 워크플로 핵심(Codex/ChatGPT)과 직접 일치하지 않음
  - 현재 Husky 기반 검증 파이프라인과 훅 소유권 충돌 가능성 존재
  - 포트폴리오 레포 목적상 신규 도구 도입보다 기존 품질 게이트 안정화가 우선
- 재검토 조건:
  - 공식 통합 대상 확장(또는 Codex/ChatGPT 공식 지원)
  - 훅 충돌 없는 마이그레이션 가이드 확보

---

## 관련 파일

| 파일 | 용도 |
|------|------|
| `.husky/pre-commit` | Pre-commit Hook |
| `scripts/hooks/pre-push.js` | Pre-push Hook |
| `scripts/ci/local-ci.sh` | 로컬 전체 CI (GitLab shell executor 동등) |
| `scripts/env/precommit-check-secrets.cjs` | Secret Scanner |
| `scripts/hooks/post-commit.js` | 커밋 완료 알림 출력 |
| `.gitlab-ci.yml` | canonical validate/deploy/smoke pipeline |

---

## 관련 문서

- [코딩 표준](./coding-standards.md)
- [테스트 전략](../guides/testing/test-strategy.md)
- [Deployment Guide](../operations/deployment-guide.md)
- [배포 토폴로지](../reference/architecture/system/system-architecture-current.md#9-deployment-topology)

---

_Last Updated: 2026-05-05_
