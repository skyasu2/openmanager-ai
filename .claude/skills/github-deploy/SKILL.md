---
name: github-deploy
description: GitHub push and PR workflow using GitHub MCP (no gh CLI auth needed). Triggers on push, PR creation, or deployment requests.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, mcp__github__push_files, mcp__github__create_branch, mcp__github__create_pull_request, mcp__github__get_pull_request, mcp__github__list_commits, mcp__github__get_pull_request_status, mcp__github__merge_pull_request
---

# GitHub Deploy (MCP)

GitHub MCP를 사용한 push/PR 워크플로우. `gh auth login` 없이 동작.

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

### Option A: Direct Push to main

로컬 커밋이 있고 main에 바로 push할 때:

#### 1. 로컬 변경사항 확인

```bash
# 미푸시 커밋 확인
git log origin/main..HEAD --oneline

# 변경 파일 목록
git diff origin/main..HEAD --name-only
```

#### 2. 변경 파일 수집

각 변경 파일의 내용을 읽어서 `mcp__github__push_files`로 일괄 push:

- `mcp__github__push_files` 사용
  - owner: `skyasu2`
  - repo: `openmanager-ai`
  - branch: `main`
  - files: 변경된 파일 배열 `[{path, content}]`
  - message: 최신 커밋 메시지

**제한사항**: 파일 수가 많으면 (>20개) 여러 번 나눠서 push.

#### 3. 로컬 동기화

```bash
git fetch origin
git reset --soft origin/main
```

### Option B: Branch + PR

feature branch에서 PR을 만들 때:

#### 1. Branch 생성

`mcp__github__create_branch` 사용:
- owner: `skyasu2`
- repo: `openmanager-ai`
- branch: `feat/branch-name`
- from_branch: `main`

#### 2. 파일 Push

`mcp__github__push_files`로 변경 파일 push:
- branch: 새로 만든 branch명

#### 3. PR 생성

`mcp__github__create_pull_request` 사용:
- owner: `skyasu2`
- repo: `openmanager-ai`
- title: conventional commit 형식
- head: feature branch
- base: `main`
- body: 변경사항 요약

#### 4. 결과 확인

`mcp__github__get_pull_request`로 PR 상태 확인.

### Option C: git push (CLI fallback)

`gh auth` 또는 SSH가 설정되어 있으면 CLI가 더 빠름:

```bash
git push origin main
```

실패 시 → Option A로 fallback.

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

**Case 1: 파일이 너무 많을 때 (>20개)**
- 배치로 나눠서 push (20개씩)
- 각 배치마다 별도 커밋 메시지

**Case 2: 바이너리 파일**
- GitHub MCP는 텍스트 파일만 지원
- 바이너리(.png, .woff 등)는 CLI push 필요

**Case 3: Conflict**
- push_files가 실패하면 conflict 가능성
- `git pull --rebase` 후 재시도

**Case 4: 삭제된 파일**
- `push_files`는 파일 생성/수정만 지원
- 파일 삭제는 `create_or_update_file`로 처리 불가 → CLI 필요

## Success Criteria

- Push 완료 (원격에 반영)
- PR 생성 시 URL 반환
- 로컬-원격 동기화 상태

## Changelog

- 2026-02-12: v1.0.0 - Initial implementation
  - GitHub MCP 기반 push/PR 워크플로우
  - CLI fallback 지원
  - 배치 push 지원
