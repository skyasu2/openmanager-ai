# Monitoring & ML Engine

> **v1.0.0** | Created 2026-01-25
>
> 이상탐지, 트렌드 예측, 적응형 임계값 시스템 상세

**관련 문서**: [AI Engine Architecture](./ai-engine-architecture.md) - 전체 아키텍처

---

## Overview

OpenManager AI의 예측/이상탐지 엔진은 **하이브리드 접근 방식**을 사용합니다:

| 구분 | 방식 | 라이브러리 |
|------|------|------------|
| 통계 기반 탐지 | Custom | 순수 TypeScript |
| ML 기반 탐지 | Library | `isolation-forest` v0.0.9 |
| 트렌드 예측 | Custom | 순수 TypeScript |
| 적응형 임계값 | Custom | 순수 TypeScript |

### 설계 철학

1. **경량화**: TensorFlow.js, Brain.js 같은 무거운 프레임워크 미사용
2. **최소 의존성**: ML은 `isolation-forest` 단일 패키지만 사용
3. **하이브리드**: 통계 + ML 상호 보완
4. **Fallback 안전**: 한 탐지기 실패해도 다른 것이 동작

---

## Architecture

```
cloud-run/ai-engine/src/lib/ai/monitoring/
├── SimpleAnomalyDetector.ts    # 통계 기반 (Moving Avg + 2σ)
├── IsolationForestDetector.ts  # ML 기반 (Isolation Forest)
├── TrendPredictor.ts           # 선형 회귀 예측
├── AdaptiveThreshold.ts        # 시간대별 적응형 임계값
├── HybridAnomalyDetector.ts    # 앙상블 투표 (Statistical + IF)
├── UnifiedAnomalyEngine.ts     # 통합 엔진 (3-way 앙상블)
└── index.ts                    # 모듈 exports
```

### Data Flow

```
Metrics Stream
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              UnifiedAnomalyEngine                    │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Statistical │  │  Isolation   │  │ Adaptive  │ │
│  │   Detector   │  │    Forest    │  │ Threshold │ │
│  │   (0.3)      │  │    (0.4)     │  │   (0.3)   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                │        │
│         └─────────────────┼────────────────┘        │
│                           ▼                         │
│                  ┌────────────────┐                 │
│                  │ Ensemble Vote  │                 │
│                  │ threshold: 0.5 │                 │
│                  └────────┬───────┘                 │
│                           │                         │
└───────────────────────────┼─────────────────────────┘
                            ▼
                    Anomaly Detection Result
                    + Trend Prediction
```

---

## Components

### 1. SimpleAnomalyDetector

**알고리즘**: Moving Average + 2σ (Grafana-inspired)

#### 원리

```
Upper Threshold = μ + (2 × σ)
Lower Threshold = μ - (2 × σ)

μ = 6시간 이동평균 (36 data points @ 10분 간격)
σ = 표준편차
```

#### 설정

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `windowSize` | 36 | 이동평균 윈도우 (6시간) |
| `stdDevMultiplier` | 2 | 표준편차 배수 (95.4% CI) |

#### 심각도 분류

| 레벨 | 조건 | 설명 |
|------|------|------|
| Low | < 2.5σ | 경미한 이상 |
| Medium | 2.5σ ~ 3σ | 주의 필요 |
| High | > 3σ | 심각한 이상 |

#### 성능

- **지연시간**: ~1-5ms
- **False Positive Rate**: ~5%
- **메모리**: 매우 낮음

```typescript
// 사용 예시
import { SimpleAnomalyDetector } from './monitoring';

const detector = new SimpleAnomalyDetector({
  windowSize: 36,
  stdDevMultiplier: 2
});

const result = detector.detect(metricsHistory);
// { isAnomaly: true, severity: 'medium', confidence: 0.87 }
```

---

### 2. IsolationForestDetector

**알고리즘**: Isolation Forest (Liu, Ting, Zhou 2008)

#### 원리

Isolation Forest는 이상치가 정상 데이터보다 **더 쉽게 분리**된다는 원리를 활용합니다.

```
Anomaly Score = 2^(-E(h(x)) / c(n))

E(h(x)) = 평균 경로 길이
c(n) = 정규화 상수
```

#### 설정

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `numTrees` | 100 | 트리 개수 |
| `sampleSize` | 256 | 서브샘플 크기 |
| `anomalyThreshold` | 0.6 | 이상치 판정 임계값 |
| `minTrainingPoints` | 50 | 최소 학습 데이터 |

#### 특징

- **다변량 분석**: CPU, Memory, Disk, Network 동시 분석
- **z-score 기반 기여도**: 어떤 메트릭이 이상의 원인인지 추정
- **자동 재학습**: 새 데이터로 모델 업데이트 가능

#### 성능

- **지연시간**: ~10-50ms (학습된 모델 기준)
- **학습 시간**: ~100-500ms (100개 트리)
- **메모리**: 중간 (모델 저장 필요)

```typescript
// 사용 예시
import { IsolationForestDetector } from './monitoring';

const detector = new IsolationForestDetector({
  numTrees: 100,
  sampleSize: 256,
  anomalyThreshold: 0.6
});

// 학습
await detector.train(historicalData);

// 탐지
const result = detector.detect(currentMetrics);
// {
//   isAnomaly: true,
//   score: 0.73,
//   contributions: { cpu: 0.45, memory: 0.30, disk: 0.15, network: 0.10 }
// }
```

---

### 3. TrendPredictor

**알고리즘**: Least Squares Linear Regression

#### 원리

```
y = mx + b

m (slope) = (n∑xy - ∑x∑y) / (n∑x² - (∑x)²)
b (intercept) = (∑y - m∑x) / n
R² = 1 - (SS_res / SS_tot)  // 결정계수
```

#### 설정

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `dataPoints` | 12 | 입력 데이터 포인트 (5분 간격) |
| `predictionHorizon` | 1시간 | 예측 범위 |

#### 기능

| 기능 | 설명 | 스타일 |
|------|------|--------|
| **트렌드 분류** | Increasing / Decreasing / Stable | 기본 |
| **임계값 도달 예측** | N분 후 임계값 도달 | Prometheus `predict_linear()` |
| **복구 시간 예측** | 정상 수준 복귀 예상 시간 | Datadog Recovery Forecast |

#### 임계값 도달 예측

```typescript
// 임계값 도달 시간 계산
timeToThreshold = (threshold - current) / slope

// 예: CPU 현재 60%, 분당 2% 증가, 임계값 80%
// (80 - 60) / 2 = 10분 후 도달
```

#### 성능

- **지연시간**: <5ms
- **정확도**: R² 기반 신뢰도 제공

```typescript
// 사용 예시
import { TrendPredictor } from './monitoring';

const predictor = new TrendPredictor();

const result = predictor.predict(metricsHistory, {
  threshold: 80,
  currentValue: 65
});
// {
//   trend: 'increasing',
//   predictedValue: 78,
//   confidence: 0.92,
//   timeToThreshold: '15분',
//   recoveryTime: null
// }
```

---

### 4. AdaptiveThreshold

**알고리즘**: Temporal Bucketing + Exponential Moving Average (EMA)

#### 원리

시간대별로 정상 범위가 다름을 학습하여 동적 임계값을 생성합니다.

```
EMA = α × current + (1 - α) × previous

α = 0.1 (smoothing factor)

Final Threshold = (hourlyWeight × hourlyStats) + (dailyWeight × dailyStats)
hourlyWeight = 0.7
dailyWeight = 0.3
```

#### 설정

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `hourlyBuckets` | 24 | 시간대별 버킷 |
| `dailyBuckets` | 7 | 요일별 버킷 |
| `alpha` | 0.1 | EMA 스무딩 계수 |
| `hourlyWeight` | 0.7 | 시간대 가중치 |
| `dailyWeight` | 0.3 | 요일 가중치 |

#### 장점

- **False Positive 감소**: 피크 시간대에 높은 임계값 자동 적용
- **미묘한 이상 탐지**: 조용한 시간대에 낮은 임계값으로 민감도 증가
- **수동 튜닝 불필요**: 온라인 학습으로 자동 조정

#### 성능

- **지연시간**: ~5-10ms
- **학습**: 온라인 (실시간 업데이트)

```typescript
// 사용 예시
import { AdaptiveThreshold } from './monitoring';

const adaptive = new AdaptiveThreshold();

// 학습 (지속적 호출)
adaptive.learn(currentMetrics, timestamp);

// 현재 시간대 임계값 조회
const threshold = adaptive.getThreshold('cpu', new Date());
// { upper: 75, lower: 10, confidence: 0.85 }
```

---

### 5. HybridAnomalyDetector

**전략**: Statistical + Isolation Forest 앙상블 투표

#### 가중치

| 탐지기 | 가중치 | 특성 |
|--------|--------|------|
| Statistical | 0.4 | 빠름, 단변량 |
| Isolation Forest | 0.6 | 정확, 다변량 |

#### 투표 로직

```
투표 임계값 = 0.5

Case 1: 둘 다 탐지 → 높은 신뢰도로 이상 판정
Case 2: 하나만 탐지 → 가중 투표로 결정
Case 3: 둘 다 미탐지 → 정상 (높은 신뢰도)
Case 4: 한쪽 실패 → Fallback으로 다른 쪽 결과 사용
```

```typescript
// 사용 예시
import { HybridAnomalyDetector } from './monitoring';

const hybrid = new HybridAnomalyDetector({
  statisticalWeight: 0.4,
  isolationForestWeight: 0.6,
  votingThreshold: 0.5
});

const result = hybrid.detect(metrics, history);
// { isAnomaly: true, severity: 'high', confidence: 0.91, method: 'ensemble' }
```

---

### 6. UnifiedAnomalyEngine

**아키텍처**: 3-way 앙상블 + EventEmitter

#### 가중치 (정규화)

| 탐지기 | 가중치 | 역할 |
|--------|--------|------|
| Statistical | 0.3 | 빠른 1차 필터 |
| Isolation Forest | 0.4 | 다변량 정밀 분석 |
| Adaptive | 0.3 | 시간대별 컨텍스트 |

#### 기능

| 기능 | 설명 |
|------|------|
| **Streaming Mode** | 실시간 메트릭 처리 |
| **Batch Mode** | 대량 히스토리 분석 |
| **Auto-Learning** | 지속적 모델 개선 |
| **Fallback Chain** | 탐지기 실패 시 우아한 성능 저하 |
| **Event Emission** | 알림 시스템 연동 |
| **Performance Tracking** | 지연시간, 처리량 모니터링 |

#### 이벤트

| 이벤트 | 페이로드 | 설명 |
|--------|----------|------|
| `anomaly` | `{ serverId, severity, metrics }` | 이상 탐지됨 |
| `prediction` | `{ serverId, trend, timeToThreshold }` | 예측 경고 |
| `error` | `{ detector, error }` | 탐지기 오류 |

#### 성능

- **총 지연시간**: ~20-50ms (3개 탐지기 병렬 실행)
- **처리량**: ~100-200 서버/초

```typescript
// 사용 예시
import { UnifiedAnomalyEngine } from './monitoring';

const engine = new UnifiedAnomalyEngine({
  statisticalWeight: 0.3,
  isolationForestWeight: 0.4,
  adaptiveWeight: 0.3,
  votingThreshold: 0.5,
  enableStreaming: true
});

// 이벤트 리스너
engine.on('anomaly', (event) => {
  console.log(`Anomaly detected on ${event.serverId}: ${event.severity}`);
  // 알림 전송, 로깅 등
});

engine.on('prediction', (event) => {
  console.log(`Warning: ${event.serverId} will breach threshold in ${event.timeToThreshold}`);
});

// 스트리밍 모드
engine.startStreaming();
engine.pushMetrics(serverMetrics);

// 배치 모드
const results = await engine.analyzeBatch(allServersMetrics);

// 통계 조회
const stats = engine.getStats();
// { totalProcessed: 1500, anomaliesDetected: 23, avgLatencyMs: 35 }
```

---

## Integration with AI Agents

### Analyst Agent Tools

| Tool | 사용 컴포넌트 | 설명 |
|------|---------------|------|
| `detectAnomalies` | UnifiedAnomalyEngine | 이상 탐지 실행 |
| `predictTrends` | TrendPredictor | 트렌드 예측 |
| `analyzePattern` | AdaptiveThreshold | 패턴 분석 |

### Frontend Integration

```
Dashboard                          AI Sidebar
    │                                  │
    ▼                                  ▼
ServerCard ────────────────────► "이상감지/예측" Panel
  - AI 분석: Unusual/Rising/...        │
  - Live Metrics                       ▼
                              POST /api/ai/intelligent-monitoring
                                       │
                                       ▼
                              UnifiedAnomalyEngine
                                       │
                              ┌────────┼────────┐
                              ▼        ▼        ▼
                         Statistical  IF   Adaptive
                              │        │        │
                              └────────┼────────┘
                                       ▼
                              Ensemble Result
                              + Trend Prediction
```

---

## Performance Summary

| 컴포넌트 | 지연시간 | 메모리 | 의존성 |
|----------|---------|--------|--------|
| SimpleAnomalyDetector | ~1-5ms | 낮음 | 없음 |
| IsolationForestDetector | ~10-50ms | 중간 | `isolation-forest` |
| TrendPredictor | <5ms | 낮음 | 없음 |
| AdaptiveThreshold | ~5-10ms | 낮음 | 없음 |
| HybridAnomalyDetector | ~15-55ms | 중간 | `isolation-forest` |
| UnifiedAnomalyEngine | ~20-50ms | 중간 | `isolation-forest` |

---

## Configuration Reference

### Environment Variables

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `ANOMALY_STATISTICAL_WEIGHT` | 0.3 | 통계 탐지기 가중치 |
| `ANOMALY_IF_WEIGHT` | 0.4 | Isolation Forest 가중치 |
| `ANOMALY_ADAPTIVE_WEIGHT` | 0.3 | 적응형 임계값 가중치 |
| `ANOMALY_VOTING_THRESHOLD` | 0.5 | 앙상블 투표 임계값 |
| `TREND_PREDICTION_HORIZON` | 3600 | 예측 범위 (초) |

---

## Related Documentation

- **[AI Engine Architecture](./ai-engine-architecture.md)** - 전체 AI 엔진 아키텍처
- **[AI Engine Internals](./ai-engine-internals.md)** - API, 데이터 계층, 환경변수
- **[Data Architecture](../data/data-architecture.md)** - 서버 데이터 아키텍처
