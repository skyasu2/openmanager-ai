# Architecture Rules

## Quick Reference

| 질문 | 답변 |
|------|------|
| UI 컴포넌트 어디에? | `src/components/{feature}/` |
| API 라우트 어디에? | `src/app/api/{domain}/route.ts` |
| 비즈니스 로직 어디에? | `src/services/{domain}/` |
| AI 관련 코드 어디에? | `src/lib/ai/` 또는 `cloud-run/ai-engine/` |
| 타입 정의 어디에? | `src/types/{domain}.ts` |
| 훅 어디에? | `src/hooks/{feature}/` |

## Directory Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API Routes (REST)
│   └── (pages)/        # Page components
├── components/          # UI 컴포넌트 (feature별)
│   ├── dashboard/
│   ├── ai-sidebar/
│   └── ui/             # 공용 UI (Button, Card...)
├── hooks/               # Custom Hooks (feature별)
│   └── ai/             # AI 관련 훅
├── services/            # 비즈니스 로직, API 클라이언트
├── lib/                 # 핵심 유틸리티
│   └── ai/             # AI 유틸리티
├── stores/              # Zustand 상태관리
└── types/               # TypeScript 타입

cloud-run/ai-engine/     # AI Engine (별도 배포)
└── src/
    ├── agents/         # Multi-Agent 정의
    ├── tools/          # Agent 도구
    └── data/           # 사전 계산 데이터
```

## Hybrid Architecture (When to Use)

### Vercel (Frontend) - 사용 시점
- UI 렌더링, 상호작용
- 빠른 응답 필요 (<100ms)
- Edge Runtime 활용
- 경량 API 처리

### Cloud Run (AI Engine) - 사용 시점
- LLM 호출, Multi-Agent 오케스트레이션
- Heavy Lifting (>3초 처리)
- RAG 파이프라인
- 복잡한 분석 작업

```
[User] → [Vercel/Next.js] ──→ [Cloud Run/AI Engine]
              │                       │
         빠른 응답              무거운 AI 처리
         UI/API                  Multi-Agent
```

## 파일 생성 가이드

### 새 API 엔드포인트
```
위치: src/app/api/{domain}/route.ts
예시: src/app/api/servers/[id]/route.ts
```

### 새 컴포넌트
```
위치: src/components/{feature}/{ComponentName}.tsx
예시: src/components/dashboard/ServerCard.tsx
훅 필요시: src/hooks/{feature}/use{Feature}.ts
```

### 새 AI 기능
```
Vercel 측: src/lib/ai/{feature}.ts
Cloud Run 측: cloud-run/ai-engine/src/{agents|tools}/
```

## Data Source (SSOT)

**Single Source of Truth**: `src/data/hourly-data/hour-XX.json`

| 컴포넌트 | 파일 | 역할 |
|---------|------|------|
| 데이터 원본 | `src/data/hourly-data/*.json` | 24시간 시나리오 (번들 포함) |
| Vercel 소비 | `src/services/data/UnifiedServerDataSource.ts` | API 제공 |
| AI 소비 | `cloud-run/ai-engine/src/data/precomputed-state.ts` | AI 컨텍스트 |

**주의**: 메트릭 수정 시 Dashboard와 AI 응답 **양쪽 확인** 필수

## Anti-Patterns (하지 말 것)

| 잘못된 패턴 | 올바른 방법 |
|------------|------------|
| `src/` 루트에 파일 생성 | feature별 폴더에 배치 |
| API에서 직접 LLM 호출 | Cloud Run AI Engine 위임 |
| 컴포넌트에 비즈니스 로직 | `services/`로 분리 |
| 하드코딩된 서버 데이터 | `hourly-data/*.json` 사용 |
| `any` 타입 사용 | 명시적 타입 정의 |

## Import 패턴

```typescript
// ✅ Good: 절대 경로
import { ServerCard } from '@/components/dashboard/ServerCard';
import { useServerStatus } from '@/hooks/dashboard/useServerStatus';
import type { ServerMetrics } from '@/types/metrics';

// ❌ Bad: 상대 경로 (깊은 중첩)
import { ServerCard } from '../../../components/dashboard/ServerCard';
```

## 핵심 파일 참조

| 용도 | 파일 |
|------|------|
| AI Supervisor API | `src/app/api/ai/supervisor/route.ts` |
| 메트릭 제공자 | `src/services/metrics/MetricsProvider.ts` |
| AI 훅 (메인) | `src/hooks/ai/useAIChatCore.ts` |
| 상태 관리 | `src/stores/useAISidebarStore.ts` |
| AI Engine 진입점 | `cloud-run/ai-engine/src/index.ts` |

---

**See Also**: 상세 아키텍처 → `docs/reference/architecture/`
- 시스템 전체 (Hybrid 포함): `system/system-architecture-current.md`
- AI 엔진: `ai/ai-engine-architecture.md`
