# GitLab CI/CD 설정 가이드

> 작성일: 2026-03-31
> 목적: validate → deploy 파이프라인 활성화 절차

---

## 구조 요약

```
git push gitlab main (코드 변경 포함)
    ↓
GitLab CI 트리거
    ├── Stage 1: validate (type-check + lint + test:quick) ~3분
    └── Stage 2: deploy (vercel build + deploy) ~4분  ← validate 성공 시만
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
