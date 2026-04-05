# GitLab 이전 가능성 분석 (Historical)

> Owner: skyasu2
> Status: Archived Supporting
> Doc type: Reference
> Last reviewed: 2026-04-06
> Canonical: n/a
> Tags: infrastructure, gitlab, migration, ci-cd

> ⚠️ 이 문서는 **이전 사전 검토 기록**입니다.  
> 현재 운영 기준 SSOT는 `docs/development/ci-cd.md`, `docs/guides/ai/ai-standards.md`, `AGENTS.md`를 따릅니다.

## 요약

본 문서는 GitLab 이전 이전 단계에서 작성된 사전 타당성 분석입니다.

**현재 상태(2026-04-05 기준): GitLab canonical 전환 완료.**  
현재 Frontend production 배포는 `git push gitlab main` 이후 GitLab CI가 `vercel build --prod` + `vercel deploy --prebuilt --prod`를 실행하는 경로를 사용합니다.

## 당시 GitHub 종속성 (사전 분석 시점)

| 구분 | 사용량 | 이전 영향 |
|------|--------|----------|
| Actions 워크플로우 | 9개 (1,091줄) | `.gitlab-ci.yml`로 전량 재작성 |
| Actions 마켓플레이스 | `actions/*` 31회, `codeql-action`, `dependabot/*` | GitLab 내장 기능 또는 대체 |
| Dependabot | 5그룹 + auto-merge | Renovate Bot으로 교체 |
| `gh` CLI | 4개 파일 | `glab` CLI 또는 API 직접 호출 |
| GitHub Secrets | ~10개 | GitLab CI/CD Variables로 수동 이전 |
| 코드 내 `GITHUB_*` 참조 | 3파일 8회 (OAuth 등) | 최소 수정 |

## 당시 가정: Vercel 자동 배포 호환성

Vercel은 **GitHub, GitLab, Bitbucket** 3개 Git 프로바이더를 공식 지원.

- GitLab 이전 시 Vercel Dashboard에서 GitLab 프로젝트 import → 자동 배포 유지 가능
- `vercel.json`, 함수 설정, 환경변수 **변경 불필요**
- MR(Merge Request)별 Preview 배포도 자동 지원

현재 운영에서는 위 자동 연동 대신, **Vercel Git Integration을 해제**하고 GitLab CI 경유 배포를 사용합니다.

## CI 워크플로우 전환 매핑

| GitHub Actions | GitLab CI 대응 |
|----------------|---------------|
| `ci-optimized.yml` (코어 게이트) | `stages: [quality, test, e2e, deploy-ready]` |
| `codeql-analysis.yml` (SAST) | GitLab SAST (`include: Security/SAST.gitlab-ci.yml`) — Free tier 제한적 |
| `dependabot-auto-merge.yml` | Renovate Bot `renovate.json` + `automerge: true` |
| `keep-alive.yml` (Supabase ping) | `scheduled pipeline` (cron) |
| `branch-cleanup.yml` | `scheduled pipeline` + `glab` CLI |
| `docs-quality.yml` | `rules: changes:` 트리거 |
| `quality-gates.yml` | `when: manual` job |
| `prompt-eval.yml` | `when: manual` job |
| `release-manual.yml` | `scheduled pipeline` + `when: manual` |

## 핵심 차이점

### CI 무료 한도 부족

- GitHub Free: **2,000분/월** (현재 ~530분 사용, 73% 여유)
- GitLab Free: **400분/월** → 현재 사용량으로 **즉시 초과**
- 해결: Self-hosted GitLab Runner 추가 (무료, 별도 서버 필요)

### 보안 스캔

- GitHub: CodeQL (무료, 모든 플랜)
- GitLab: SAST Free tier에서 제한적. CodeQL 수준은 Ultimate($99/user/mo) 필요
- 대안: Semgrep OSS를 CI job으로 직접 실행

### Dependabot → Renovate

```json
// renovate.json (Renovate Bot 설정 예시)
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "packageRules": [
    { "groupName": "typescript-types", "matchPackagePatterns": ["typescript", "@types/*"] },
    { "groupName": "testing", "matchPackagePatterns": ["vitest", "@vitest/*", "@testing-library/*"] },
    { "groupName": "ai-sdk", "matchPackagePatterns": ["ai", "@ai-sdk/*"] }
  ],
  "automerge": true,
  "automergeType": "pr",
  "automergeStrategy": "squash"
}
```

## 이전 절차 (당시 예상)

| 단계 | 작업 | 소요 |
|:----:|------|:----:|
| 1 | GitLab에서 GitHub 프로젝트 import | 10분 |
| 2 | Vercel Dashboard에서 Git provider를 GitLab으로 변경 | 10분 |
| 3 | GitLab CI/CD Variables에 시크릿 복사 | 30분 |
| 4 | `.gitlab-ci.yml` 작성 (9개 워크플로우 통합) | 1~2일 |
| 5 | Renovate Bot 설정 (`renovate.json`) | 2시간 |
| 6 | `gh` CLI → `glab` CLI 스크립트 수정 | 1시간 |
| 7 | CI 파이프라인 검증 + E2E 테스트 | 반나절 |
| **합계** | | **~3일** |

## 영향 없는 항목

- Cloud Run AI Engine: Git 호스팅과 무관, `deploy.sh`로 독립 배포
- Supabase: 외부 SaaS, 영향 없음
- `vercel.json`: 변경 불필요
- 코드 내 Vercel 환경변수: 변경 불필요 (Vercel이 자동 주입)

## 이전이 합리적인 시나리오

- 조직 정책으로 GitHub 사용 불가
- GitLab Self-managed로 보안/컴플라이언스 강화 필요
- Self-hosted Runner로 CI 비용 완전 제거 목적

## 참고

- Vercel Git Integration: `https://vercel.com/docs/git`
- GitLab CI/CD: `https://docs.gitlab.com/ci/`
- Renovate Bot: `https://docs.renovatebot.com/`
