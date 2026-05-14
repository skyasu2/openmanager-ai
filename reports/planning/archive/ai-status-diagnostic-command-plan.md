> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-14

# AI Status Diagnostic Command Plan

- 상태: Completed
- 작성일: 2026-05-14
- TODO.md 연결: Active Tasks > AI 상태 답변 진단 명령어 보강
- 구현 착수 조건: 계약 섹션 리뷰 완료. 네트워크 metric은 현재 dominant metric에는 포함하지 않고 generic health/log 진단 fallback으로 고정한다.

## 목표

AI Assistant가 "현재 상태", "지금 조치 필요한 서버", "cache-redis-dc1-01 메모리 상태"처럼 운영 상태를 설명할 때 단순히 "로그 확인", "메모리 확인"이라고만 말하지 않고, 사용자가 바로 실행해볼 수 있는 읽기 전용 진단 명령어를 함께 제시한다.

핵심 원칙은 명령어 실행 자동화가 아니라 안전한 runbook 힌트 제공이다. AI는 명령어를 실행하지 않으며, 기본 응답에는 재시작, 삭제, 정리, 마운트, 설정 변경 같은 상태 변경 명령을 넣지 않는다.

```text
사용자 질문
  -> monitoring current metrics evidence
  -> deterministic status/action summary
  -> metric/server context
  -> read-only command catalog
  -> "진단 명령어" 섹션 추가
```

## 베스트 프랙티스 비교

| 자료 | 관련 기준 | 설계 반영 |
|------|-----------|-----------|
| [OWASP LLM05:2025 Improper Output Handling](https://genai.owasp.org/llmrisk/llm052025-improper-output-handling/) | LLM 출력이 downstream shell, code, browser, DB로 넘어갈 때 검증 없이 신뢰하면 command injection/RCE 같은 위험이 커진다. | LLM 자유 생성 명령어를 금지하고, 타입이 정해진 command catalog에서만 출력한다. 출력 전 안전 등급과 금지 패턴을 검증한다. |
| [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) | agent/tool 기능, 권한, 자율성이 과하면 예상치 못한 고영향 조치가 발생할 수 있다. 최소 기능, 최소 권한, 사용자 승인 기준이 필요하다. | 기본 답변은 read-only 진단 명령만 허용한다. mutating 명령은 별도 안전 등급으로 분리하고 명시 요청/승인 문구 없이는 노출하지 않는다. |
| [NIST AI RMF Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) / [NIST.AI.600-1 PDF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) | GAI 위험은 lifecycle 전반에서 govern/map/measure/manage로 다뤄야 하며, incident response와 TEVV 기록/검토가 필요하다. | 명령어 추천을 계약 변경으로 다루고, 안전 등급, 테스트 시나리오, QA evidence 기록을 계획 단계에서 고정한다. |
| [Google SRE Book: Emergency Response](https://sre.google/sre-book/emergency-response/) | 장애 대응은 준비, 반복 테스트, 명확한 절차, CLI/대체 접근 경로 숙지가 중요하다. 자동화 명령에는 sanity check가 필요하다. | 응답은 "무엇을 볼지"와 "어떤 명령으로 볼지"를 함께 제공한다. 단, 자동 조치가 아니라 사람이 확인할 수 있는 절차형 진단으로 제한한다. |

## 범위

- 포함:
  - `buildRequestedServerStatusAnswer()` 서버 상세 답변에 진단 명령어 섹션 추가
  - `buildActionNeededAnswer()` 조치 필요/주의 관찰 답변에 우선순위 서버별 진단 명령어 추가
  - command catalog에 `read-only`, `requires-approval`, `mutating` 안전 등급 추가
  - metric별 read-only command selector 추가
  - CPU, memory, disk, network, web/nginx, redis, mysql, nfs의 최소 진단 명령어 정리
  - AI Engine 회귀 테스트와 Vercel production Playwright MCP QA 시나리오 추가
- 제외:
  - 실제 운영 서버 명령 실행
  - 재시작, 삭제, vacuum, package clean, remount, cache clear 같은 조치 명령의 기본 노출
  - 프론트엔드 UI 재설계
  - Reporter/Analyst pipeline 전면 개편
  - Supabase/RAG corpus migration

## 현 상태 분석

이미 `knowledge-command-catalog.ts`에는 `free -h`, `ps aux --sort=-%mem | head -10`, `vmstat 1 5`, `df -h`, `df -ih`, `journalctl --disk-usage`, `top -o cpu`, `ps aux --sort=-%cpu | head -10` 같은 읽기 전용 명령어가 있다.

동시에 `journalctl --vacuum-time=7d`, `apt-get clean`, `mount -t nfs ...`, `service restart <service_name>`, `clear cache` 같은 상태 변경 명령도 같은 `CommandRecommendation` 타입에 섞여 있다. 그래서 상태 답변에 그대로 재사용하면 OWASP Excessive Agency 관점의 위험이 생긴다.

또한 일부 읽기 전용 명령도 운영 영향이 다르다. 예를 들어 `du -xhd1 / ...`, `redis-cli --bigkeys`, 대량 로그 `grep`은 데이터를 변경하지 않지만 I/O나 서비스 부하, 로그 민감정보 노출 가능성이 있다. 따라서 단순 `read-only` 여부와 별개로 `operationalRisk` 또는 `costHint`를 함께 두고, 기본 상태 답변에서는 low-risk 명령을 먼저 노출한다.

현재 상태/조치 답변 경로는 `orchestrator-summary-current-status.ts`에서 deterministic하게 생성된다.

- `buildActionPoolForServer()`는 "상위 프로세스 확인", "OOM/GC 로그 확인", "로그 적체 확인" 같은 자연어 권고만 반환한다.
- `buildRequestedServerStatusAnswer()`는 서버 지표와 판단을 제공하지만 명령어는 제공하지 않는다.
- `buildActionNeededAnswer()`는 우선순위와 권장 확인을 제공하지만 명령어는 제공하지 않는다.
- `getDominantMetric()`은 현재 CPU/메모리/디스크만 비교한다. 계획서가 network 진단 명령도 포함하므로 구현 시 네트워크 dominant metric 포함 여부를 결정하고 테스트로 고정해야 한다.
- `NLQ_STATUS_SUMMARY_CONTEXT`와 Reporter 지침에도 서버 타입별 진단 명령어 표가 존재한다. 이번 범위는 deterministic status/action 답변이지만, user-facing 출력 일관성을 위해 기존 prompt command table이 안전 등급/금지 패턴과 충돌하지 않는지 최소 감사한다.
- 기존 archive 계획서 [ai-assistant-command-guidance-resource-intent-plan.md](archive/ai-assistant-command-guidance-resource-intent-plan.md)는 사용자가 명시적으로 "명령어는?"이라고 물었을 때의 추천 정확도를 다룬 완료 작업이다. 이번 작업은 상태 답변 자체의 기본 진단 힌트 보강이므로 중복이 아니다.

## 계획서 평가 결과

- 판정: 보강 계약 반영 후 구현 착수 가능.
- 강점:
  - 외부 기준과 프로젝트 SDD 절차를 연결했다.
  - 실제 구현 지점이 `orchestrator-summary-current-status.ts`와 command catalog로 좁혀져 있다.
  - 기본값을 read-only로 제한해 명령어 추천의 안전 경계를 명확히 했다.
- 보강 필요:
  - read-only 명령의 운영 비용/민감도 차이를 타입에 반영한다.
  - 네트워크 metric은 현재 dominant metric에서 제외하고 generic health/log 진단으로 fallback한다.
  - 기존 `recommendCommands` tool output shape를 불필요하게 바꾸지 않는다는 호환성 조건을 명시한다.
  - prompt-level 진단 명령어 표와 deterministic catalog 간 drift를 최소 감사한다.

## 계약 (Contract)

> Status를 Approved로 올리기 전에 이 섹션을 리뷰한다.

### 변경 대상 파일

- `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-types.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-command-catalog.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-summary-current-status.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-command-tool.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-summary-current-status.test.ts` (신규 가능)
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-summary-fallback.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/nlq.ts` (감사 결과 충돌 시에만)

### 타입/함수 계약

| 함수/API | 입력 타입 | 출력 타입 | 기대 동작 |
|----------|-----------|-----------|-----------|
| `CommandRecommendation` | existing fields + `safety`, `operationalRisk`, `category`, `metric`, `service?` | typed recommendation | 명령별 안전 등급과 운영 영향 힌트를 보존한다. |
| `getReadOnlyDiagnosticCommands` | `{ metric?: DiagnosticMetric; service?: string; serverId?: string; limit?: number; maxRisk?: OperationalRisk }` | `CommandRecommendation[]` | read-only 명령만 반환하고 기본 최대 3개로 제한한다. |
| `buildRequestedServerStatusAnswer` | `query`, current payload, optional lookup payload | `string \| null` | 상세 서버 답변에 조건부 `진단 명령어 (읽기 전용)` 섹션을 추가한다. |
| `buildActionNeededAnswer` | `query`, current payload | `string \| null` | 상위 action focus 서버 1~2대에 metric별 진단 명령어를 추가한다. |
| `buildServiceCommandGuidanceAnswer` | `query` | `string \| null` | 기존 명시적 명령어 질문 경로는 유지하되 안전 등급별 문구를 분리한다. |
| `recommendCommands.execute` | `{ keywords: string[] }` | existing recommendations payload | 기본 public tool output은 `{ command, description }` shape를 유지한다. 안전 필드 노출은 별도 테스트가 있을 때만 추가한다. |

### 출력 계약

기본 출력은 읽기 전용 명령어만 포함한다.

````markdown
🔎 **진단 명령어 (읽기 전용)**
```bash
# cache-redis-dc1-01 메모리
free -h
ps aux --sort=-%mem | head -10
vmstat 1 5
```
````

명령어 섹션은 다음 조건에서만 붙인다.

- `buildActionNeededAnswer`: `actionFocus` 상위 1~2대에 대해 항상 추가
- `buildRequestedServerStatusAnswer`: warning/critical/offline 서버이거나 사용자가 `상세`, `자세`, `확인`, `진단`, `명령어` 의도를 포함한 경우 추가
- fleet 전체 summary: 경고 서버가 없는 단순 요약에는 기본적으로 생략

### 안전 규칙

- 기본 상태/조치 답변에는 `read-only` 명령만 포함한다.
- `read-only` 명령 중에서도 `operationalRisk: low`를 우선한다. `du`, 대량 로그 검색, Redis keyspace scan처럼 부하 가능성이 있는 명령은 `operationalRisk: medium`으로 표시하고 기본 action-needed 답변에서는 1개 이하로 제한한다.
- 다음 패턴은 기본 답변에서 금지한다: `restart`, `service restart`, `systemctl restart`, `kill`, `rm`, `truncate`, `vacuum`, `apt-get clean`, `mount`, `umount`, `sysctl -w`, `kubectl delete`, `clear cache`.
- command string은 catalog literal 또는 catalog helper가 만든 주석/placeholder 치환만 허용한다.
- LLM에게 shell command를 자유 생성하게 하지 않는다.
- placeholder는 `<service>`, `<log-path>`, `<nfs-server>`처럼 명시한다.
- 응답당 명령어 블록은 최대 2개, 서버당 명령은 최대 3개로 제한한다.
- `recommendCommands`의 explicit guidance path는 상태 답변보다 넓은 명령을 다룰 수 있지만, requires-approval/mutating 명령은 별도 섹션과 승인 문구 없이 read-only 섹션에 섞지 않는다.

### 테스트 시나리오 (구현 전 확정)

- [ ] action-needed: `cache-redis-dc1-01` memory 83% warning이면 `free -h`, `%mem`, `vmstat`가 포함되고 `clear cache`, `service restart`는 포함되지 않는다.
- [ ] server detail: `cache-redis-dc1-01 상태 자세히`는 메모리/Redis read-only 명령어를 포함한다.
- [ ] disk warning: 디스크 dominant 서버는 `df -h`, `du -xhd1`, `df -ih` 또는 `journalctl --disk-usage`만 포함하고 `journalctl --vacuum-time=7d`, `apt-get clean`은 포함하지 않는다.
- [ ] CPU warning: CPU dominant 서버는 `top -o cpu`, `ps aux --sort=-%cpu | head -10`를 포함한다.
- [ ] network warning: 현재 dominant metric은 CPU/메모리/디스크 기준을 유지하고, 네트워크만 높은 경우 generic health/log 진단으로 fallback한다.
- [ ] normal fleet summary: 경고가 없는 전체 상태 요약은 명령어 섹션을 남발하지 않는다.
- [ ] explicit command guidance: `디스크 용량 확보 명령어` 경로는 기존 command guidance를 유지하되 안전 등급 문구가 분리된다.
- [ ] prompt drift: NLQ/Reporter instruction command table이 기본 상태 답변의 금지 패턴과 충돌하지 않는다.
- [ ] guardrail: 상태 답변 빌더 결과에 금지 패턴이 있으면 테스트가 실패한다.

## 구현 설계

1. Command catalog 안전 등급을 추가한다.
   - `read-only`: `free`, `ps`, `vmstat`, `df`, `du`, `journalctl --disk-usage`, `systemctl status`, log tail/grep, `redis-cli --bigkeys`, `mysql SHOW ...`
   - `requires-approval`: cleanup 후보, 재마운트 후보처럼 사람 승인과 change 절차가 필요한 명령
   - `mutating`: restart/delete/clear/cache truncate 계열
   - `operationalRisk`: `low` / `medium` / `high`; 기본 status/action 답변은 `low` 우선

2. metric/service selector를 만든다.
   - CPU: `top -o cpu`, `ps aux --sort=-%cpu | head -10`
   - memory: `free -h`, `ps aux --sort=-%mem | head -10`, `vmstat 1 5`
   - disk: `df -h`, `du -xhd1 / 2>/dev/null | sort -hr | head -20`, `df -ih`, `journalctl --disk-usage`
   - network: `ss -s`, `ss -tuna | head -50`, `ip -s link`
   - nginx/web: `systemctl status nginx --no-pager`, access/error log read commands
   - redis: `redis-cli --bigkeys`, `redis-cli INFO memory`
   - mysql: `mysql -e "SHOW FULL PROCESSLIST"`, slow query path 확인

3. status summary에 진단 섹션을 붙인다.
   - `getDominantMetric()` 결과를 selector 입력으로 사용한다.
   - network metric은 현재 dominant metric에 포함하지 않는다. 네트워크만 높은 경우 generic health/log 진단으로 fallback한다.
   - 서버 id는 bash 주석으로만 넣고 command 자체에는 host 접속 명령을 만들지 않는다.
   - 정상 서버 상세에서는 사용자 의도가 상세/진단일 때만 짧게 붙인다.

4. 기존 명시적 command guidance path를 보존한다.
   - `buildServiceCommandGuidanceAnswer()`는 여전히 explicit command query에만 반응한다.
   - 단, 안전 등급이 추가되면 read-only와 requires-approval 문구를 나눠 출력한다.
   - `recommendCommands.execute`의 기존 반환 shape는 유지해 downstream prompt/tool 계약 변동을 최소화한다.

5. 기존 prompt command table을 최소 감사한다.
   - deterministic catalog와 상충하는 위험 명령이 있으면 prompt table을 read-only 기준으로 정렬한다.
   - Reporter/Analyst pipeline 전면 개편은 이 작업 범위 밖으로 둔다.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다.

- [x] Task 0 — failing regression tests 추가
  - 완료 기준: 위 테스트 시나리오 중 action-needed, server detail, disk guardrail이 구현 전 실패한다.
- [x] Task 1 — command catalog 안전 등급/selector 추가
  - 완료 기준: `getReadOnlyDiagnosticCommands()`가 read-only만 반환하고 limit/metric/service/risk 조건을 지킨다.
- [x] Task 2 — current status/action-needed 답변 진단 섹션 연결
  - 완료 기준: warning/action-needed/detail 답변에 명령어 섹션이 붙고 정상 fleet summary는 과도하게 늘어나지 않는다.
- [x] Task 3 — 명시적 command guidance 및 prompt table 안전 문구 정리
  - 완료 기준: 기존 command recommendation 회귀를 유지하면서 mutating 명령이 기본 상태 답변으로 새지 않고, prompt command table과 catalog의 금지 패턴이 충돌하지 않는다.
- [x] Task 4 — local validation
  - 완료 기준: AI Engine targeted tests, AI Engine type-check/test, root contract smoke 통과.
- [x] Task 5 — 배포 및 Vercel Playwright MCP QA
  - 완료 기준: production에서 표준 AI QA 5문항 + 진단 명령어 추가 질의가 PASS로 기록된다.
  - 완료 근거: v8.11.149 GitLab tag pipeline `2524461816` success, Vercel production Playwright MCP QA `QA-20260514-0501` 10/10 PASS.

## 검증 계획

로컬 구현 검증:

```bash
cd cloud-run/ai-engine && npx vitest run \
  src/tools-ai-sdk/reporter-tools/knowledge-command-tool.test.ts \
  src/services/ai-sdk/agents/orchestrator-summary-fallback.test.ts

cd cloud-run/ai-engine && npm run type-check
cd cloud-run/ai-engine && npm run test
npm run test:contract
npm run type-check
npm run lint
npm run test:quick
npm run docs:budget
npm run docs:ai-consistency
git diff --check
```

production QA는 `qa-ops` 기준에 따라 Vercel 실환경 + Playwright MCP로 수행한다.

- 랜딩/version 확인
- `/system-boot` → `/dashboard`
- 대시보드 데이터 확인
- AI Assistant 열기
- 표준 5문항 QA
- 추가 질의:
  - `현재 상태 정상인지 요약해줘. 확인할 명령어도 같이 알려줘`
  - `cache-redis-dc1-01 메모리 경고 확인 명령어도 같이 알려줘`
  - `지금 조치 필요한 서버와 각 서버에서 볼 진단 명령어 알려줘`
- QA 기록:
  - `npm run qa:record -- --input <json>`
  - `npm run qa:status`
  - `npm run qa:evidence:audit`

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1-3 | `feat(ai):` | ✅ | ✅ | 필요 시 |
| Task 4 | `test:` 또는 구현 커밋 포함 | ✅ | 판단 필요 | 판단 필요 |
| Task 5 | release/tag | ✅ | ✅ | ✅ |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 테스트가 "자연어 권고만 있고 명령어 없음" 문제와 위험 명령 누출을 정확히 고정하는지 |
| Task 1 완료 후 | command safety taxonomy가 기존 추천 경로와 충돌하지 않는지 |
| Task 2-3 완료 후 | user-facing 답변 길이, 금지 패턴, deterministic catalog 사용 여부 |
| Task 5 완료 후 | Vercel Playwright MCP evidence, QA tracker pending 여부 |

## 진행 중 블로커 대응

| 상황 | 기준 |
|------|------|
| 명령어 목록이 운영 환경별로 달라짐 | read-only 공통 명령만 유지하고 service-specific 명령은 placeholder/설명으로 제한 |
| 기존 command guidance 테스트가 깨짐 | explicit command path와 status diagnostic path를 분리해 회귀 수정 |
| 답변이 너무 길어짐 | action-needed 상위 1~2대, 서버당 최대 3개 명령으로 제한 |
| mutating 명령 누출 발견 | guardrail 테스트를 먼저 추가하고 selector에서 safety filter 보강 |
| production QA에서 AI 답변이 흔들림 | deterministic summary path에 고정하고 LLM 후처리 의존을 줄임 |

## 완료 기준

- [ ] Status가 `Approved` 이상으로 전환된 뒤 Task 0 failing test 커밋이 존재
- [ ] 상태/조치 답변에 read-only 진단 명령어가 조건부 포함
- [ ] 기본 상태/조치 답변에서 mutating 명령어 누출 0건
- [ ] AI Engine targeted/full tests 통과
- [ ] root type/lint/quick/contract smoke 통과
- [ ] Vercel production Playwright MCP QA 기록 완료
- [ ] QA tracker pending 0 확인
