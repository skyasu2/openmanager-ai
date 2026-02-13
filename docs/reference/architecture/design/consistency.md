# Data Consistency Strategy

> **프로젝트 버전**: v8.0.0 | **최종 업데이트**: 2026-02-13

**문제**: 모니터링과 AI가 서로 다른 메트릭을 표시하는 일관성 문제 해결

## 🎯 문제 정의

### 현재 상황

```
대시보드: "웹서버 CPU 75%"
AI 어시스턴트: "웹서버 CPU 82%"
사용자: "뭐가 맞는거지?" 😕
```

**원인**: 각각 다른 타임스탬프로 메트릭 계산

## 🔧 해결책: 통합 메트릭

### 1. 시간 정규화

```typescript
// 1분 단위 정규화
const normalizeTimestamp = (timestamp: number): number => {
  const minute = 60 * 1000;
  return Math.floor(timestamp / minute) * minute;
};

// 14:32:15.347 → 14:32:00.000
// 14:32:59.999 → 14:32:00.000
```

### 2. 통합 API 엔드포인트

```typescript
// /api/metrics/current - 단일 진실 소스
export async function GET() {
  const normalizedTime = normalizeTimestamp(Date.now());
  const servers = generateMetrics(normalizedTime);
  
  return NextResponse.json({
    timestamp: normalizedTime,
    servers,
    validUntil: normalizedTime + 60000 // 1분 유효
  });
}
```

### 3. 공통 데이터 소스

#### 모니터링 대시보드

```typescript
// 통합 API 사용
const fetchMetrics = async () => {
  const response = await fetch('/api/metrics/current');
  const data = await response.json();
  
  // 같은 분 내에서 캐싱
  const cacheKey = `metrics-${data.timestamp}`;
  localStorage.setItem(cacheKey, JSON.stringify(data));
  
  return data;
};
```

#### AI 어시스턴트

```typescript
// 동일한 API 호출
class AIEngine {
  private async getCurrentMetrics(): Promise<ServerMetrics[]> {
    const response = await fetch('/api/metrics/current');
    return response.json();
  }
  
  async analyzeServers(query: string): Promise<string> {
    const metrics = await this.getCurrentMetrics();
    // 모니터링과 동일한 데이터 기준으로 분석
    return this.generateResponse(metrics, query);
  }
}
```

## 📊 일관성 보장 구조

### 시간 계층

```
24시간 순환 (86,400초)
├── 10분 기준점 (144개 슬롯)  
├── 1분 정규화 (실사용 단위)
└── 30초 캐싱 (성능 최적화)
```

### 클라이언트 캐싱

```typescript
// 30초 캐싱으로 중복 호출 방지
class MetricsCache {
  private cache = new Map<string, CachedMetrics>();
  
  async getMetrics(): Promise<ServerMetrics[]> {
    const normalizedTime = normalizeTimestamp(Date.now());
    const cacheKey = `metrics-${normalizedTime}`;
    
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached.data;
    }
    
    // 새로 페치 후 캐싱
    const response = await fetch('/api/metrics/current');
    const data = await response.json();
    
    this.cache.set(cacheKey, {
      data: data.servers,
      fetchedAt: Date.now(),
      validUntil: normalizedTime + 60000
    });
    
    return data.servers;
  }
}
```

## 🔍 일관성 검증

### 자동 검증 메커니즘

```typescript
// 데이터 일관성 테스트
const verifyConsistency = async () => {
  const dashboardMetrics = await fetchMetricsForDashboard();
  const aiMetrics = await fetchMetricsForAI();
  
  const timestamp1 = normalizeTimestamp(dashboardMetrics.timestamp);
  const timestamp2 = normalizeTimestamp(aiMetrics.timestamp);
  
  console.assert(timestamp1 === timestamp2, '타임스탬프 불일치');
  console.assert(
    JSON.stringify(dashboardMetrics) === JSON.stringify(aiMetrics),
    '메트릭 데이터 불일치'
  );
};
```

## 📈 효과 분석

### Before vs After

| 항목 | 기존 방식 | 개선 방식 | 효과 |
|------|-----------|----------|------|
| **데이터 일관성** | 불일치 위험 | 완전 일치 | 혼란 해소 |
| **API 호출** | 각각 호출 | 통합 API | 중복 제거 |
| **캐싱 효과** | 없음 | 30초 캐시 | 성능 향상 |
| **디버깅** | 어려움 | 단일 소스 | 추적 용이 |

### 사용자 경험 개선

```
✅ 개선 후:
사용자: "웹서버 CPU가 몇 %인가요?"
AI: "현재 웹서버-01 CPU는 78%입니다."
대시보드: [78% 표시] 완벽 일치!
```

## ⚠️ 트레이드오프

### 실시간성 vs 일관성

- **실시간성**: 1분 정규화로 최대 60초 지연
- **일관성**: 완벽한 데이터 일치 보장
- **선택**: 포트폴리오에서는 일관성이 더 중요

### 캐싱 전략

```typescript
// 분 경계에서 자동 캐시 만료
const isNextMinute = (cached: number, current: number) => {
  return normalizeTimestamp(cached) !== normalizeTimestamp(current);
};

// 캐시 유효성 검사
if (isNextMinute(cachedTime, currentTime)) {
  invalidateCache();
}
```

## 🚀 구현 단계

### Phase 1: 통합 API ✅ 완료
- ✅ FNV-1a 해시 메트릭 생성 완료
- ✅ 시간 정규화 로직 (`cycle-engine.ts`)
- ✅ `/api/metrics/current` 엔드포인트

### Phase 2: 시스템 통합 ✅ 완료
- ✅ 모니터링 대시보드 SSOT 통합 (`MetricsProvider` → otel-processed + hourly-data)
- ✅ AI 어시스턴트 데이터 소스 통합 (`hourly-data/*.json`)
- ✅ 클라이언트 캐싱 (30초 기반)

### Phase 3: 검증 시스템 ⏳ 부분 구현
- ✅ E2E 테스트 일관성 검증
- ⏳ 실시간 검증 메커니즘 (미구현 - 현재 필요성 낮음)
- ✅ 에러 처리 및 폴백

## 💡 핵심 이점

### 1. 완벽한 데이터 일치
**단일 진실 소스**로 모든 컴포넌트가 동일한 데이터 참조

### 2. 성능 최적화
- 1분 정규화로 불필요한 계산 방지
- 30초 캐싱으로 중복 API 호출 제거

### 3. 개발 편의성
- 디버깅 시 일관된 데이터 보장
- 테스트 작성 및 검증 용이
- 단일 소스로 유지보수 간소화

## 🎯 결론

**모니터링-AI 데이터 일관성**은 사용자 경험의 핵심입니다.

통합 메트릭 API + 시간 정규화로 **"AI와 대시보드가 다른 값을 보여준다"**는 혼란을 완전히 해결할 수 있습니다.
