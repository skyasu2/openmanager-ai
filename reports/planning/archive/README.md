# Planning Archive

완료된 작업 계획의 운영 참조 기록.

## 원칙

- **계획서 버전 이력** → git history로 조회 (`git log -- reports/planning/next-tasks-plan.md`)
- **별도 스냅샷 저장 불필요** — git이 모든 버전을 보존
- 이 디렉토리에는 git만으로 조회하기 어려운 **운영 요약 기록**만 보관

## 보관 기준

| 유형 | 보관 | 이유 |
|------|------|------|
| 날짜별 work-history | ✅ 유지 | 큐레이션된 작업 요약, git log와 다른 시각 |
| next-tasks-plan 스냅샷 | ❌ 불필요 | git history로 충분 |
| 완료된 단순 계획서 | ❌ 불필요 | 코드+CHANGELOG에 이미 반영 |

## 작업 이력 (work-history)

| 파일 | 내용 |
|------|------|
| [2026-02-13](2026-02-13-work-history.md) | 2월 초반 작업 이력 |
| [2026-03-27](2026-03-27-work-history.md) | 3월 GitLab CI 설정, mirror 구성 |
| [2026-03-28](2026-03-28-work-history.md) | 3월 말 QA, useSystemStatus 테스트 |
| [2026-04-05](2026-04-05-work-history.md) | GraphRAG 리네임, Supabase bootstrap 수정 |
