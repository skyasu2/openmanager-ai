# Landing Follow-up Priority Plan

- 상태: 완료
- 작성일: 2026-03-30
- 목표: 최근 랜딩 개선과 dev 안정화 변경을 production QA 결과와 웹 베스트 프랙티스 기준으로 재평가하고, 다음 우선순위를 명확히 정리한다.

## 배경

- 검증된 최근 커밋
  - `f44571f08` 랜딩 QA 정리, 카드 카피 정합성 수정, 질문 예시 전환, `/api/system` 401 제거
  - `430bc4fe5` `VibeFinishSection.tsx` 추적 누락 수정
  - `e7949fe72` WSL2/NTFS용 Turbopack dev filesystem cache 비활성화
  - `b35c36d17` 공통 AI 정책 SSOT에 `객관성 및 정직성` 원칙 추가
  - `75ab96311` QA 기록 0197-0198 반영, artifact ignore 보강, AI 문서 sync
- 최신 production QA는 `QA-20260330-0198`이며, 랜딩 핵심 체크와 콘솔 에러 0건이 확인됐다.
- 현재 `gitlab/main`은 위 변경을 포함한 상태다.

## 외부 기준

### UX / 메시지 구조

- NN/g eyetracking 요약에 따르면 사용자는 첫 10초 안에 페이지의 목적과 가치 제안을 파악해야 하며, 그렇지 못하면 이탈 가능성이 높다.
  - source: https://media.nngroup.com/media/reports/free/How_People_Read_on_the_Web.pdf
- NN/g Application Design Showcase는 초기 화면에서 핵심 정보만 먼저 보여주고, 나머지는 hover/click으로 점진 공개하는 구성을 권장한다.
  - source: https://media.nngroup.com/media/reports/free/Application_Design_Showcase_2nd_edition.pdf
- web.dev는 clear value proposition이 먼저인 상태에서만 CTA가 설득력을 갖고, 프로모션은 핵심 여정을 방해하지 않아야 한다고 설명한다.
  - source: https://web.dev/articles/promote-install
- web.dev 접근성 가이드는 버튼과 링크 텍스트가 동작을 직접 설명해야 한다고 권장한다.
  - source: https://web.dev/articles/labels-and-text-alternatives

### 성능 / 계측

- web.dev는 좋은 LCP 기준을 75% 사용자 기준 2.5초 이하로 제시하며, 히어로 영역은 이 기준의 직접 영향을 받는다.
  - source: https://web.dev/articles/optimize-lcp
- web.dev는 field Web Vitals 없이는 실제 변경 효과를 확신할 수 없고, 배포 버전별로 추적해야 회귀를 구분할 수 있다고 권장한다.
  - source: https://web.dev/articles/vitals-field-measurement-best-practices

### Next.js dev 운영

- Next.js 공식 문서는 `turbopackFileSystemCacheForDev`가 dev에서 기본 활성화이며, dev 파일시스템 캐시는 stable이라고 명시한다.
  - source: https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache
- 다만 현재 프로젝트는 `next@^16.1.6`이며, WSL2 + NTFS + 강제 kill이라는 로컬 조건 때문에 해당 기본값을 예외적으로 꺼둔 상태다.
  - local evidence: `next.config.mjs`, `package.json`

## 현재 평가

### 잘 맞는 부분

- 랜딩 히어로는 현재 단일 핵심 CTA와 명확한 가치 문장으로 정리돼 있다.
- `SystemStartSection`은 기능 나열 태그 대신 실제 질문 예시를 보여줘 메시지 이해 속도가 빨라졌다.
- QA 보증 요소를 메인 랜딩에서 제거하고 `Vibe Coding -> QA / Finish`로 이동시킨 것은 핵심 여정 분리에 맞다.
- `/api/system` GET 공개 전환으로 비로그인 랜딩 콘솔 401이 사라졌다.

### 남은 간격

- `Validation Evidence` 페이지 일부 카피는 아직 "landing CTA의 근거"라는 과거 표현을 유지하고 있다.
- `Validated on Production` 배지는 사실 기반 QA 요약보다는 마케팅성 뱃지처럼 읽힐 여지가 있다.
- 현재 QA 체계는 Playwright proof와 snapshot은 강하지만, field Web Vitals를 배포 버전과 함께 추적하는 루프는 약하다.
- `turbopackFileSystemCacheForDev: false`는 현재 환경에서는 합리적이지만, Next.js patch/minor 업그레이드 후 재검증 일정이 문서상 메모 수준에 머물러 있다.

## 프로젝트 제약

- canonical 저장소와 배포 권위는 `gitlab/main` 기준이다.
- 최종 QA 게이트는 Vercel production + Playwright MCP 기록 체계다.
- Free Tier 원칙상 성능 개선도 스펙 업이 아니라 코드/캐시/계측 최적화 우선이다.
- 공통 AI 정책 SSOT는 `docs/guides/ai/ai-standards.md`이며, 중복 문서 드리프트를 늘리면 안 된다.

## 우선순위

### 1. 사실 기반 QA 카피 정리

- 목표: Vibe/Validation 영역에서 남아 있는 과장형 표현과 구형 CTA 표현 제거
- 이유: 이미 production QA는 통과했으므로 위험이 낮고, `객관성 및 정직성` 원칙과도 정합성이 높다.
- 범위:
  - `src/data/qa-evidence.ts`
  - `src/app/validation/page.tsx`

### 2. field Web Vitals 최소 계측 설계

- 목표: landing 변경 효과를 배포 버전 단위로 추적할 최소 RUM 루프 설계
- 이유: 현재는 proof run은 좋지만 실제 사용자 성능 변화의 장기 추적 근거가 약하다.
- 방향:
  - `web-vitals` 기반 LCP/INP/CLS 수집 여부 검토
  - build/deploy version dimension 연동
  - 비용 증가 없는 기존 analytics 또는 lightweight beacon 경로 우선
- 진행:
  - `next/web-vitals` 기반 global reporter 추가
  - `/api/web-vitals` lightweight ingest route 추가
  - landing `/` 및 `/validation` 경로만 우선 수집
  - payload에 `appVersion`, `hostname`, `sessionId`, `deviceType` 포함

### 3. Next.js 16.2.x 계열에서 dev cache 재검증

- 목표: `turbopackFileSystemCacheForDev: false` 예외를 계속 유지할지 재판정
- 이유: 공식 문서 기준 기본값과 현재 예외 설정이 어긋나 있으므로, 유지 근거를 주기적으로 갱신해야 한다.
- 조건:
  - WSL2/NTFS 환경에서 `dev`, `dev:clean`, 강제 종료 후 재기동 재현
  - manifest corruption 재현 여부 확인

### 4. hero 시각 톤 미세 조정

- 목표: 가치 문장 우선 구조는 유지하되, 불필요하게 "AI 제품 템플릿"으로 읽힐 수 있는 장식 요소를 줄일지 판단
- 이유: 우선순위는 낮지만 사용자 첫 인상과 포트폴리오 신뢰감에는 영향을 준다.
- 메모:
  - 현재 gradient text는 로고와 일관되므로 즉시 제거 대상은 아니다.
  - 카피/계측/QA 정합성보다 뒤에 둔다.

## 이번 턴 실행

- [x] 최근 커밋과 QA 상태 재확인
- [x] 공식 자료 기준 비교 분석
- [x] 우선순위 계획서 작성
- [x] Priority 1 범위의 잔여 QA 카피 정리
- [x] Priority 2 범위의 최소 field Web Vitals 계측 추가

## 완료 기준

- [x] production에서 통과한 최근 랜딩 변경의 상태와 의미를 설명할 수 있다.
- [x] 외부 공식 자료 기준 비교가 포함돼 있다.
- [x] 프로젝트 제약을 반영한 실행 우선순위가 정리돼 있다.
- [x] 이번 턴에 당장 반영 가능한 저위험 정리 항목을 수행했다.
