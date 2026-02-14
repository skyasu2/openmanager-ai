# AI Clarification UI 분석 리포트

> **작성일**: 2026-02-02
> **대상 버전**: v7.1.4
> **분석 범위**: Clarification UI 구현 분석 + 업계 베스트 프랙티스 비교

---

## 1. 기능 개요

사용자가 모호한 질문을 입력하면 AI가 바로 응답하지 않고, **구조화된 옵션 버튼**을 제시하여 의도를 명확히 한 뒤 응답하는 기능.

```
사용자: "서버 상태 알려줘"
    ↓ (신뢰도 < 85%, 복잡도 >= 2)
AI: "조금 더 구체적으로 알려주세요"
    [📊 전체 서버 현황] [🎯 Web 서버만] [🎯 DB 서버만] [🎯 로드밸런서만]
    [직접 입력하기]
    ↓ (사용자 선택)
AI: 명확화된 쿼리로 응답 생성
```

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  UI Layer                                           │
│  ClarificationDialog.tsx                            │
│  - 옵션 버튼 (카테고리별 색상/아이콘)               │
│  - 직접 입력 폼                                     │
│  - 취소/건너뛰기 버튼                               │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Hook Layer                                         │
│  useHybridAIQuery.ts → useClarificationHandlers.ts  │
│  - 쿼리 분류 → 명확화 필요 여부 판단                │
│  - selectClarification / skipClarification 등        │
└──────────────────────┬──────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Analysis Layer                                     │
│  query-classifier.ts + clarification-generator.ts   │
│  - 신뢰도/복잡도 계산                               │
│  - 도메인 패턴 매칭 → 옵션 자동 생성                │
└─────────────────────────────────────────────────────┘
```

### 파일 위치

| 계층 | 파일 |
|------|------|
| UI | `src/components/ai-sidebar/ClarificationDialog.tsx` |
| Hook (통합) | `src/hooks/ai/useHybridAIQuery.ts` |
| Hook (핸들러) | `src/hooks/ai/core/useClarificationHandlers.ts` |
| 분류기 | `src/lib/ai/query-classifier.ts` |
| 옵션 생성기 | `src/lib/ai/clarification-generator.ts` |
| 테스트 | `src/lib/ai/clarification-generator.test.ts` |

---

## 3. 트리거 조건

```typescript
needsClarification(confidence, complexity):
  confidence < 85 AND complexity >= 2
```

| 신뢰도 | 복잡도 | 명확화 |
|:------:|:------:|:------:|
| >= 85% | 모든 수준 | 스킵 |
| < 85% | 1 (simple) | 스킵 |
| < 85% | >= 2 (moderate+) | **트리거** |

### 신뢰도 가산 요소

| 조건 | 가산 |
|------|:----:|
| 기본값 | 70 |
| 쿼리 길이 > 50자 | +10 |
| 쿼리 길이 < 10자 | -20 |
| 서버명 명시 (mysql, nginx 등) | +15 |
| 시간 범위 명시 (최근, N시간 등) | +10 |

### 자동 스킵 조건 (재명확화 방지)

| 패턴 | 예시 |
|------|------|
| 숫자 조건 | `92%`, `TOP 5`, `3개` |
| 상태 조건 | `경고 상태인`, `정상인` |
| 비교 조건 | `가장 높은`, `최대` |
| 명확화 접미사 | `(전체 서버)`, `(최근 24시간)` |

---

## 4. 옵션 생성 규칙

| 우선순위 | 패턴 | 트리거 조건 | 생성 옵션 |
|:--------:|------|-----------|-----------|
| 1 | SERVER | "서버"/"상태" + 제품명 미포함 | 전체/Web/DB/LB/캐시 |
| 2 | TIME | "추이"/"변화" + 시간 미지정 | 1시간/24시간/7일 |
| 3 | METRIC | "성능"/"문제" + 메트릭 미지정 | CPU/메모리/전체 요약 |
| 4 | INTENT | intent='analysis' | 근본 원인 분석 |
| 5 | SHORT | 쿼리 < 10자 | 서버상태/알림확인/도움말 |

### 카테고리별 UI

| 카테고리 | 아이콘 | 색상 |
|---------|:------:|------|
| `scope` | 📊 | 초록색 |
| `specificity` | 🎯 | 파란색 |
| `timerange` | ⏰ | 주황색 |
| `custom` | ✏️ | 보라색 |

---

## 5. 사용자 선택지 (4가지)

| 선택지 | 동작 |
|--------|------|
| **옵션 선택** | 명확화된 쿼리(`suggestedQuery`)로 AI 호출 |
| **직접 입력** | 원본 + 커스텀 텍스트 조합하여 AI 호출 |
| **건너뛰기** | 원본 쿼리 그대로 AI 호출 |
| **취소 (X)** | 아무것도 실행하지 않음, 상태 정리 |

---

## 6. 업계 베스트 프랙티스 비교

### 주요 플랫폼 비교

| 패턴 | ChatGPT | Claude.ai | Gemini | Copilot | **현재 구현** |
|------|:-------:|:---------:|:------:|:-------:|:-----------:|
| 모호한 쿼리 시 명확화 | X | O (텍스트) | O (텍스트) | 부분적 | **O (버튼)** |
| Conversation Starters | O | O | O | O | **O (4개)** |
| Suggested Reply Chips | O | X | O | O | **O (카테고리별)** |
| 커스텀 입력 폴백 | - | O | O | - | **O** |
| 취소/건너뛰기 | - | - | - | - | **O** |
| 재명확화 방지 | - | - | - | - | **O** |

### NN/g Prompt Controls 연구 기준 평가

[Nielsen Norman Group 연구](https://www.nngroup.com/articles/prompt-controls-genai/)에서 제시한 4가지 원칙:

| 원칙 | 현재 구현 | 평가 |
|------|-----------|:----:|
| 아이콘 + 라벨 병행 | 카테고리 이모지 + 텍스트 라벨 | PASS |
| 기능 명칭 명확화 | "전체 서버 현황", "Web 서버만" 등 구체적 | PASS |
| 기능별 그룹핑 | 4개 카테고리 분리 (scope/specificity/timerange/custom) | PASS |
| 기존 디자인 컨벤션 준수 | 버튼 칩, X 닫기, 인풋 필드 등 표준 패턴 | PASS |

### NN/g 4대 Use Case 매핑

| Use Case | NN/g 권장 패턴 | 현재 구현 |
|----------|--------------|-----------|
| Feature Discovery | 툴팁, 라벨 | Conversation Starters 4개 |
| Education & Inspiration | 프롬프트 라이브러리 | 바로가기 (서버상태, 장애분석, 성능예측, 보고서) |
| Constraint Setting | 토글, 드롭다운 | 명확화 옵션으로 범위 제한 |
| Facilitating Followups | Quick-action 버튼 | 피드백 버튼 (복사, 좋아요, 개선 필요, 다시 생성) |

---

## 7. 차별화 포인트

현재 구현이 업계 대비 앞서 있는 영역:

### 7.1 구조화된 명확화 (vs 텍스트 기반)

대부분의 AI 챗봇(Claude.ai, Gemini)은 텍스트로 "어떤 서버를 말씀하시나요?"라고 질문. 현재 구현은 **클릭 가능한 옵션 버튼**으로 제시하여 인터랙션 비용이 낮음.

- NN/g 연구: "Prompt controls eliminate 'can you' prompts — users don't need to ask whether the bot supports a feature"
- 텍스트 입력 대비 클릭 1회로 의도 전달 완료

### 7.2 신뢰도 기반 자동 판단

`confidence < 85% AND complexity >= 2` 조건으로 필요할 때만 트리거. 모든 쿼리에 명확화를 강제하지 않아 사용자 피로도 최소화.

### 7.3 재명확화 방지 메커니즘

`(전체 서버)` 접미사, 숫자 조건(`92%`, `TOP 5`), 상태 조건(`경고 상태인`) 패턴을 감지하여 명확화 루프 차단. Cold Start 재시도 시에도 명확화된 쿼리를 저장하여 재명확화 방지.

### 7.4 4가지 사용자 제어권

옵션 선택 / 커스텀 입력 / 건너뛰기 / 취소 — 업계 최다 수준의 선택지 제공.

### 7.5 도메인 특화 옵션 생성

서버 모니터링 도메인에 맞춘 서버 타입, 시간 범위, 메트릭 종류별 자동 옵션 생성.

---

## 8. QA 검증 결과 (2026-02-02)

Vercel Production에서 Playwright MCP로 검증:

| 항목 | 결과 |
|------|:----:|
| 바로가기 버튼 → 텍스트 자동 입력 | PASS |
| Clarification 옵션 4개 표시 | PASS |
| 옵션 선택 → 명확화된 쿼리 실행 | PASS |
| AI 응답 수신 (Cloud Run 경유) | PASS |
| 응답 내용 정확성 | PASS |

---

## 9. 향후 개선 고려 (선택적)

| 항목 | 현황 | 업계 트렌드 | 우선순위 |
|------|------|-----------|:--------:|
| 응답 후 후속 질문 칩 | 미구현 | ChatGPT/Gemini 응답 하단에 제시 | 낮음 |
| A/B 테스트 기반 최적화 | 미구현 | NN/g 권장 | 낮음 |
| 감정 인식 적응형 톤 | 미구현 | 2026 트렌드 | 낮음 |

---

## 10. 결론

현재 Clarification UI 구현은 **업계 베스트 프랙티스에 충분히 부합하며, 구조화된 옵션 버튼 방식과 재명확화 방지 메커니즘에서는 업계 선도 수준**. NN/g의 4가지 Prompt Controls 원칙을 모두 충족하고, ChatGPT/Claude.ai/Gemini 대비 더 낮은 인터랙션 비용과 더 풍부한 사용자 제어권을 제공.

---

## References

- [Prompt Controls in GenAI Chatbots - Nielsen Norman Group](https://www.nngroup.com/articles/prompt-controls-genai/)
- [AI Chatbot UX: 2026's Top Design Best Practices](https://www.letsgroto.com/blog/ux-best-practices-for-ai-chatbots)
- [Top Chatbot UX Tips and Best Practices for 2025](https://www.netguru.com/blog/chatbot-ux-tips)
- [24 Chatbot Best Practices - Botpress](https://botpress.com/blog/chatbot-best-practices)
- [The Ultimate Guide to AI Chatbots - Mockplus](https://www.mockplus.com/blog/post/guide-to-ai-chatbots-best-practices-examples)
