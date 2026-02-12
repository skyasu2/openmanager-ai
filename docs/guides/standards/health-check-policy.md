# 🏥 헬스체크 정책

> **작성**: 2025-11-21 08:07 KST
> **원칙**: 모든 헬스체크는 수동 테스트 전용, 자동 호출 금지

---

## 📋 정책

### ✅ 수동 테스트 전용

#### 1. `/api/ping` - 간단한 연결 테스트
```typescript
export const runtime = 'edge';

용도: 수동 테스트 전용
응답: { ping: "pong", timestamp: "..." }
캐싱: 없음 (no-store)
자동 호출: 금지
```

#### 2. `/api/health` - 상세 상태 확인
```typescript
export const runtime = 'nodejs';

용도: 수동 테스트 전용
응답: Database, Cache, AI 서비스 상태
캐싱: 없음 (force-dynamic)
자동 호출: 금지
```

---

## ❌ 금지 사항

### 1. 모든 자동 호출
```
❌ 외부 Uptime 모니터링 (UptimeRobot, Pingdom 등)
❌ Cron Job 자동 체크
❌ 백그라운드 모니터링
❌ 1분/5분 간격 자동 호출

이유: 불필요한 컴퓨팅 비용 발생
```

### 2. 캐싱 설정
```
❌ Cache-Control: public, max-age=60
❌ export const revalidate = 30

이유: 자동 호출 유도, 비용 발생
```

---

## 🎯 권장 사용법

### 수동 테스트만 허용
```bash
# 개발 중 간단한 연결 확인
curl https://openmanager-ai.vercel.app/api/ping

# 상세 상태 확인
curl https://openmanager-ai.vercel.app/api/health
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
/api/ping: 수동 테스트 ~3회/일
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
- [ ] 자동 호출 스크립트 작성 금지
- [ ] 외부 모니터링은 `/api/ping` 사용

### 운영
- [ ] Vercel Dashboard에서 호출 패턴 주기적 확인
- [ ] 비정상 호출 감지 시 즉시 차단
- [ ] 월간 비용 리포트 확인

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
