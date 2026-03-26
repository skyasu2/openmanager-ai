# Testing Rules

## Test Commands

### 일상적 사용
```bash
npm run test:quick          # 최소 테스트 (빠름)
npm run validate:all        # 전체 검증 (Lint + Type + Test)
npm run type-check          # TypeScript 검사
npm run lint                # Biome lint
```

### E2E 테스트
```bash
npm run test:e2e            # 로컬 E2E 테스트
npm run test:e2e:critical   # 핵심 E2E만 (smoke, guest, a11y)
npm run test:vercel:e2e     # Vercel Production E2E
```

### 커버리지
```bash
npm run test:coverage       # 커버리지 리포트 생성
```

### Dead Code 분석
```bash
npm run knip:ci             # 미사용 파일/exports/deps 감지 (non-blocking)
npm run knip                # 전체 보고서 (blocking)
```

## Testing Strategy

| 레벨 | 도구 | 위치 |
|------|------|------|
| Unit | Vitest | `src/**/*.test.ts` |
| Integration | Vitest | `tests/integration/` |
| E2E | Playwright | `tests/e2e/*.spec.ts` |
| Type | Vitest | `tests/types/` |

## Coverage Thresholds

```
Lines:      10%
Branches:   10%
Functions:  10%
Statements: 10%
```

> Note: 현실적 수준으로 조정됨 (실제 커버리지 ~11%)

## Test Directory Structure

```
src/
└── **/*.test.ts        # 컴포넌트 단위 테스트

tests/
├── ai-sidebar/         # AI 훅/컴포넌트 테스트
├── api/                # API 라우트 테스트
├── e2e/                # Playwright E2E
├── integration/        # 통합 테스트
├── performance/        # 성능 테스트
├── types/              # 타입 레벨 테스트
└── utils/              # 테스트 유틸리티
```

## Pre-commit Validation

- Biome 자동 포맷팅 (PostToolUse hook)
- Lint 에러 시 커밋 차단
- TypeScript strict mode 검사

## Mock Setup

- MSW (Mock Service Worker): `config/testing/msw-setup.ts`
- Mock 데이터: `src/__mocks__/`

---

**See Also**: 상세 문서 → `docs/guides/testing/` (test-strategy.md, e2e-testing-guide.md)
