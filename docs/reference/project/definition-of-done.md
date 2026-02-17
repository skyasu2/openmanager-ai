# OpenManager AI v8.0.0 - Definition of Done

> Owner: project-lead
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-17
> Tags: dod,checklist,quality,release

**성격**: Living Document — 프로젝트 진화에 따라 갱신.

---

## 1. Feature DoD (기능 완료 기준)

새 기능이 "완료"로 간주되려면 아래 전부 충족:

- [ ] `tsc --noEmit` 0 에러
- [ ] `npm run lint` (Biome) 0 에러
- [ ] `any` 타입 0개
- [ ] 신규 로직에 대한 단위 테스트 작성
- [ ] 파일 500줄 이하 (초과 시 분할 검토)
- [ ] 보안 검토: 입력 검증, 인증 확인, OWASP 체크
- [ ] 미사용 코드/import 0개
- [ ] Pino Logger 사용 (console.log 금지)

---

## 2. Bug Fix DoD (버그 수정 기준)

버그 수정이 "완료"로 간주되려면:

- [ ] 근본 원인(Root Cause) 식별 및 문서화
- [ ] 회귀 테스트 추가 (동일 버그 재발 방지)
- [ ] `tsc --noEmit` 0 에러
- [ ] `npm run lint` 0 에러
- [ ] 관련 기존 테스트 전부 통과

---

## 3. Release DoD (릴리스 기준)

릴리스 전 필수 체크리스트:

- [ ] `npm run validate:all` 통과 (TypeScript + Lint + Test)
- [ ] `npm run test:e2e:critical` 통과 (smoke, guest, a11y)
- [ ] CHANGELOG.md 업데이트
- [ ] 환경변수 동기화 확인 (로컬 ↔ Vercel ↔ Cloud Run)
- [ ] Health check 정상 (`/api/health`, Cloud Run `/health`)
- [ ] Cloud Run 배포 시: `npm run test:cloud:essential` 통과

---

## 4. Cost Gate (비용 게이트)

인프라/배포 변경 시 반드시 확인:

- [ ] Cloud Build: `e2-medium` 기본 머신만 (machineType 옵션 금지)
- [ ] Cloud Run: 1 vCPU, 512Mi (Free Tier 한도 내)
- [ ] Vercel Build: Standard 머신 ($0.014/min, Turbo 금지)
- [ ] Cron Jobs: 비활성화 (`DISABLE_CRON_JOBS=true`)
- [ ] GPU/고사양 인스턴스: 추가 금지
- [ ] 비용 영향 커밋에 `[COST]` 태그

> 실제 사고: 2026-01 AI가 `E2_HIGHCPU_8` 추가하여 ~20,000 KRW 청구

---

## 5. Doc Gate (문서 게이트)

문서 추가/수정 시 필수:

- [ ] 메타데이터 포함 (Owner, Status, Doc type, Last reviewed)
- [ ] 활성 문서 55개 이내 (`docs/archived/` 제외)
- [ ] Diataxis 유형 라벨 (Tutorial, How-to, Reference, Explanation)
- [ ] 병합 > 기존 확장 > 신규 생성 (우선순위)
- [ ] 90일 미갱신 문서는 아카이브 후보

---

## 6. AI Code Gate (AI 코드 게이트)

AI 생성 코드에 대한 추가 검증:

- [ ] AI 출력물은 untrusted로 취급 (보안 검토 필수)
- [ ] Prompt Injection 방어 확인 (15패턴 EN+KO)
- [ ] 하드코딩된 API Key/시크릿 0개
- [ ] Free Tier 한도 초과 구성 금지

---

## Quick Reference

```bash
# Feature/Bug Fix 완료 후
npm run type-check          # tsc --noEmit
npm run lint                # Biome
npm run test:quick          # 최소 테스트

# Release 전
npm run validate:all        # 전체 검증
npm run test:e2e:critical   # E2E 핵심
```

---

_Last Updated: 2026-02-17_
