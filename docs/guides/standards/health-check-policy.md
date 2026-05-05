# 🏥 헬스체크 정책

> 수동 테스트 전용 헬스체크 운영 원칙과 금지사항
> Owner: documentation
> Status: Active
> Doc type: Policy
> Last reviewed: 2026-05-05
> Canonical: docs/guides/standards/health-check-policy.md
> Tags: health-check,policy,operations
>
> **작성**: 2025-11-21 08:07 KST
> **원칙**: 주기적 외부 uptime 자동 호출 금지. 수동 점검, 배포 smoke, QA gate에서만 제한적으로 사용

---

## 📋 정책

### ✅ 수동 테스트 전용

#### 1. `/api/health?simple=true` - 간단한 연결 테스트
```typescript
export async function GET(request: NextRequest) {
  // ?simple=true 일 때 { ping: "pong", timestamp } 반환
}
```

#### 2. `/api/health` - 상세 상태 확인
```typescript
// Next.js 16 Route Handler
// runtime 기본값은 'nodejs'
// GET Route Handler는 기본적으로 캐시되지 않음
// 이 엔드포인트는 응답 헤더 + 모듈 캐시(60초 TTL)로만 비용을 제어함
```

- 용도: 수동 테스트 전용
- 응답: Database, Cache, AI 서비스 상태
- 캐싱: 응답 레벨 `Cache-Control` + 모듈 메모리 캐시(60초 TTL)
- 자동 호출: 주기적 uptime/cron 호출 금지. 배포 직후 smoke와 QA gate는 허용

#### 3. `/api/health?service=ai&soft=true` - AI soft health

- 용도: Cloud Run cold-start와 recoverable degraded 상태를 UI/QA에서 구분
- 응답: AI health status, latency, recoverable reason
- 정책: warming/degraded를 즉시 치명적 장애로 캐시하지 않음

---

## ❌ 금지 사항

### 1. 모든 자동 호출
```
❌ 외부 Uptime 모니터링 (UptimeRobot, Pingdom 등)
❌ Cron Job 자동 체크
❌ 백그라운드 모니터링
❌ 1분/5분 간격 자동 호출

이유: 불필요한 컴퓨팅 비용 발생

허용:
- 로컬 개발 중 수동 확인
- GitLab/Vercel/Cloud Run 배포 직후 smoke
- Playwright MCP 최종 QA에서 필요한 최소 호출
```

### 2. 캐싱 설정
```
❌ 외부 모니터링을 전제로 한 짧은 주기 호출
❌ 비용 절감을 무시한 무제한 dynamic polling

허용: 수동 테스트 전용의 응답 캐시/짧은 TTL 최적화
이유: 자동 호출을 금지하는 정책과, 수동 점검 시 비용/지연을 낮추는 구현은 별개
```

---

## 🎯 권장 사용법

### 수동 테스트만 허용
```bash
# 개발 중 간단한 연결 확인
curl "https://openmanager-ai.vercel.app/api/health?simple=true"

# 상세 상태 확인
curl https://openmanager-ai.vercel.app/api/health

# AI soft health
curl "https://openmanager-ai.vercel.app/api/health?service=ai&soft=true"
```

### 시스템 모니터링
```
Vercel Dashboard > Analytics
- 실제 사용자 트래픽 확인
- 에러율 모니터링
- 외부 헬스체크 불필요
```

---

## 💰 비용 영향

### 현재 구성 (최적)
```
/api/health?simple=true: 수동 테스트 ~3회/일
/api/health: 수동 테스트 ~2회/일

총 비용: ~$0 (무시 가능)
```

### 잘못된 구성 (예시)
```
외부 모니터링 5분 간격:
- 288회/일 × 30일 = 8,640회/월
- Edge Runtime이어도 불필요한 호출

❌ 리소스 낭비
```

---

## 📝 체크리스트

### 개발자
- [ ] `/api/health`는 수동 테스트만 사용
- [ ] `/api/health?simple=true`는 `/api/ping` 대체 경로로만 사용
- [ ] 자동 호출 스크립트 작성 금지
- [ ] 외부 모니터링 도입 대신 Vercel Dashboard/Usage 확인

### 운영
- [ ] Vercel Dashboard에서 호출 패턴 주기적 확인
- [ ] 비정상 호출 감지 시 즉시 차단
- [ ] 월간 비용 리포트 확인
- [ ] QA/배포 smoke 호출은 `reports/qa` evidence와 함께 기록

---

## 🔍 모니터링

### 비정상 패턴 감지
```bash
# Vercel Logs 확인
vercel logs | grep "/api/health" | wc -l

# 1시간에 10회 이상이면 조사 필요
```

### 알림 설정
```
Vercel Dashboard > Settings > Notifications
- Function 사용량 80% 도달 시 알림
- 비정상 트래픽 감지 시 알림
```

---

**정책 시행**: 2025-11-21부터  
**검토 주기**: 월 1회

## 관련 문서

- [Operations](../../operations/README.md)
- [Deployment Architecture](../../architecture/03-deployment-architecture.md)
- [API Contracts](../../reference/api/contracts.md)
