# 모니터링 & ML 엔진 아키텍처

> OpenManager AI Engine 이상탐지/예측 로직의 현재 배포 기준 아키텍처
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-05
> Canonical: docs/reference/architecture/ai/monitoring-ml.md
> Tags: monitoring,ml,anomaly-detection,trend-prediction,architecture

## Overview

현재 배포 엔진의 ML 계층은 **경량 커스텀 TypeScript** 중심으로 운영합니다.

| 기능 | 현재 구현 | 의존성 |
|---|---|---|
| 이상 탐지 | `SimpleAnomalyDetector` (이동평균 + 2σ) | 없음 |
| 트렌드 예측 | `TrendPredictor` (선형회귀 + R²) | 없음 |
| 임계값 도달/복귀 예측 | `TrendPredictor.enhanced` | 없음 |

## 현재 코드 기준 (SSOT)

```text
cloud-run/ai-engine/src/lib/ai/monitoring/
├── SimpleAnomalyDetector.ts
├── TrendPredictor.ts
├── TrendPredictor.enhanced.ts
└── TrendPredictor.types.ts
```

2026-05-05 random review에서 위 파일과 Analyst/Reporter tool 참조가 여전히 유지됨을 코드 검색으로 확인했습니다. 운영 경로는 경량 TypeScript detector/predictor와 threshold/statistical scan 중심이며, 오픈소스 ML 재도입 조건은 변경하지 않습니다.

## 변경 이력 요약 (2026-02)

아래 구성은 코드베이스에서 제거되었습니다.

- `isolation-forest` 기반 탐지기
- `HybridAnomalyDetector`
- `UnifiedAnomalyEngine`
- `AdaptiveThreshold`

제거 사유:

1. 실제 런타임 경로 미사용(유지비만 발생)
2. 문서/구현 불일치로 운영 혼선 발생
3. Cloud Run 환경에서 cold start/메모리/운영 복잡도 대비 실효성 부족

## 커스텀 vs 오픈소스(예: Isolation Forest) 판단

### 현재 유지 판단: 커스텀 유지가 우선

| 관점 | 커스텀 경량 TS | Isolation Forest 계열 |
|---|---|---|
| 지연시간/예측가능성 | 매우 높음 (단순 O(n)) | 데이터/트리 수에 따라 변동 |
| 운영 복잡도 | 낮음 | 모델 학습/버전/드리프트 관리 필요 |
| 디버깅/설명가능성 | 높음 (수식 명확) | 중간 (점수 해석 계층 필요) |
| 현재 데이터 스케일 적합성 | 높음 | 과투자 가능성 |
| 의존성 리스크 | 낮음 | 패키지/보안/호환 리스크 증가 |

결론:

- **현 시점(현재 트래픽·데이터 스케일)에서는 커스텀 구현 유지가 더 합리적**입니다.
- 오픈소스 도입은 “정확도 개선 이득이 운영비를 상회”하는 근거가 있을 때만 재검토합니다.

## Isolation Forest를 현재 쓰지 않는 이유

1. 배포 경로에서 사용되지 않아 실질 효과가 없었음
2. 학습/파라미터 튜닝/해석 레이어까지 포함하면 운영비가 커짐
3. 현행 요구사항(실시간성, 설명 가능성, 저비용)과 우선순위 불일치

### 안 쓰면 제거가 맞는가?

- **네. 사용 경로가 없으면 제거가 맞습니다.**
- 저장소 내 참조/테스트/문서를 함께 정리해 “죽은 코드” 상태를 방지해야 합니다.

## “존재만 하고 안 쓰는 것” 점검 기준

정기 점검 시 아래를 함께 확인합니다.

1. 런타임 엔트리포인트(`src/server.ts`)에서 도달 가능한가
2. 스크립트/배치 경로에서 실사용되는가
3. 테스트에서만 살아 있고 운영 경로는 없는가
4. 문서가 현재 코드와 일치하는가

운영 원칙:

- 운영 경로 미사용 + 향후 도입 계획 없음 → 제거
- 운영 경로 미사용 + 단기 도입 계획 있음 → `experimental/`로 격리 + 로드맵 명시

## 현재 상태 반영(2026-02-24)

- `detectAnomalies` 단일 서버 탐지는 임계값 + 통계 기반 하이브리드 판정을 유지하며, 판정 근거를 구조화해 전달합니다.
  - `decisionSource`: `threshold | statistical | threshold+statistical`
  - `confidenceBasis`: 규칙/통계 신뢰 근거 문자열
  - `rationale`: `string[]` 근거 토큰
- `detectAnomaliesAllServers`는 임계치 기반 스캔 + 1시간 선형 예측 경로를 유지하여 비용/지연 우선 정책을 보존합니다.
- 베이스라인 표류(Baseline Drift) 감지는 최근 6시간 데이터를 전/후반부로 나눠 평균 차이가 일정 시그마를 넘으면 표류로 분류합니다.
- `DecisionSource` 및 `AnalysisBasis` 메타데이터를 통해 임계값 초과/통계 이탈 근거를 구조화해 반환합니다.

## 추세 예측 구현 메모

- 선형 회귀와 결정계수(`R^2`)를 함께 사용해 예측 방향성과 신뢰도를 계산합니다.
- CPU/Memory/Disk 같은 백분율 메트릭에는 포화 모델(Damped Overshoot)을 적용해 100%를 비현실적으로 초과하는 예측을 완화합니다.
- 임계값 도달 ETA뿐 아니라, 장애 상태에서 우하향 추세인 경우 정상 복귀 ETA도 계산합니다.

## 비교 요약

| 비교 항목 | 기본 Cloud 알람 | OpenManager AI 현재 구현 | 엔터프라이즈 모니터링 (ML 적용) |
| :--- | :--- | :--- | :--- |
| 탐지 방식 | 정적 임계값 (예: > 80%) | 정적 임계값 + 통계적 동적 밴드 + Drift 감지 | 딥러닝(LSTM, Prophet), 계절성 반영 |
| 추세 예측 | 미지원 | 선형 회귀 + 포화 감속 방어 로직 + ETA 계산 | 다항 회귀, 비선형 시계열 예측 |
| 설명 가능성 | 낮음 | 높음 (근거 토큰, decisionSource 명시) | 보통 (블랙박스 모델인 경우 해석 난해) |
| 연산 비용 | 매우 낮음 | 매우 낮음 (경량 TypeScript, 추가 API 호출 없음) | 매우 높음 (별도 AI 서버 필요) |

## 향후 재도입(오픈소스 ML) 트리거

아래 3개 이상 충족 시 Isolation Forest/대체 모델 재평가:

1. 이상 탐지 precision/recall 목표가 현행 대비 유의미하게 미달
2. 다변량 상호작용(메트릭 간 비선형 관계) 오탐/미탐이 반복
3. 월간 트래픽/서버 수 증가로 단순 통계식 한계가 관측
4. 오프라인 백테스트에서 F1/MTTD 개선이 운영비 증가를 상회

## 관련 문서

- [AI Engine Architecture](./ai-engine-architecture.md)
