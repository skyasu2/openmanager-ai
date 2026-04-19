> Owner: project
> Status: Approved
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

- [ ] B-1: 서버 타입별 INFO 템플릿 풀 정의
  - `db`: `slow query detected: {n}ms`, `replication lag: {n}ms`, `connection pool: {n}/{max} active`
  - `api`: `{method} {path} {status} {n}ms`, `cache hit ratio: {n}%`, `health check passed [latency={n}ms]`
  - `cache`: `eviction policy triggered: {n} keys removed`, `GC pause: {n}ms`, `memory fragmentation ratio: {n}`
  - `lb`: `upstream {server} health check ok [rtt={n}ms]`, `active connections: {n}`, `request routing: {backend}`
  - `storage`: `disk usage report: {n}% of {capacity}`, `scheduled job completed: {job} in {n}ms`, `config reload: no changes detected`
- [ ] B-2: 슬롯당 INFO 3~7개 랜덤 선택, 파라미터는 해당 슬롯 메트릭 범위 기반 치환
- [ ] B-3: `otel-verify.ts`에 per-slot 최소 INFO 3개, 최대 로그 상한 추가
- [ ] B-4: contract test — 동일 메시지 연속 3개 없음, 타입별 템플릿 실제 포함 여부

### Phase A — 가우시안 jitter (2순위, 난이도: ★★☆)

Phase B와 독립적으로 병행 가능.

- [ ] A-1: `adjustMetricsForScenario()`에 Box-Muller 정규분포 jitter 적용
  - 현재: `(Math.random() - 0.5) * 0.03`
  - 개선: `gaussianJitter(mean=0, stddev=0.015)` — 외부 패키지 불필요
  - 고부하 구간(cpu>0.8)은 stddev 축소(`0.008`)로 포화 구간 안정화
- [ ] A-2: `otel-verify.ts` 검증 항목 — jitter 결과값이 [0.01, 0.99] 범위 유지
- [ ] A-3: contract test — `gaussianJitter` unit test (1000회 샘플 평균 ≈ 0, 95%가 ±2σ 이내)

### Phase C — 마르코프 상태 전이 (3순위, 난이도: ★★★)

> Phase A·B 완료 후 착수 여부 재평가. 현재는 설계 메모 수준.

- [ ] C-1: 서버별 상태 컨텍스트 타입 `ServerSimState` 정의, `adjustMetricsForScenario` 시그니처 변경
- [ ] C-2: 시나리오별 전이 확률 테이블 (S1: `normal→degraded(40%)→critical(20%)→recovery(40%)`)
- [ ] C-3: 카오스 이벤트 — 5% 확률 spike 삽입 (복구 로그와 함께)
- [ ] C-4: `timeseries.json` 동기화 검증

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
