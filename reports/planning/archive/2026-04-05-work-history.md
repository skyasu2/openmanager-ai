# Work History - 2026-04-05

- 날짜: 2026-04-05
- 성격: 작업 이력(참조용)
- 목적: GitHub public snapshot sync 회귀 원인, 복구, 재발 방지 결과를 기록

## 완료 작업

1. `main` 브랜치 오염 원인 분석 및 정본 복구
- 로컬 `main`이 public snapshot 커밋 `f65ff84ac`로 이동한 상태를 확인했고, `git reflog` 기준 직접 원인이 `reset: moving to FETCH_HEAD`였음을 확인했다.
- `gitlab/main` 기준 커밋 `612a7f853`로 로컬 `main`을 복구하고, 복구 전 상태를 백업 브랜치로 보존했다.
- 실행 환경 메모: 문제 재현/작업 맥락은 Windows 환경에서 Antigravity + Gemini 3.1 Pro 사용 중 발생했다. 다만 기술적 직접 원인은 환경 자체가 아니라 저장소에 대해 실행된 `git reset`과 기존 sync 스크립트의 히스토리 연결 취약점이다.
- 관련 커밋/브랜치:
  - `backup-snapshot-main-f65-20260405`
  - `backup-canonical-main-612a-20260405`

2. `github-sync.sh` 히스토리 연결 로직 수정
- 기존 로직은 새 임시 저장소에서 `git reset "$(git rev-parse FETCH_HEAD)"`를 사용해 unborn branch 상태에서 원격 히스토리 연결이 실패할 수 있었다.
- 이를 `update-ref refs/heads/main FETCH_HEAD` + `symbolic-ref HEAD refs/heads/main` + `reset --mixed`로 교체해, 기존 GitHub 히스토리를 먼저 HEAD에 정상 연결한 뒤 diff를 계산하도록 수정했다.
- 관련 커밋/파일:
  - `0ffb12bc2` `fix(sync): link existing github history before snapshot diff`
  - `scripts/sync/github-sync.sh`

3. 회귀 테스트 추가 및 실경로 재검증
- fake git 기반 단위 테스트에 "fetched GitHub history를 연결하되 `rev-parse FETCH_HEAD` 경로는 다시 타지 않는다"는 회귀 케이스를 추가했다.
- 실제 저장소에서도 `SYNC_GITHUB_ALLOW_DIRTY=1 npm run sync:github`를 실행해, 수정된 로직이 `기존 히스토리에 연결됨` 후 `변경 없음 — GitHub가 이미 최신 상태입니다.`로 종료하는 것을 확인했다.
- 관련 커밋/파일:
  - `95abf4ef6` `test(sync): cover github history link regression`
  - `tests/unit/dev/github-sync.test.ts`

## 결정/보류

- 결정: GitHub 공개 스냅샷 동기화는 계속 `npm run sync:github`로만 수행한다. `git push origin` 직접 실행은 금지한다.
- 결정: Windows/WSL/외부 에이전트 환경에서도 canonical repo에 대해 `origin/main` 또는 `FETCH_HEAD` 기준 `reset`/`checkout`을 직접 실행하지 않는다.
- 결정: public snapshot 관련 로직 변경 시 단위 테스트와 실제 `sync:github` 재검증을 함께 수행한다.
- 보류: 비추적 조사 디렉터리 `test2/`, `test_repo/`, `test_repo3/`, `test_repo4/` 정리 여부는 별도 판단한다.

## 다음 작업 방향

1. 필요 시 위 비추적 조사 디렉터리를 정리하고 작업트리를 다시 clean 상태로 맞춘다.
2. 이후 공개 스냅샷 갱신이 필요할 때는 현재 수정된 `sync:github` 경로만 사용한다.
3. 유사 작업을 Windows/Antigravity/Gemini 등 외부 에이전트에서 재수행할 경우, canonical remote가 `gitlab`임을 먼저 확인하고 branch 이동/복구 명령은 별도 검토 후 실행한다.
