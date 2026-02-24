# Monitoring & ML Engine

> OpenManager AI Engine 이상탐지/예측 로직의 현재 배포 기준 아키텍처
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-24
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

## 향후 재도입(오픈소스 ML) 트리거

아래 3개 이상 충족 시 Isolation Forest/대체 모델 재평가:

1. 이상 탐지 precision/recall 목표가 현행 대비 유의미하게 미달
2. 다변량 상호작용(메트릭 간 비선형 관계) 오탐/미탐이 반복
3. 월간 트래픽/서버 수 증가로 단순 통계식 한계가 관측
4. 오프라인 백테스트에서 F1/MTTD 개선이 운영비 증가를 상회

## 관련 문서

- [AI Engine Architecture](./ai-engine-architecture.md)
