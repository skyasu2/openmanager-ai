> Owner: project
> Status: Completed
> Last reviewed: 2026-05-10

# AI Assistant Command Guidance Resource Intent Plan

- 상태: Completed
- 작성일: 2026-05-10
- TODO.md 연결: Active Tasks > AI 명령어 추천 resource intent 우선순위 개선
- 근거 QA: `QA-20260510-0439` Q1, `QA-20260510-0440` 후속 정적 분석

## 목표

AI Assistant가 "디스크 용량 확보", "메모리 정리", "CPU 확인"처럼 리소스 문제와 명령어 요청이 결합된 질문을 받을 때, 서버 이름에 포함된 서비스 키워드(`mysql`, `redis`, `nfs`)보다 사용자가 요청한 문제 도메인(`disk`, `memory`, `cpu`)을 우선해 실행 가능한 명령어를 제시하도록 한다.

## 범위

- 포함:
  - `recommendCommands` command catalog의 resource intent 우선순위 보강
  - service command fast-path의 disk/capacity cleanup 처리
  - generic keyword(`서버`, `확인`)가 특정 서비스 명령을 과도하게 끌어올리는 문제 완화
  - deterministic fast-path와 tool recommendation 양쪽 회귀 테스트 추가
- 제외:
  - 실제 운영 서버 명령 실행
  - 외부 LLM 호출 기반 QA 자동화
  - Vercel/Cloud Run 인프라 스펙 변경
  - Reporter report pipeline의 command template 전면 개편

## 정적 분석 결과

### 확인된 결함

1. `db-mysql-dc1-primary 디스크 86%, 용량 확보 명령어는?`
   - 현재 키워드: `["mysql", "디스크", "용량"]`
   - 현재 결과: `SHOW FULL PROCESSLIST`, `slow_query_log`
   - 문제: 디스크 용량 확보 요청인데 MySQL 진단 쿼리가 응답을 독점한다.

2. `storage-nfs-dc1-01 디스크 88%, 용량 확보 명령어는?`
   - 현재 키워드: `["nfs", "디스크", "용량"]`
   - 현재 결과: `findmnt`, `showmount`, `mount -t nfs`
   - 문제: NFS 마운트 확인/재마운트가 우선되고 파일시스템 용량 확보 명령이 빠진다.

3. `api-was-dc1-01 CPU 높은데 확인 명령어는?`
   - 현재 키워드: `["확인", "cpu"]`
   - 현재 추천 후보: `findmnt -t nfs`, `status check`, `top -o cpu`
   - 문제: `확인` 같은 일반 키워드가 NFS 명령과 매칭된다.

4. `서버 정리 명령어`
   - 현재 키워드: `["서버", "정리"]`
   - 현재 추천 후보: `showmount -e <nfs-server>`, `list servers`, `clear cache`
   - 문제: `서버` 일반 키워드가 NFS export 명령을 끌어올리고, `clear cache`는 대상과 안전성이 불명확하다.

### 영향 범위

- user-facing surface: AI sidebar, fullscreen AI Assistant
- backend path:
  - `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.ts`
  - `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-command-catalog.ts`
  - `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-command-tool.ts`

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-command-catalog.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-command-tool.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-multi-fallback.test.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 기대 동작 |
|----------|-----------|-----------|-----------|
| `extractCommandKeywordsFromQuery` | `string` | `string[]` | resource intent와 service keyword를 모두 보존 |
| `getCommandRecommendations` | `string[]` | `CommandRecommendation[]` | resource cleanup intent가 있으면 service-only 후보 제한보다 resource 명령 우선 |
| `buildServiceCommandGuidanceAnswer` | `string` | `string \| null` | 명령어형 resource cleanup 질문은 deterministic answer 가능 |
| `recommendCommands.execute` | `{ keywords: string[] }` | recommendations payload | 일반 키워드만으로 특정 서비스 명령을 잘못 우선하지 않음 |

### 테스트 시나리오

- [ ] 디스크 용량 확보 + MySQL 서버명: `df -h`, `du -...` 계열을 먼저 제시하고 MySQL processlist가 응답을 독점하지 않는다.
- [ ] 디스크 용량 확보 + NFS 서버명: `df -h`, `du -...`, inode/log usage 확인을 먼저 제시하고 `mount -t nfs`는 기본 조치로 앞세우지 않는다.
- [ ] MySQL slow query 확인: 기존 MySQL command path를 유지한다.
- [ ] Nginx 5xx 경로 확인: 기존 Nginx access-log command path를 유지한다.
- [ ] CPU 확인 명령어: `top`/`ps` 계열이 우선하고 `findmnt`가 끼지 않는다.
- [ ] 일반 서버 정리 명령어: `서버` 같은 범용 키워드만으로 NFS export 명령을 추천하지 않는다.

## 개선 설계

1. Resource intent를 service keyword보다 먼저 판정한다.
   - disk cleanup: `디스크|disk|용량|capacity|space|확보|정리|cleanup`
   - memory cleanup: `메모리|memory|OOM|정리|cache`
   - cpu inspection: `CPU|부하|프로세스|확인`

2. 명령 카탈로그를 최소 확장한다.
   - disk diagnose: `df -h`, `du -xhd1 / 2>/dev/null | sort -hr | head -20`, `df -ih`
   - disk cleanup candidates: `journalctl --disk-usage`, `journalctl --vacuum-time=7d`, `apt-get clean`
   - database supplemental: MySQL datadir/binlog/table size 확인은 보조로만 제시

3. 일반 키워드의 매칭 가중치를 낮춘다.
   - `서버`, `확인`, `상태`는 단독으로 service-specific command를 선택하지 않게 한다.
   - 서비스명과 고유 action keyword가 함께 있을 때만 service-specific command를 우선한다.

4. 위험 명령어 표현을 분리한다.
   - 읽기 전용 진단, 비교적 안전한 정리, 위험 조치를 응답 문구에서 분리한다.
   - 삭제/재마운트/재시작 계열은 사전 확인 문구 없이는 우선 제시하지 않는다.

## Task 목록

- [x] Task 0 — command guidance 회귀 테스트 추가
- [x] Task 1 — resource intent 우선순위와 generic keyword scoring 보강
- [x] Task 2 — disk/capacity command catalog 확장
- [x] Task 3 — fast-path/direct response 회귀 테스트 통과 확인
- [x] Task 4 — AI Engine type-check/test 및 root contract smoke
- [x] Task 5 — QA tracker에 local deterministic QA 기록

## 완료 결과

- 구현:
  - disk/capacity cleanup intent가 `mysql`, `nfs` 같은 service keyword보다 우선하도록 조정
  - `확인`, `서버` 같은 범용 키워드가 NFS 등 service-specific 명령을 잘못 끌어오지 않도록 matching 보강
  - service context가 없는 일반 메모리 압박은 Redis 명령이 아니라 host memory 명령(`free -h`, `%mem` 정렬, `vmstat`)으로 응답
  - resource-only command guidance(`디스크 용량 확보 명령어`)도 deterministic fast-path에서 처리
- QA 기록: `QA-20260510-0441`
- 배포 상태: 로컬 구현/검증 완료. Production 반영은 다음 release/deploy 단계에서 별도 수행.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1-3 | `fix(ai):` | ✅ | ✅ | 필요 시 |
| Task 4-5 | — | ✅ | 판단 필요 | 판단 필요 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 테스트가 QA-0439 Q1과 유사 결함을 정확히 고정하는지 |
| Task 1-3 완료 후 | service-specific 명령어 기존 동작 보존, 위험 명령어 우선순위 |
| Task 4-5 완료 후 | QA tracker pending 해소 여부, production 배포 필요성 |

## 완료 기준

- [x] `knowledge-command-tool.test.ts` 신규/기존 테스트 통과
- [x] service command direct-response 테스트 통과
- [x] `npm run type-check` 또는 AI Engine type-check 통과
- [x] AI Engine targeted test 통과
- [x] `npm run test:contract` 통과
- [x] QA tracker pending `ai-disk-cleanup-command-relevance` 완료 처리
