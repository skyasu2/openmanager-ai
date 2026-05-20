# 프로젝트 변천사 — 테세우스의 배

> Owner: project
> Status: Active Canonical
> Doc type: Explanation
> Last reviewed: 2026-05-20
> Canonical: docs/history/project-evolution.md
> Tags: history,evolution,architecture,milestone

> "테세우스의 배의 판자를 하나씩 교체하다 보면, 언제 원래 배가 아니게 되는가?"

OpenManager AI는 2025-05-23 첫 커밋 이후 약 363일 동안 **~8,400개 커밋**을 거쳤다.
이 문서는 그 과정에서 무엇이 유지되고, 무엇이 교체됐는지를 기록한다.

---

## 커밋 활동 추이

```
2025-05 :  389 ████
2025-06 :  996 ██████████  ← 초기 급성장
2025-07 :  567 ██████
2025-08 :  548 █████
2025-09 :  362 ████
2025-10 :  476 █████
2025-11 :  476 █████
2025-12 :  797 ████████  ← Cloud Run 도입
2026-01 :  755 ████████
2026-02 :  675 ███████  ← 배 이름이 바뀐 달
2026-03 :  707 ███████
2026-04 :  984 ██████████  ← 역대 최다 (04-18 하루 56건)
2026-05 :  840 █████████  (진행 중)
```

---

## 5개 시대

### 1세대 — 바이브 실험실 (2025-05-23 ~ 2025-11)

**버전**: `v0.1.0` → `v5.80` | **프로젝트명**: `openmanager-vibe-v5-clean`

Initial commit 시점의 파일 구조:

```
app/page.tsx
app/layout.tsx
docs/ (한국어 문서 9개)
```

- **스택**: Next.js 14, React 19, TypeScript, Supabase(2025-05-25), Redis
- **AI**: Python FastAPI + TensorFlow + MCP 라우터 직접 구현
- **데이터**: 실시간 시뮬레이션 (19개 서버)
- **배포**: GitHub Actions
- **특징**: `✅` `🚀` 이모지가 커밋 메시지에 가득한 탐색기

**2025-06-11 첫 번째 큰 판자 교체**

```
"Remove TensorFlow/FastAPI: Simplify AI orchestrator to MCP-focused architecture"
```

Python 엔진 전체가 제거되고 MCP 라우터 단일 구조로 전환.

---

### 2세대 — Cloud Run + LangGraph (2025-12 ~ 2026-01)

**버전**: `v5.80` → `v5.83`

| 날짜 | 사건 |
|------|------|
| 2025-12-08 | Cloud Functions → Cloud Run 마이그레이션 |
| 2025-12-13 | LangGraph multi-agent StateGraph 첫 도입 |
| 2025-12-14 | Cloud Run LangGraph 멀티에이전트 백엔드 추가 |
| 2026-01-31 | 24h 트렌드 LLM 컨텍스트 통합, Tavily 웹 검색 연동 |

이 시기 **12월 한 달에 797 커밋** — 아키텍처를 뜯어고치던 가장 격렬한 달.

---

### 3세대 — 배 이름이 바뀐 날 (2026-02-12)

**버전**: `v7.x` → `v8.0.0` | **프로젝트명**: `openmanager-vibe-v5` → **`openmanager-ai`**

2026-02-12 하루에 발생한 커밋들:

```
feat: rename project OpenManager VIBE v5 → OpenManager AI v8.0.0
refactor(vercel): migrate to OTel Standard Format
refactor(ai-engine): migrate tools to OTel Standard
fix: remove dead vector-db mock
```

테세우스의 배 역설에서 가장 극적인 순간. **배 이름 자체가 바뀌었다.**

| 항목 | 이전 | 이후 |
|------|------|------|
| 프로젝트명 | openmanager-vibe-v5 | openmanager-ai |
| 데이터 방식 | 실시간 시뮬레이션 | OTel 사전 생성 (24파일 × 18서버) |
| AI 컨텍스트 | vector-db mock | OTel structured context |
| 정체성 | "바이브 코딩 플레이그라운드" | "AI Native Server Monitoring" |

이 시점을 전후로 사실상 다른 프로젝트라고 볼 수 있다.

---

### 4세대 — Production 성숙 (2026-03 ~ 2026-04)

**버전**: `v8.7` → `v8.10`

| 날짜 | 사건 |
|------|------|
| 2026-03-07 | Multi-agent orchestration 프로덕션 활성화 |
| 2026-03-27 | GitLab CI 전환 (GitHub Actions 폐기), GitLab canonical repo |
| 2026-04-18 | 하루 56 커밋 (역대 최다 — 대규모 구조 정비) |

이 시기부터 QA 기록 체계화, SDD(Spec-Driven Development) 원칙 적용 시작.

---

### 5세대 — 숙성과 정리 (2026-05 ~ 현재)

**버전**: `v8.11.76` → 진행 중

- 2026-05-16: Orchestrator LLM routing → **Deterministic direct routing** 제거
- 2026-05-20: dead code 800줄+ 제거, circuit-breaker-store 삭제
- 2026-05-20: custom Redis fetch client → **@upstash/redis SDK** 통일

기능 추가 없이 **코드 순감소**가 일상화된 성숙기.
`test(spec):` 선행 → `feat:` 구현 패턴이 정착됐다.

---

## 판자 교체 요약

### 원래 배에서 지금도 남아있는 것

| 판자 | 도입 시점 | 상태 |
|------|-----------|------|
| Next.js + React + TypeScript | 2025-05-23 (Day 1) | **유지** (버전만 업) |
| Supabase | 2025-05-25 | **유지** |
| Tailwind CSS | 2025-05-23 | **유지** |
| App Router 구조 | 2025-05-23 | **유지** (src/ 이동만) |
| 한국어 우선 문서·커밋 | 2025-05-23 | **유지** |

### 교체된 판자들

| 판자 | 교체 전 | 교체 후 | 시점 |
|------|---------|---------|------|
| AI 엔진 | Python/TF/FastAPI | Custom multi-agent | 2025-06 |
| AI 프레임워크 | MCP 라우터 | LangGraph → Custom | 2025-12 → 2026-03 |
| LLM 라우팅 | LLM orchestration | Deterministic routing | 2026-05 |
| 데이터 방식 | 실시간 시뮬레이션 | OTel 사전생성 | 2026-02 |
| CI/CD | GitHub Actions | GitLab CI | 2026-03 |
| Redis 클라이언트 | custom fetch 구현 | @upstash/redis SDK | 2026-05 |
| 프로젝트 이름 | openmanager-vibe-v5 | openmanager-ai | 2026-02-12 |

---

## 결론

**"이것은 여전히 같은 배인가?"**

기능 계약(서버 모니터링 + AI 채팅)은 동일하다.
하지만 내부 판자의 약 **70%는 교체됐다.**

원래 배에서 남아있는 가장 오래된 판자는 코드가 아니다.
**"한국어로 만드는 Next.js AI 서버 모니터링"이라는 의도** 그 자체다.
