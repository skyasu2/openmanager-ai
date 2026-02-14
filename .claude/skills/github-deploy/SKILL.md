---
name: github-deploy
description: GitHub push and PR workflow with MCP-first strategy and WSL-safe gh CLI fallback. Triggers on push, PR creation, or deployment requests.
version: v1.1.0
user-invocable: true
allowed-tools: Bash, Read, Grep, mcp__github__push_files, mcp__github__create_branch, mcp__github__create_pull_request, mcp__github__get_pull_request, mcp__github__list_commits, mcp__github__get_pull_request_status, mcp__github__merge_pull_request
---

# GitHub Deploy (MCP)

GitHub MCP 우선 + WSL gh CLI fallback 워크플로우.

## Trigger Keywords

- "/github-deploy"
- "/push"
- "push해줘"
- "PR 만들어줘"
- "깃허브 배포"
- "github push"
- "코드 푸시"
- "풀리퀘스트 생성"

## Context

- **Owner**: skyasu2
- **Repo**: openmanager-ai
- **Default Branch**: main
- **MCP**: `mcp__github__*` (GitHub MCP Server)

## Workflow

### 0) 사전 인증 점검 (WSL CLI 사용 시)

```bash
gh auth status -h github.com
gh auth setup-git
```

권장 인증 방식:
- HTTPS + `gh auth login -h github.com -p https -w`
- PAT는 임시 주입만 사용하고 `.bashrc` 상시 export는 피함

### Option A: Direct Push to main (CLI)

로컬 커밋을 원격에 그대로 push할 때:

#### 1. 로컬 변경사항 확인

```bash
# 미푸시 커밋 확인
git log origin/main..HEAD --oneline

# 변경 파일 목록
git diff origin/main..HEAD --name-only
```

#### 2. Push

```bash
git push origin main
```

#### 3. 동기화 확인 (비파괴)

```bash
git fetch origin
git status -sb
```

### Option B: Branch + PR (MCP 권장)

feature branch에서 PR을 만들 때:

#### 1. Branch 생성

`mcp__github__create_branch` 사용:
- owner: `skyasu2`
- repo: `openmanager-ai`
- branch: `feat/branch-name`
- from_branch: `main`

#### 2. 파일 Push (MCP)

`mcp__github__push_files`로 변경 파일 push:
- branch: 새로 만든 branch명

#### 3. PR 생성 (MCP)

`mcp__github__create_pull_request` 사용:
- owner: `skyasu2`
- repo: `openmanager-ai`
- title: conventional commit 형식
- head: feature branch
- base: `main`
- body: 변경사항 요약

#### 4. 결과 확인

`mcp__github__get_pull_request`로 PR 상태 확인.

### Option C: MCP Direct Push (fallback)

CLI 인증이 막혔거나 자동화가 필요한 경우:

- `mcp__github__push_files` 사용
  - owner: `skyasu2`
  - repo: `openmanager-ai`
  - branch: `main`
  - files: 변경된 파일 배열 `[{path, content}]`
  - message: 최신 커밋 메시지

**제한사항**:
- 텍스트 파일 중심, 대량 변경은 배치로 분할
- 삭제 파일 처리에는 CLI가 더 단순함

## Output Format

```
🚀 GitHub Deploy Results
├─ Method: MCP Push / PR / CLI
├─ Branch: main (또는 feature branch)
├─ Files: N개 pushed
├─ Commit: <hash> <message>
├─ PR: #N (Option B만)
└─ Status: ✅ Success / ❌ Failed
```

## Edge Cases

**Case 0: WSL에서 브라우저 로그인 창이 안 뜰 때**
- `https://github.com/login/device` 직접 접속 후 코드 입력
- 필요 시 `wslu` 설치 후 `BROWSER=wslview` 설정

**Case 1: 파일이 너무 많을 때 (>20개)**
- 배치로 나눠서 push (20개씩)
- 각 배치마다 별도 커밋 메시지

**Case 2: 바이너리 파일**
- GitHub MCP는 텍스트 파일만 지원
- 바이너리(.png, .woff 등)는 CLI push 필요

**Case 3: Conflict**
- `git fetch origin` 후 충돌 원인 확인
- 무단 `reset --hard`/force push 금지

**Case 4: 삭제된 파일**
- `push_files`는 파일 생성/수정만 지원
- 파일 삭제는 `create_or_update_file`로 처리 불가 → CLI 필요

## Success Criteria

- Push 완료 (원격에 반영)
- PR 생성 시 URL 반환
- 로컬-원격 동기화 상태

## Best-Practice Baseline

- GitHub CLI 인증/credential helper: https://cli.github.com/manual/gh_auth_login, https://cli.github.com/manual/gh_auth_setup-git
- PAT 최소 권한 원칙(Fine-grained): https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

## Changelog

- 2026-02-14: v1.1.0 - WSL GitHub auth 표준 반영 (gh auth + setup-git), 비파괴 동기화 규칙으로 개정
- 2026-02-12: v1.0.0 - Initial implementation
  - GitHub MCP 기반 push/PR 워크플로우
  - CLI fallback 지원
  - 배치 push 지원
