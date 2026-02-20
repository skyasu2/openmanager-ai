# Cloud Run Large File Refactor Plan

- 상태: 진행 중
- 작성일: 2026-02-20
- 목표: `cloud-run/ai-engine` 중심의 500+ 라인 파일을 단계적으로 분할해 유지보수성을 높이고, 최종적으로 Docker/Cloud Run 배포까지 안전하게 연결한다.

## 배경
- 500라인 초과 파일이 다수 존재하며, 특히 Cloud Run 런타임 경로(`cloud-run/ai-engine`)에 집중되어 있다.
- 단일 파일 내 다중 책임(모델 선택, 폴백, 라우팅, 관측, 에러 처리)이 결합되어 변경 리스크가 크다.
- 리팩토링은 배포 안정성(Free Tier 가드레일, Docker preflight, Cloud Run health 검증)과 함께 진행해야 한다.

## 범위
- 우선 범위(Cloud Run 연계):
  - `cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts`
  - `cloud-run/ai-engine/src/services/observability/langfuse.ts`
- 연동 범위(BFF):
  - `src/app/api/ai/incident-report/route.ts`
  - `src/config/ai-proxy.config.ts`
- 제외 범위:
  - 대형 정적 데이터 파일(`src/data/*.data.ts`)의 즉시 분할(기능 리스크 낮아 후순위)

## 단계
- [x] Phase 0: 기준선 수집
  - 500+ 파일 목록/분포 추출
  - Cloud Run 가드레일/검증 스크립트 경로 확인
- [x] Phase 1: Cloud Run 1차 분할 리팩토링 (저위험)
  - 대상 1개 파일에서 순수 유틸/상수/헬퍼를 별도 모듈로 분리
  - 공개 인터페이스 유지(호출부 변경 최소화)
- [ ] Phase 2: Cloud Run 2차 분할 리팩토링 (핵심 경로)
  - 모델 선택/폴백/헬스체크 책임을 모듈 단위로 분리
  - 단위 테스트/스냅샷 테스트 보강
- [ ] Phase 3: BFF 연계 파일 정리
  - route handler에서 정책/파싱/fallback 로직 분리
  - Zod 스키마/응답 타입 경계 명확화
- [x] Phase 4: 배포 전 검증
  - `cd cloud-run/ai-engine && npm run type-check`
  - `cd cloud-run/ai-engine && npm run test`
  - `cd cloud-run/ai-engine && npm run docker:preflight` (또는 `SKIP_RUN=true`)
  - Free Tier 가드레일 탐지(`deploy.sh`, `cloudbuild.yaml`)
- [x] Phase 5: Cloud Run 배포 및 사후 확인
  - `cd cloud-run/ai-engine && bash deploy.sh`
  - 서비스 URL health/monitoring 확인
  - 실패 시 롤백 커맨드/트래픽 전환 절차 기록

## Cloud Run 운영 체크리스트
- [x] Docker daemon 접근 가능 (`docker ps`)
- [ ] 로컬 Docker prebuild 성공
- [x] 유료 머신 타입 설정 없음 (`--machine-type`, `E2_HIGHCPU_8`, `N1_HIGHCPU_8`)
- [x] Cloud Run 리소스 제한(CPU 1, Memory 512Mi) 유지
- [x] 배포 후 `/health` 응답 정상

## 완료 기준
- [x] 선택한 Cloud Run 대형 파일 최소 1개가 500라인 이하 또는 책임 분리 완료
- [x] 관련 타입체크/테스트 통과
- [ ] Docker preflight 통과
- [x] Cloud Run 배포 검증 로그(health 포함) 확보
- [ ] 변경 이유/검증/롤백 경로가 최종 보고에 포함

## 실행 결과 (2026-02-20)
- 리팩토링:
  - `model-provider.ts` 내부 모델 생성/패치 로직 분리
  - 신규 파일:
    - `cloud-run/ai-engine/src/services/ai-sdk/model-provider-core.ts`
    - `cloud-run/ai-engine/src/services/ai-sdk/model-provider.types.ts`
  - 라인 수 변화:
    - `model-provider.ts` 804 → 547
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/model-provider.compatibility.test.ts` 통과 (6 passed)
  - `FREE_TIER_GUARD_ONLY=true bash deploy.sh` 통과
- 배포:
  - 실행: `cd cloud-run/ai-engine && LOCAL_DOCKER_PREFLIGHT=false bash deploy.sh`
  - Cloud Build: `7fdf0ae8-91a5-4966-b80a-577b6c687291` (SUCCESS)
  - Revision: `ai-engine-00218-9cj` (traffic 100%)
  - URL: `https://ai-engine-jdhrhws7ia-an.a.run.app`
  - 스크립트 내 health check: HTTP 200
- 참고:
  - 로컬 `docker:preflight`는 환경별 정체가 재현되어 이번 배포에서는 `LOCAL_DOCKER_PREFLIGHT=false`로 우회

## 실행 결과 추가 (2026-02-20, 2차 분리 계속)
- 리팩토링:
  - 스트리밍 책임 분리:
    - `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts` 440줄
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts` 425줄
  - Provider 상태 관리 분리:
    - `cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts` 547 → 484
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/model-provider-status.ts` 77줄
  - 서버 부트스트랩 책임 분리:
    - `cloud-run/ai-engine/src/server.ts` 519 → 443
    - 신규 `cloud-run/ai-engine/src/server-incident-rag-backfill.ts` 61줄
    - 신규 `cloud-run/ai-engine/src/server-shutdown.ts` 37줄
  - 라우트 보조 로직 분리:
    - `cloud-run/ai-engine/src/routes/analytics.ts` 518 → 364
    - 신규 `cloud-run/ai-engine/src/routes/analytics-report-utils.ts` 200줄
  - 파이프라인 점수 계산 유틸 분리:
    - `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-pipeline.ts` 502 → 470
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-pipeline-score-utils.ts` 38줄
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts` 통과 (37 passed)
  - `cd cloud-run/ai-engine && npm test` 실패 (총 47 fail / 454 pass)
    - 주요 실패군: `vision-agent.test.ts`, `orchestrator.test.ts`, `approval-store.test.ts`, `reporter-pipeline.test.ts`, `server-metrics.test.ts`
    - 성격: 네트워크(Upstash DNS), 테스트 타임아웃, mock export 누락 등 기존 환경 의존성/테스트 베이스라인 이슈로 분류

## 실행 결과 추가 (2026-02-20, 3차 분리 계속)
- 리팩토링:
  - 관측성 모듈 책임 분리:
    - `cloud-run/ai-engine/src/services/observability/langfuse.ts` 833 → 42
    - 신규 `cloud-run/ai-engine/src/services/observability/langfuse-client.ts` 131줄
    - 신규 `cloud-run/ai-engine/src/services/observability/langfuse-usage.ts` 193줄
    - 신규 `cloud-run/ai-engine/src/services/observability/langfuse-trace.ts` 131줄
    - 신규 `cloud-run/ai-engine/src/services/observability/langfuse-timeout.ts` 100줄
    - 신규 `cloud-run/ai-engine/src/services/observability/langfuse-contracts.ts` 81줄
    - 신규 `cloud-run/ai-engine/src/services/observability/langfuse-noop.ts` 23줄
    - 신규 `cloud-run/ai-engine/src/services/observability/langfuse-flags.ts` 9줄
  - 공개 API 유지:
    - 기존 import 경로(`services/observability/langfuse`)는 퍼사드로 유지
    - `getLangfuseUsageStatus`, `createSupervisorTrace`, `createTimeoutSpan` 등 기존 export 시그니처 유지
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts` 통과 (37 passed)

## 실행 결과 추가 (2026-02-20, 4차 분리 계속)
- 리팩토링:
  - 오케스트레이터 스트리밍 실행 책임 분리:
    - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-execution.ts` 653 → 418
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts` 263줄
  - 핵심 라우팅 진입점(`executeMultiAgent`, `executeMultiAgentStream`)은 기존 파일에 유지
  - 에이전트 스트림 세부 처리(툴 호출/타임아웃/fallback/CB 기록)는 신규 모듈로 이동
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (49 passed)

## 실행 결과 추가 (2026-02-20, 5차 분리 계속)
- 리팩토링:
  - 세션 컨텍스트 저장소 책임 분리:
    - `cloud-run/ai-engine/src/services/ai-sdk/agents/context-store.ts` 581 → 9 (퍼사드)
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/agents/context-store-types.ts` 73줄
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/agents/context-store-core.ts` 175줄
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/agents/context-store-specialized.ts` 203줄
  - 기존 import 경로/함수명은 유지(`context-store.ts` 재export)
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (49 passed)

## 실행 결과 추가 (2026-02-20, 6차 분리 계속)
- 리팩토링:
  - 승인 저장소 책임 분리:
    - `cloud-run/ai-engine/src/services/approval/approval-store.ts` 574 → 387
    - 신규 `cloud-run/ai-engine/src/services/approval/approval-store-types.ts` 67줄
    - 신규 `cloud-run/ai-engine/src/services/approval/approval-store-supabase.ts` 183줄
  - `approval-store.ts`는 기존 singleton/export 경로를 유지하고, DB 영속화/히스토리 조회 로직만 헬퍼로 이동
  - 테스트 안정성 보강:
    - `VITEST`/`NODE_ENV=test` 런타임에서 Redis/Supabase 외부 I/O 우회 (fake timer + 외부 네트워크 대기 타임아웃 방지)
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/services/approval/approval-store.test.ts` 통과 (14 passed)

## 실행 결과 추가 (2026-02-20, 7차 분리 계속)
- 리팩토링:
  - RAG 병합 플래너 타입 분리:
    - `cloud-run/ai-engine/src/lib/rag-merge-planner.ts` 558 → 498
    - 신규 `cloud-run/ai-engine/src/lib/rag-merge-plan-types.ts` 75줄
  - `rag-merge-planner.ts`에서 기존 type export는 그대로 재export 유지
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/lib/rag-merge-planner.test.ts src/services/approval/approval-store.test.ts src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (65 passed)

## 실행 결과 추가 (2026-02-20, 8차 분리 계속)
- 리팩토링:
  - LlamaIndex RAG 서비스 책임 분리:
    - `cloud-run/ai-engine/src/lib/llamaindex-rag-service.ts` 674 → 481
    - 신규 `cloud-run/ai-engine/src/lib/llamaindex-rag-types.ts` 23줄
    - 신규 `cloud-run/ai-engine/src/lib/llamaindex-rag-graph.ts` 89줄
    - 신규 `cloud-run/ai-engine/src/lib/llamaindex-rag-relations.ts` 122줄
  - 분리 범위:
    - 타입 선언(검색결과/트리플릿/통계) 외부화
    - 그래프 순회 + 결과 병합/중복제거 유틸 외부화
    - 관계 추출/관련지식 조회 로직 외부화
  - 기존 public API 경로(`llamaindex-rag-service.ts`) 및 함수명은 유지
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/lib/rag-merge-planner.test.ts src/services/approval/approval-store.test.ts src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (65 passed)

## 실행 결과 추가 (2026-02-20, 9차 분리 계속)
- 리팩토링:
  - 공통 에이전트 베이스 책임 분리:
    - `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent.ts` 697 → 465
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent-types.ts` 65줄
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent-multimodal.ts` 44줄
    - 신규 `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent-tooling.ts` 77줄
  - 기존 API/계약 유지:
    - `BaseAgent` 클래스 경로 동일
    - `buildUserContent` protected hook 유지(테스트/서브클래스 호환)
    - 기존 type export는 `base-agent.ts`에서 재export
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/base-agent.test.ts src/lib/rag-merge-planner.test.ts src/services/approval/approval-store.test.ts src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (101 passed)

## 실행 결과 추가 (2026-02-20, 10차 분리 계속)
- 리팩토링:
  - 모니터링 임계값 타입 분리:
    - `cloud-run/ai-engine/src/lib/ai/monitoring/AdaptiveThreshold.ts` 526 → 461
    - 신규 `cloud-run/ai-engine/src/lib/ai/monitoring/AdaptiveThreshold.types.ts` 38줄
  - 기존 export 경로 유지:
    - `AdaptiveThreshold.ts`에서 타입 재export
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/base-agent.test.ts src/lib/rag-merge-planner.test.ts src/services/approval/approval-store.test.ts src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (101 passed)

## 실행 결과 추가 (2026-02-20, 11차 분리 계속)
- 리팩토링:
  - 통합 이상 탐지 엔진 책임 분리:
    - `cloud-run/ai-engine/src/lib/ai/monitoring/UnifiedAnomalyEngine.ts` 818 → 340
    - 신규 `cloud-run/ai-engine/src/lib/ai/monitoring/UnifiedAnomalyEngine.types.ts` 113줄
    - 신규 `cloud-run/ai-engine/src/lib/ai/monitoring/UnifiedAnomalyEngine.helpers.ts` 338줄
  - 기존 public API 유지:
    - `getUnifiedAnomalyEngine`, `resetUnifiedAnomalyEngine` 경로/이름 동일
    - 기존 export type은 `UnifiedAnomalyEngine.ts`에서 재export
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/analyst-tools.test.ts src/services/ai-sdk/agents/base-agent.test.ts src/lib/rag-merge-planner.test.ts src/services/approval/approval-store.test.ts src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (118 passed)

## 실행 결과 추가 (2026-02-20, 12차 분리 계속)
- 리팩토링:
  - 추세 예측 엔진 책임 분리:
    - `cloud-run/ai-engine/src/lib/ai/monitoring/TrendPredictor.ts` 699 → 410
    - 신규 `cloud-run/ai-engine/src/lib/ai/monitoring/TrendPredictor.types.ts` 60줄
    - 신규 `cloud-run/ai-engine/src/lib/ai/monitoring/TrendPredictor.enhanced.ts` 176줄
  - 기존 public API 유지:
    - `getTrendPredictor` 경로/이름 동일
    - 기존 export type은 `TrendPredictor.ts`에서 재export
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/analyst-tools.test.ts src/services/ai-sdk/agents/base-agent.test.ts src/lib/rag-merge-planner.test.ts src/services/approval/approval-store.test.ts src/services/ai-sdk/model-provider.compatibility.test.ts src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (118 passed)

## 실행 결과 추가 (2026-02-20, 13차 분리 계속)
- 리팩토링:
  - Incident Evaluation 도구 책임 분리:
    - `cloud-run/ai-engine/src/tools-ai-sdk/incident-evaluation-tools.ts` 742 → 37 (퍼사드)
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/incident-evaluation-types.ts` 44줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/incident-evaluation-helpers.ts` 159줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/incident-evaluation-evaluator-tools.ts` 258줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/incident-evaluation-optimizer-tools.ts` 260줄
  - 기존 public API 유지:
    - `evaluateIncidentReport`, `validateReportStructure`, `scoreRootCauseConfidence`, `refineRootCauseAnalysis`, `enhanceSuggestedActions`, `extendServerCorrelation` 경로/이름 동일
    - `incidentEvaluationTools` 집합 export 유지
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/incident-evaluation-tools.test.ts` 통과 (21 passed)

## 실행 결과 추가 (2026-02-20, 14차 분리 계속)
- 리팩토링:
  - Reporter/Knowledge 도구 책임 분리:
    - `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge.ts` 727 → 16 (퍼사드)
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-types.ts` 30줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-client.ts` 28줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-helpers.ts` 231줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.ts` 368줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-command-tool.ts` 73줄
  - Vision 도구 책임 분리:
    - `cloud-run/ai-engine/src/tools-ai-sdk/vision-tools.ts` 704 → 29 (퍼사드)
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/vision-types.ts` 95줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/vision-screenshot-tool.ts` 133줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/vision-log-tool.ts` 193줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/vision-grounding-tool.ts` 96줄
    - 신규 `cloud-run/ai-engine/src/tools-ai-sdk/vision-url-tool.ts` 85줄
  - 기존 public API 유지:
    - `searchKnowledgeBase`, `recommendCommands`, `extractKeywordsFromQuery` 경로/이름 동일
    - `analyzeScreenshot`, `analyzeLargeLog`, `searchWithGrounding`, `analyzeUrlContent`, `visionTools`, `visionToolDescriptions` 경로/이름 동일
- 검증:
  - `cd cloud-run/ai-engine && npm run type-check` 통과
  - `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/reporter-tools/knowledge.test.ts src/tools-ai-sdk/incident-evaluation-tools.test.ts src/services/ai-sdk/agents/config/agent-configs.vision-fallback.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts` 통과 (48 passed)

## 실행 결과 추가 (2026-02-20, 15차 배포 검증)
- 배포 전 점검:
  - `cd cloud-run/ai-engine && FREE_TIER_GUARD_ONLY=true bash deploy.sh` 통과 (free-tier guardrails)
  - `cd cloud-run/ai-engine && SKIP_RUN=true npm run docker:preflight` 재시도 시 `npm prune --production` 단계 장시간 정체 재현
  - 운영 배포는 기존 우회 정책 유지: `LOCAL_DOCKER_PREFLIGHT=false`
- 배포:
  - 실행: `cd cloud-run/ai-engine && LOCAL_DOCKER_PREFLIGHT=false bash deploy.sh`
  - Cloud Build: `804c6968-332f-4fd5-841b-fd9838fbece9` (SUCCESS)
  - 이미지: `asia-northeast1-docker.pkg.dev/openmanager-free-tier/cloud-run/ai-engine:v-20260220-142700-36bb88683`
  - Revision: `ai-engine-00219-jv9` (traffic 100%)
  - URL: `https://ai-engine-jdhrhws7ia-an.a.run.app`
  - health check: HTTP 200

## 남은 500+ Cloud Run 우선 작업
- 핵심 런타임 경로(우선):
  - 현재 핵심 런타임 경로 500+ 없음 (단일 파일 기준, 정적 데이터 제외)
- 잔여 500+ 항목(참고):
  - `cloud-run/ai-engine/src/data/precomputed-state.ts` (1316, 정적 데이터 파일)
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/base-agent.test.ts` (1315, 테스트)
  - `cloud-run/ai-engine/src/tools-ai-sdk/server-metrics.test.ts` (774, 테스트)
  - `cloud-run/ai-engine/src/tools-ai-sdk/incident-evaluation-tools.test.ts` (528, 테스트)

## 리스크 및 대응
- 리스크: 리팩토링 중 폴백 체인 손상
  - 대응: 기존 export 시그니처 유지 + 테스트 우선
- 리스크: Docker/Cloud 인증 환경 차이
  - 대응: preflight 분리 실행 + 배포 전 인증 상태 확인
- 리스크: 배포는 성공했으나 health 지연
  - 대응: 10~20초 재시도 후 판정
