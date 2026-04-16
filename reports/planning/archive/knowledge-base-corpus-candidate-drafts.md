# Knowledge Base Corpus Candidate Drafts

> Status: Draft
> Owner: project
> Updated: 2026-04-12
> Purpose: `knowledge_base` split-first 이후 후속 배치에서 사용할 `manual` / `imported` 후보 8개 초안

## Recommended First Batch

- `AI 사이드바 응답 지연 점검 순서`
- `Supabase migration 작업 규칙`

## Candidate Drafts

### 1. Redis 메모리 압박 초기 대응
- category: `incident`
- source: `manual`
- priority: `reserve`
- draft: Redis 계층에서 메모리 사용률이 80%를 넘기면 먼저 `used_memory`, eviction 증가 여부, `maxmemory-policy`, 키 폭증 시간을 함께 확인한다. 단순히 메모리 수치만 보고 재시작하지 말고, 최근 배포·배치 작업·대형 캐시 적재 이벤트가 있었는지 먼저 대조해야 한다. 운영자는 `getServerMetrics`와 캐시 관련 경보를 같이 보고, 정책이 `allkeys-lru`인지 확인한 뒤 필요하면 캐시 적재량을 줄이거나 TTL 편차를 정리하는 순서로 완화한다. 급한 조치일수록 근거 지표를 남긴다.

### 2. 웹 계층 5xx 급증 1차 분류
- category: `incident`
- source: `manual`
- priority: `reserve`
- draft: 웹 계층 5xx가 급증하면 loadbalancer, web, application 세 계층을 한 번에 보지 말고 요청 흐름 순서대로 분리한다. 먼저 LB 응답 지연과 backend 연결 실패가 있는지 확인하고, 다음으로 web 서버의 worker 포화와 upstream timeout 흔적을 본다. 마지막으로 application 계층의 CPU spike, DB connection pressure, 최근 배포 여부를 대조해야 한다. 5xx 비율만으로 애플리케이션 결함으로 단정하지 말고, 계층별 지표와 시간대 정합성을 먼저 맞춘다.

### 3. CPU spike 진단 순서
- category: `troubleshooting`
- source: `manual`
- priority: `reserve`
- draft: CPU 사용률이 높다는 질문이 들어오면 먼저 단일 시점 수치보다 최근 30~60분 추세를 확인하고, 같은 시간대의 메모리·디스크 대기·네트워크 변화가 같이 올라왔는지 본다. web/application 계층은 트래픽 증가나 비정상 재시도와 같이 나타나는 경우가 많고, database 계층은 느린 쿼리와 connection pool 압박이 동반되기 쉽다. 운영자는 원인 후보를 프로세스 과부하, 캐시 미스 증가, 외부 의존성 지연으로 나눠 설명하고, 즉시 재시작보다는 관련 지표 교차 검증을 먼저 수행한다.

### 4. AI 사이드바 응답 지연 점검 순서
- category: `troubleshooting`
- source: `manual`
- priority: `first-batch`
- draft: AI 사이드바 응답이 느릴 때는 모델 품질 문제보다 먼저 경로를 분리해 본다. 프론트에서는 `/api/ai/*` 응답 코드와 `X-AI-Latency-Ms` 헤더 유무를 확인하고, 서버 측에서는 Cloud Run cold start, provider rate limit, RAG 검색 지연이 어느 구간에서 발생했는지 본다. 질의가 길거나 다중 에이전트 경로를 타면 응답이 늘 수 있으므로, 같은 질문을 짧은 버전으로 재시도해 경향을 비교한다. Ready 상태만 보고 정상으로 판단하지 말고 실제 첫 토큰 도착 시간까지 확인해야 한다.

### 5. Guest login / Auth smoke 실패 점검
- category: `troubleshooting`
- source: `manual`
- priority: `reserve`
- draft: guest login 또는 일반 auth smoke가 실패하면 UI 문구보다 redirect URL, 세션 쿠키, Supabase auth 설정 세 축을 먼저 확인한다. 로컬에서는 `localhost`와 `127.0.0.1` 허용 origin 차이로 HMR/WebSocket 오류가 섞일 수 있고, production에서는 callback URL drift가 더 흔하다. 로그인 버튼 노출, PIN 입력 성공, `/system-boot` 진입, `/dashboard` 세션 유지까지 한 흐름으로 확인해야 하며, 시작 페이지 렌더만 성공했다고 인증 경로가 정상이라고 판단하면 안 된다.

### 6. Release QA 최소 게이트 운영 규칙
- category: `best_practice`
- source: `imported`
- priority: `reserve`
- draft: release-facing QA는 broad 범위를 한 번에 과도하게 늘리는 대신 `core-routes-smoke`, `dashboard-core`, `ai-core`를 최소 기준으로 먼저 채운다. 같은 배포를 반복 확인하는 propagation check는 `countsTowardSummary=false`로 분리해 aggregate를 오염시키지 않아야 한다. production QA에서는 deployment id, commit sha, usage check, durable evidence를 함께 남겨야 하며, AI 기능이 범위에 없으면 paid model 호출을 생략해도 된다. 중요한 것은 런 횟수가 아니라 현재 배포가 어떤 surface까지 검증됐는지 추적 가능하게 남기는 것이다.

### 7. Supabase migration 작업 규칙
- category: `best_practice`
- source: `imported`
- priority: `first-batch`
- draft: Supabase schema 작업은 로컬 압축 ledger를 임의로 밀어 넣는 방식보다 remote timestamp ledger와 현재 hosted schema를 먼저 기준으로 맞춰야 한다. `db pull`이나 `migration repair`는 메인 워크트리에서 바로 실행하지 말고, safe worktree에서 parity를 확인한 뒤 canonical repo에 반영하는 편이 안전하다. 현재 runtime이 쓰지 않는 legacy object는 fresh bootstrap 정본이 아니라 history-only stub로 다루고, schema-critical 객체만 active migration chain에 남겨야 drift와 replay 실패를 동시에 줄일 수 있다.

### 8. GitLab canonical deploy / GitHub 공개 동기화 원칙
- category: `best_practice`
- source: `imported`
- priority: `reserve`
- draft: OpenManager의 배포 권위는 GitLab private canonical repo와 GitLab CI에 있으므로, `gitlab`이 기본 push 대상이고 Vercel production도 이 경로를 기준으로 해석해야 한다. `github-public`은 frontend-focused snapshot이므로 mainline 기준 브랜치처럼 다루면 안 된다. 공개 저장소 동기화는 직접 push가 아니라 승인된 sync 경로로만 수행하고, 배포 전후 판단도 GitHub 상태보다 GitLab pipeline과 production smoke 결과를 우선해야 한다. 원격 이름이 익숙하다는 이유로 `origin`을 정본처럼 쓰면 배포 추적이 어긋난다.
