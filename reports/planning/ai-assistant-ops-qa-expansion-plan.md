# AI 어시스턴트 운영 대응 QA 확장 계획

> Owner: project
> Status: In Progress
> Doc type: How-to
> Last reviewed: 2026-05-09
> Tags: qa,ai-assistant,operations,conversational-qa

---

## 배경 및 목적

현재 AI 어시스턴트 QA는 **서버 메트릭 모니터링 질문** 중심으로만 검증되었다.

```
현재 커버: "CPU 가장 높은 서버는?" → 수치 조회
부족한 부분:
  - 토폴로지 내 운영 중인 서비스에 대한 맥락 질문
  - 장애 상황에서의 기술 명령어 안내
  - 초보 엔지니어가 "이 상황에서 뭘 해야 하나?" 물었을 때의 실용적 응답
```

**핵심 목표**: AI 어시스턴트가 **초보 운영 엔지니어의 실질적인 보조 도구**로 작동하는지 검증한다.

---

## 계약 (Contract)

### 검증 대상 능력 3가지

| 능력 | 설명 | Pass 기준 |
|------|------|-----------|
| **A. 서비스 맥락 인식** | 토폴로지의 서비스(HAProxy/Nginx/MySQL/Redis 등)에 대한 질문에 해당 서비스 지식을 포함한 답변 제공 | 서비스명·역할 언급, 현재 메트릭과 연결된 답변 |
| **B. 기술 명령어 안내** | 장애 진단·점검 명령어를 실제로 사용 가능한 형태로 안내 | 구체적 CLI 명령어 포함 (예: `haproxy -f ... -c`, `mysql -e "SHOW PROCESSLIST"`), 오명령어 없음 |
| **C. 초보 운영자 유도** | 상황을 모르는 엔지니어에게 다음 행동(what to do next)을 단계별로 안내 | 1단계 이상의 구체적 조치 순서 포함, 과도한 기술 용어 없이 맥락 설명 |

### Pass/Fail 판단 기준

```
PASS  - 응답이 질문의 서비스/상황에 맥락적으로 맞음
      - 현재 메트릭 데이터와 연결된 근거 포함
      - 명령어 답변 시 실제 사용 가능한 형태
      - 조치 순서가 논리적

FAIL  - 다른 서비스 응답 (HAProxy 물었는데 MySQL 답변)
      - 존재하지 않는 옵션·플래그 포함 (hallucination)
      - "알 수 없음"만 반환하며 조치 유도 없음
      - raw JSON / tool-call 노출

WARN  - 응답이 맞지만 지나치게 일반적 (메트릭 수치 미활용)
      - 명령어가 맞지만 서버 환경(OS/버전) 미반영
```

---

## 테스트 시나리오

### 카테고리 A: 서비스 맥락 인식 (topology-aware)

| ID | 질문 | 검증 포인트 | 예상 근거 사용 |
|----|------|------------|---------------|
| A1 | `HAProxy가 지금 어떤 상태야? 백엔드 서버들 잘 분산되고 있어?` | HAProxy role, 현재 CPU 73% 수치 연결, 백엔드 분산 언급 | lb-haproxy-dc1-01 메트릭 |
| A2 | `MySQL primary 서버가 replica보다 부하가 훨씬 높은 이유가 뭘까?` | primary/replica 역할 차이 설명, 현재 부하 수치 비교 | db-mysql-dc1-primary vs replica 메트릭 |
| A3 | `Redis 캐시 서버 3대 중 가장 메모리 많이 쓰는 서버가 어디야?` | Redis 3대 비교, 메모리 수치 | cache-redis-dc1-01/02/03 메트릭 |
| A4 | `지금 웹 서버(Nginx) 3대가 고르게 트래픽 받고 있어?` | 웹 티어 역할 인식, 로드밸런싱 상태 | web-nginx-dc1-01/02/03 메트릭 |
| A5 | `스토리지 서버 디스크 사용량이 임계치 넘기 전에 미리 알 수 있어?` | storage 역할 인식, 현재 디스크 수치 + 예측 | storage-nfs 메트릭 |

### 카테고리 B: 기술 명령어 안내 (command guidance)

| ID | 질문 | 검증 포인트 | FAIL 조건 |
|----|------|------------|----------|
| B1 | `HAProxy에서 현재 연결된 백엔드 서버 목록이랑 상태 확인하는 명령어 알려줘` | `haproxy` 또는 `echo "show stat"` socat 명령어 포함 | 없는 플래그, MySQL 명령어로 대체 |
| B2 | `MySQL에서 현재 실행 중인 느린 쿼리 어떻게 확인해?` | `SHOW PROCESSLIST`, `SHOW VARIABLES LIKE 'slow_query%'` 또는 동등한 명령어 | 존재하지 않는 MySQL 옵션 |
| B3 | `Redis 메모리 사용량이 갑자기 증가할 때 어떤 키가 큰지 확인하는 방법은?` | `redis-cli --bigkeys` 또는 `MEMORY USAGE`, `SCAN` 패턴 포함 | 잘못된 redis-cli 옵션 |
| B4 | `Nginx 액세스 로그에서 5xx 에러가 많이 나는 경로 분석하는 방법 알려줘` | `awk`/`grep` + nginx access log 경로 포함 또는 동등한 방법 | 틀린 로그 경로 (`/var/log/httpd` 등 Apache 경로) |
| B5 | `NFS 마운트가 끊겼을 때 확인하고 재마운트하는 순서 알려줘` | `df -h`, `mount`, `showmount`, `mount -t nfs` 순서 포함 | 존재하지 않는 옵션 |

### 카테고리 C: 초보 운영자 유도 (beginner-ops guidance)

| ID | 질문 | 검증 포인트 | FAIL 조건 |
|----|------|------------|----------|
| C1 | `lb-haproxy-dc1-01 CPU가 73%인데 이거 위험한 거야? 뭘 해야 해?` | 현재 수치 평가 + 단계별 조치(확인→분석→대응) | "위험합니다"만 답하고 조치 없음 |
| C2 | `처음 운영 당직인데 알림이 울리면 어떤 순서로 확인해야 해?` | 1순위 확인 항목(알림 내용→서버 상태→로그 순서) 안내 | 추상적 답변만, 구체적 확인 항목 없음 |
| C3 | `MySQL primary-replica 구조에서 replication이 끊기면 어떻게 알 수 있어?` | `SHOW REPLICA STATUS` (또는 `SHOW SLAVE STATUS`), Seconds_Behind_Source 확인 | 명령어 없이 이론만 |
| C4 | `Redis 캐시 서버 메모리가 꽉 차면 어떻게 돼? 서비스에 어떤 영향이 있어?` | maxmemory-policy 설명 + 캐시 미스 → DB 부하 증가 흐름 설명 | 단순 "캐시가 지워집니다"만 |
| C5 | `지금 전체 시스템 상태를 한 줄 요약해줘. 당직 인수인계용으로` | 정상/주의 서버 수 + 주요 경고 항목 + 권고사항 포함 | 일반적 설명만, 수치 없음 |

---

## QA 실행 방법

### 실행 환경
- **플랫폼**: Vercel Production (`https://openmanager-ai.vercel.app`)
- **도구**: Playwright MCP (`mcp__playwright__*`) 또는 Playwright CLI runner
- **접근**: 게스트 로그인 → AI 어시스턴트 사이드바 또는 전체화면

### 판정 절차

```
1. 질문 전송
2. 응답 완료 대기 (최대 15초)
3. 응답 텍스트 추출
4. Pass/Fail/Warn 판정:
   a. 서비스명 맥락 포함 여부
   b. 명령어 시나리오: 명령어 syntactically valid 여부
   c. 초보 유도 시나리오: 조치 단계 포함 여부
5. 판정 근거 기록
```

### 허용 편차
- 명령어 대소문자, 플래그 순서 차이: WARN (오류 아님)
- 메트릭 수치가 ±10% 이내: PASS
- 응답이 길어서 스크롤 필요: PASS (기능 이슈 아님)

---

## Task 목록

- [x] **Task 1**: 계획서 Draft → Approved 전환 (사용자 검토 후)
- [x] **Task 2**: 카테고리 A (서비스 맥락 인식) 5개 질문 Playwright MCP 실행 및 판정
- [x] **Task 3**: 카테고리 B (기술 명령어 안내) 5개 질문 실행 및 hallucination 검증
- [x] **Task 4**: 카테고리 C (초보 운영자 유도) 5개 질문 실행 및 단계 구체성 판정
- [x] **Task 5**: 전체 15개 결과 QA 런 기록 (`npm run qa:record`)
- [x] **Task 6**: FAIL/WARN 항목 분석 — 코드 수정 필요 vs AI 응답 품질 한계 구분
- [x] **Task 7**: 필요 시 수정 후 재검증 (Task 2~5 반복) — v8.11.114 targeted retest 기록
- [ ] **Task 8**: 잔여 P1/P2 개선 — empty response timeout, HAProxy command surfacing, HAProxy context specificity

---

## QA-20260509-0428 실행 결과

- **환경**: Vercel Production (`https://openmanager-ai.vercel.app`)
- **도구**: Playwright CLI runner
- **기록**: `reports/qa/runs/2026/qa-run-QA-20260509-0428.json`
- **Raw evidence**: `reports/qa/evidence/qa-20260509-ai-ops-conversational-results.json`
- **결과**: PASS 7, WARN 3, FAIL 5

| 카테고리 | PASS | WARN | FAIL | 판정 |
|----------|------|------|------|------|
| A. 서비스 맥락 인식 | A2, A4 | A1, A3 | A5 | 일부 맥락 인식 가능하나 Redis 비교/스토리지 예측/빈 요약 실패 |
| B. 기술 명령어 안내 | B2, B3 | - | B1, B4, B5 | HAProxy 명령어 intent routing 실패, Nginx/NFS 질문 타임아웃 |
| C. 초보 운영자 유도 | C3, C4, C5 | C1 | C2 | 기본 설명 일부 가능하나 HAProxy 73% CPU와 초보 당직 순서에서 신뢰도 부족 |

### 실패/경고 원인 분류

| 분류 | 시나리오 | 판단 |
|------|----------|------|
| 빈 응답/타임아웃 | A5, B4, B5, C2 | 코드 수정 또는 AI response completion 경로 점검 필요 |
| 명령어 intent routing 실패 | B1 | HAProxy backend status 명령어 질문이 일반 서버 요약으로 처리됨 |
| tool-backed empty summary | A1, C1 | tool evidence는 있으나 "응답 본문이 비어 있어" fallback 노출 |
| 서비스 그룹 grounding 부족 | A3 | Redis 3대 메모리 비교 질문에서 대상 노드 식별 실패 |

### 후속 수정 후보

1. `/api/ai/supervisor/stream/v2` 또는 UI chat completion 경로에서 빈 본문/타임아웃 원인 확인
2. HAProxy/Nginx/NFS 운영 명령어 질문을 command-guidance intent로 고정하는 프롬프트/라우팅 보강
3. Redis/Storage 서비스 그룹 비교 질문이 서버 그룹 메트릭 조회로 연결되는지 contract test 추가
4. 수정 후 `QA-20260509-0428` 실패 5개 + WARN 3개만 targeted retest

### 2026-05-09 로컬 수정 진행

- command-guidance routing guard 추가:
  - HAProxy load-distribution 문맥의 `분산`이 math tool로 오인되지 않도록 routing test 추가
  - `뭘 해야 해`, `순서`, `재마운트` 등 beginner ops 표현을 Advisor 경로로 분류
- `recommendCommands` 서비스별 명령어 보강:
  - HAProxy runtime socket/status/config check
  - Nginx access log 5xx path aggregation
  - NFS mount 확인/export 확인/remount 순서
  - Redis bigkeys/MEMORY USAGE, MySQL processlist/slow query 기본 명령어
- 검증:
  - `cloud-run/ai-engine npm run type-check` PASS
  - `cloud-run/ai-engine npm test` PASS — 107 files / 1067 tests
- 남은 항목:
  - production 배포 후 `QA-20260509-0428` 실패 5개 + WARN 3개 targeted retest 완료 (`QA-20260509-0429`)
  - Redis 그룹 grounding(A3), empty response fallback(A1/C1) 개선 확인
  - storage 예측(A5), Nginx/NFS/초보 당직 타임아웃(B4/B5/C2), HAProxy 명령어 surfacing(B1), HAProxy 상태 상세도(A1) 잔여

## QA-20260509-0429 targeted retest 결과

- **환경**: Vercel Production v8.11.114 (`https://openmanager-ai.vercel.app`)
- **배포 근거**: GitLab tag pipeline `2510850169` success
- **도구**: Playwright CLI runner
- **기록**: `reports/qa/runs/2026/qa-run-QA-20260509-0429.json`
- **Raw evidence**: `reports/qa/evidence/qa-20260509-ai-ops-retest-v811114-results.json`
- **대상**: `QA-20260509-0428` 이전 WARN/FAIL 8개 (`A1,A3,A5,B1,B4,B5,C1,C2`)
- **결과**: PASS 2, WARN 1, FAIL 5

| 시나리오 | 이전 | 재검증 | 판정 |
|----------|------|--------|------|
| A1 HAProxy 상태/분산 | WARN | WARN | empty-summary fallback은 사라졌으나 CPU/백엔드 분산 상세 부족 |
| A3 Redis 메모리 비교 | WARN | PASS | `cache-redis-dc1-01/02` 43% 식별 |
| A5 Storage 임계치 예측 | FAIL | FAIL | visible answer 없이 타임아웃 |
| B1 HAProxy backend 명령어 | FAIL | FAIL | `recommendCommands` 분석 근거는 있으나 최종 답변은 generic 서버 요약 |
| B4 Nginx 5xx 경로 분석 | FAIL | FAIL | visible answer 없이 타임아웃 |
| B5 NFS 재마운트 순서 | FAIL | FAIL | visible answer 없이 타임아웃 |
| C1 HAProxy 73% CPU 초보 대응 | WARN | PASS | 단계별 조치 응답 반환 |
| C2 초보 당직 알림 순서 | FAIL | FAIL | visible answer 없이 타임아웃 |

### 재검증 후 open gap

| ID | Priority | 내용 | 다음 조치 |
|----|----------|------|-----------|
| `ai-ops-empty-response-timeout` | P1 | A5/B4/B5/C2가 프로덕션에서 계속 visible answer 없이 타임아웃 | stream empty-output fallback과 provider retry 경로를 mocked contract로 고정 후 수정 |
| `ai-ops-command-intent-routing` | P1 | B1에서 HAProxy 명령어 tool result가 최종 답변에 노출되지 않음 | `recommendCommands` 결과를 service-command 답변으로 deterministic하게 surface |
| `ai-ops-haproxy-context-specificity` | P2 | A1이 HAProxy 상태는 답하지만 현재 CPU/백엔드 분산 근거가 부족 | HAProxy group summary fallback에 CPU/분산 체크 포인트 포함 |

### 2026-05-09 command-guidance fast-path 로컬 수정

- 서비스 명령어 질의를 LLM 라우팅 전에 deterministic command catalog로 직접 응답하도록 보강:
  - HAProxy backend/status: `echo "show stat" | socat - /run/haproxy/admin.sock`, `systemctl status haproxy --no-pager`
  - Nginx 5xx path analysis: `/var/log/nginx/access.log` 기반 `awk`/`grep`
  - NFS mount/remount: `findmnt -t nfs`, `showmount -e <nfs-server>`, `mount -t nfs ...`
- command guidance 질의가 deterministic status summary로 치환되지 않도록 `isDeterministicSummaryQuery()`에서 제외
- 검증:
  - failing spec 확인 후 구현
  - targeted tests PASS — `orchestrator-context`, `orchestrator-summary-fallback`, `knowledge-command-tool`
  - AI Engine `type-check` PASS
  - AI Engine full test PASS — 107 files / 1070 tests
  - root `test:contract` PASS
- 남은 항목:
  - production 배포 후 `B1/B4/B5` command-guidance targeted retest
  - `A5/C2` empty response timeout은 command fast-path 범위 밖이라 별도 stream fallback/초보 당직 checklist 보강 필요

---

## 예상 결과 및 리스크

| 리스크 | 가능성 | 영향 | 대응 |
|--------|--------|------|------|
| 명령어 hallucination | 중간 | 초보 엔지니어 혼란 | FAIL 즉시 기록, 시스템 프롬프트 가이드 개선 검토 |
| 서비스 맥락 미인식 | 낮음 | 일반적 답변만 | system context 주입 경로 확인 |
| 응답이 너무 길어 실용성 저하 | 중간 | UX 불편 | WARN 기록, 향후 응답 포맷 개선 과제로 분류 |
| Cloud Run cold start로 타임아웃 | 낮음 | 테스트 중단 | 재시도 1회 허용 |

---

_Last Updated: 2026-05-09 — command-guidance routing 로컬 수정 및 AI Engine 검증 완료, production retest 대기_
