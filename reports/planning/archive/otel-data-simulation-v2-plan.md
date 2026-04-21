> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-04-19
> Tags: otel,simulation,data,scripts

# OTel 데이터 시뮬레이션 고도화 v2 계획서

## 목표

`scripts/data/otel-fix.ts` 생성기를 개선해 더 현실적인 서버 메트릭/로그 패턴을 생성한다.  
런타임(Vercel/Cloud Run) 비용 영향 없음 — 모두 빌드타임 스크립트 변경.

## 현황 분석

| 항목 | 현재 방식 | 개선 목표 |
|------|----------|----------|
| 배경 INFO 로그 | 동일 패턴 반복 (~28개/슬롯) | 서버 타입별 다양한 운영 로그 패턴 |
| jitter | 균등분포 ±1.5% | 가우시안 분포 (표준편차 기반) |
| 시간대 전이 | 정적 고정값 맵 | 연속성 있는 상태 전이 (Phase C) |
| 파일 크기 | ~5.8MB | ~7MB 예상 (+20~30%) |

## 실행 범위

### Phase B — 배경 노이즈 로그 (1순위, 난이도: ★☆☆)

**구조 변경 없이 `reconcileLogsWithMetrics()` 확장만으로 적용 가능.**

- [x] B-1: 서버 타입별 INFO 템플릿 풀 정의
  - `db`: `slow query detected: {n}ms`, `replication lag: {n}ms`, `connection pool: {n}/{max} active`
  - `api`: `{method} {path} {status} {n}ms`, `cache hit ratio: {n}%`, `health check passed [latency={n}ms]`
  - `cache`: `eviction policy triggered: {n} keys removed`, `GC pause: {n}ms`, `memory fragmentation ratio: {n}`
  - `lb`: `upstream {server} health check ok [rtt={n}ms]`, `active connections: {n}`, `request routing: {backend}`
  - `storage`: `disk usage report: {n}% of {capacity}`, `scheduled job completed: {job} in {n}ms`, `config reload: no changes detected`
- [x] B-2: 슬롯당 INFO 3~7개 랜덤 선택, 파라미터는 해당 슬롯 메트릭 범위 기반 치환
- [x] B-3: `otel-verify.ts`에 per-slot 최소 INFO 3개, 최대 로그 상한 추가
- [x] B-4: contract test — 동일 메시지 연속 3개 없음, 타입별 템플릿 실제 포함 여부

### Phase A — 가우시안 jitter (2순위, 난이도: ★★☆)

Phase B와 독립적으로 병행 가능.

- [x] A-1: `adjustMetricsForScenario()`에 Box-Muller 정규분포 jitter 적용
  - 현재: `(Math.random() - 0.5) * 0.03`
  - 개선: `gaussianJitter(mean=0, stddev=0.015)` — 외부 패키지 불필요
  - 고부하 구간(cpu>0.8)은 stddev 축소(`0.008`)로 포화 구간 안정화
- [x] A-2: `otel-verify.ts` 검증 항목 — jitter 결과값이 [0.01, 0.99] 범위 유지
- [x] A-3: contract test — `gaussianJitter` unit test (1000회 샘플 평균 ≈ 0, 95%가 ±2σ 이내)

### Phase C — 상태 전이 MVP (3순위, 난이도: ★★☆)

> Phase A·B가 닫혔으므로 다음 착수 후보. 다만 전체 Markov/chaos 범위로 바로 가지 않고 `scenario server continuity`만 먼저 구현한다.

#### Phase C MVP 범위

- 시나리오에 명시된 서버만 대상
- 상태 집합: `normal | degraded | critical | recovery`
- 목표: 슬롯별 값이 독립 난수처럼 튀지 않고, 인접 슬롯/인접 시간대에서 자연스럽게 이어지도록 보정
- 구현 위치: `adjustMetricsForScenario()` 내부 또는 인접 helper로 한정

#### Phase C MVP 비범위

- 전 서버(global) Markov 체인
- 5% chaos spike 삽입
- 로그 생성기 전면 재작성
- 새로운 OTLP 입력 포맷 도입

- [x] C-1: `ServerSimState` / `TransitionProfile` 타입 정의
  - 상태별 기대 metric multiplier와 다음 상태 후보만 정의
  - helper 파일 분리 가능, 런타임 의존성 추가 금지
- [x] C-2: 시나리오 서버 전용 상태 전이 테이블 정의
  - 예: S1 DB primary = `normal → degraded → critical → recovery`
  - 예: S3 Redis = `degraded ↔ critical` 중심
- [x] C-3: 인접 슬롯 continuity 적용
  - 현재 슬롯 값은 `scenario target + jitter`가 아니라 `previous state output + bounded drift` 기반으로 계산
  - hour 경계는 `이전 hour 마지막 슬롯 state`를 carry-over 해서 연결
- [x] C-4: contract test
  - 인접 슬롯 간 급격한 역전 금지 (`critical → normal` 즉시 점프 금지)
  - 대표 시나리오 2개 이상에서 `degraded` 또는 `recovery` 구간이 실제 관측돼야 함
- [x] C-5: `timeseries.json` 및 `otel-verify.ts` 검증 유지
  - 기존 bounds/severity/network 검증을 깨지 않음

#### Phase C+ 메모

- chaos spike는 Phase C MVP 후 별도 sub-phase로 분리
- 전 서버 상태 전이는 Phase C 효과가 충분한지 본 뒤 재평가

### Phase D — OTel Replayer (백로그, OTLP 소스 확보 시)

> 실제 OTLP export JSON이 확보되면 별도 계획서로 승격. 현재는 설계 메모.

- 어댑터 패턴으로 `scripts/data/otel-replayer.ts` 신규 작성
- 출력 포맷은 `otel-fix.ts`와 동일하게 유지해 `otel-verify.ts` 공통 재사용

---

## 계약 (Contract)

### Phase B failing test 시나리오 (구현 착수 전 먼저 커밋)

```
test(spec): otel-simulation-v2 add failing tests before implementation
```

1. **B-type-coverage**: `hour-10.json` db 서버 슬롯에 `slow query` 또는 `replication lag` 포함
2. **B-diversity**: 동일 서버 연속 3 슬롯에서 동일 INFO 메시지가 3개 이상 연속 없음
3. **B-min-count**: 모든 서버 슬롯에서 INFO 로그 ≥ 3개
4. **B-param-range**: `cache hit ratio` 파라미터가 해당 슬롯 메모리 사용률과 역상관 (memory>80% → hit ratio<60%)

### Phase A failing test 시나리오

1. **A-gaussian-balance**: `gaussianJitter(0, 0.015)` 1000회 → 평균 절댓값 < 0.002
2. **A-bounds**: jitter 적용 후 모든 메트릭 값이 [0.01, 0.99] 유지

### Phase C failing test 시나리오

1. **C-transition-path**: `cache-redis-dc1-01`는 critical/degraded 구간 이후 첫 post-incident 슬롯이 `normal`로 즉시 복귀하지 않고 `recovery` bridge를 거친다
2. **C-no-hard-reset**: 대표 시나리오 서버(`db-mysql-dc1-primary`, `cache-redis-dc1-01`)의 전체 24h 인접 슬롯 max metric delta가 `0.24`를 넘지 않는다
3. **C-carry-over**: 동일 대표 서버의 모든 hour 경계(`slot 5 -> next hour slot 0`) max metric delta가 `0.24`를 넘지 않는다

### 비용 영향

| 항목 | 변화 |
|------|------|
| Vercel/Cloud Run 런타임 | 없음 (정적 파일) |
| Vercel 빌드 시간 | 미미 (파일 크기 +30%, Standard 빌드) |
| CI 분 소진 | Phase A·B: 없음 / Phase C: 스크립트 실행 +수초 |

---

## 검증 명령어

```bash
# 데이터 재생성
node_modules/.bin/jiti scripts/data/otel-fix.ts

# 계약 검증
npm run data:verify

# 파일 크기 확인
du -sh public/data/otel-data/

# unit test (Phase B·A)
npx vitest run tests/unit/otel-simulation-v2.test.ts
```

---

## 착수 게이트

1. Status를 `Draft → Approved`로 변경
2. Phase B failing test 먼저 커밋: `test(spec): otel-simulation-v2 add failing tests before implementation`
3. 구현 커밋: `feat: otel-simulation-v2 implement background noise logs`
