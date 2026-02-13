# AI 도구 표준 가이드

> **통합 문서**: ai-coding-standards.md + ai-usage-guidelines.md
> **최종 갱신**: 2026-02-13 (v8.0.0)
>
> **Note**: Qwen 제거 (2026-01-07) - 평균 201초 응답, 13.3% 실패율로 2-AI 단순화

---

## Policy SSOT

- 멀티 에이전트 공통 운영 정책의 SSOT는 루트 `AGENTS.md`입니다.
- 이 문서는 도구 사용 가이드/운영 팁에 집중합니다.
- 공통 정책과 충돌 시 `AGENTS.md`를 우선 적용합니다.

## Quick Reference

```bash
# 코드 리뷰 순환 (자동)
git commit -m "feat: 기능"  # → Codex ↔ Gemini 1:1

# 수동 호출
Task codex-wrapper "실무 검증"
Task gemini-wrapper "아키텍처 분석"
```

---

## 1. 핵심 코딩 규칙

모든 AI 도구(Codex, Gemini, Claude Code)가 준수하는 규칙:

### 가독성 (Readability)
- **명확한 네이밍**: `userCount` vs `u` 처럼 의도가 드러나는 이름
- **함수 분리**: 하나의 함수는 "한 가지 일"만 수행
- **스타일 준수**: 프로젝트 컨벤션 일관성 유지

### 간결함 (Simplicity)
- **KISS 원칙**: 과도한 기교보다 단순하고 명료한 구현
- **매직 넘버 제거**: 의미 있는 상수로 대체
- **UX Obsession**: 사용자 경험 최우선

### 유지보수성 (Maintainability)
- **미래 고려**: 확장 가능한 코드 구조
- **SOLID 원칙**: 모듈화, 관심사 분리, 응집도/결합도 고려

### 일관성 (Consistency)
- 팀/프로젝트 단위 네이밍, 주석, 커밋 메시지 규칙 엄수

### 테스트 & 검증
- **테스트 필수**: 핵심 로직 단위 테스트 확보
- **상호 검증**: 다른 AI(Claude, Codex, Gemini)의 리뷰 필수

---

## 2. TypeScript Strict Mode

### Type-First 원칙
1. **타입 정의 우선**: 구현 전 인터페이스 먼저 작성
2. **No `any`**: `any` 타입 사용 금지, 제네릭 활용
3. **컴파일 체크**: `npm run type-check` 필수

### 기존 코드 분석
- **의존성 파악**: 리팩토링 전 모든 참조 타입/모듈 분석
- **레거시 호환성**: 기존 인터페이스 호환 유지
- **영향도 분석**: 변경 사항 영향 예측 및 문서화

---

## 3. AI 도구별 역할

| AI 도구 | 주 역할 | 특화 영역 | 호출 방법 |
|---------|---------|-----------|-----------|
| **Claude Code** | 메인 개발 | 아키텍처, 비즈니스 로직 | 직접 |
| **Codex (GPT-5)** | 개발/개선 + 검증 | 구현, 리팩토링, 실무 검증 | `Task codex-wrapper` |
| **Gemini** | 아키텍처/검증 | 시스템 설계, 표준화, 리스크 분석 | `Task gemini-wrapper` |

---

## 4. DO/DON'T

### ✅ 공통 DO
1. **교차 검증 활용** - 중요 결정은 2개 이상 AI로 검증
2. **명확한 컨텍스트** - 목표와 제약사항 명시
3. **실행 및 테스트** - AI 제안은 반드시 실제 검증
4. **한국어 우선** - 기술용어 영어 병기 허용

### ❌ 공통 DON'T
1. **무료 티어 한도 초과** - Codex(30-150/5h), Gemini(1K/day)
2. **맹목적 신뢰** - 검증 없이 적용 금지
3. **컨텍스트 없는 질문** - 환경/목표 미명시 요청

### 도구별 DON'T
- **Codex**: 긴 질문은 분할, 타임아웃 시 간결하게 수정
- **Gemini**: Rate limit 주의 (1K RPD)
- **Claude Code**: 단순 반복 작업은 다른 AI 활용

---

## 5. 무료 티어 한도 관리

| AI 도구 | 일일 한도 | 분당 한도 | 비용 |
|---------|-----------|-----------|------|
| **Codex** | 30-150 메시지/5시간 | - | Plus $20/월 |
| **Gemini** | 1,000 RPD | 60 RPM | 무료 |

### 한도 초과 시 폴백
1. Codex → Gemini → Claude
2. Gemini → Codex → Claude

---

## Related Documents

- [Vibe Coding README](../../../vibe-coding/README.md)
- [Vibe Coding Workflows](../../../vibe-coding/workflows.md)
- [AI Tools](../../../vibe-coding/ai-tools.md)

---

**이전 문서** (archived):
- `ai-coding-standards.md` → 이 문서로 통합
- `ai-usage-guidelines.md` → 이 문서로 통합
