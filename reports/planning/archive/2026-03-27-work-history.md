# Work History - 2026-03-27

- 날짜: 2026-03-27
- 성격: 작업 이력(참조용)
- 목적: GitLab canonical 정렬, GitHub 공개 스냅샷 분리, 로컬 CI 기준선 정리 결과를 기록

## 완료 작업

1. GitLab canonical / Vercel 배포 경로 고정
- `gitlab`을 정본 remote로 고정하고 `main -> gitlab/main`, `remote.pushDefault=gitlab`로 전환
- Vercel Frontend Git 배포가 GitLab `main` 기준으로 동작하는지 검증
- 관련 커밋/파일: `ff9822827`, `reports/planning/gitlab-canonical-delivery-plan.md`

2. 로컬 Docker CI 표준화
- GitLab SaaS CI 대신 로컬 Docker CI를 전체 검증 기준선으로 확정
- `scripts/ci/local-docker-ci.sh`, `CI_DOCKER_PULL_POLICY`, 관련 운영 문서 반영
- 관련 커밋/파일: `ff9822827`, `scripts/ci/local-docker-ci.sh`, `docs/development/ci-cd.md`

3. GitHub 공개 스냅샷 자동화 정리
- `scripts/sync/github-sync.sh`와 `.github-export-ignore`를 기준으로 공개 제외 규칙을 일원화
- dirty worktree / non-main 브랜치에서 기본 차단하도록 가드레일 추가
- 공개 README와 package.json 스크립트도 스냅샷용으로 후처리하도록 정리
- 관련 커밋/파일: `scripts/sync/github-sync.sh`, `.github-export-ignore`, `scripts/sync/assets/README.public.md`, `package.json`

4. 계획서 및 TODO 마감 정리
- public snapshot sync 자동화를 `Completed (2026-03-27)`로 이동
- 표준 워크플로를 `git push gitlab main` → `npm run sync:github`로 명시
- 작업 이력 템플릿 경로 문서화 오류 수정
- 관련 커밋/파일: `reports/planning/TODO.md`, `reports/planning/gitlab-canonical-delivery-plan.md`, `reports/planning/README.md`

## 결정/보류

- 결정: private 개발/배포의 기준선은 GitLab, public code snapshot은 GitHub로 분리 유지
- 결정: 외부 CI 의존은 최소화하고 broad/deploy-sensitive 변경은 로컬 Docker CI로 검증
- 보류: historical GitHub Actions 문서를 추가로 축소할지 여부는 별도 판단

## 다음 작업 방향

1. 기능 작업은 `gitlab/main` 기준으로 계속 진행
2. 공개 GitHub 갱신이 필요할 때만 `npm run sync:github` 실행
3. GitLab-native 상태 체크가 꼭 필요해질 때만 self-hosted runner + 최소 `.gitlab-ci.yml` 검토
