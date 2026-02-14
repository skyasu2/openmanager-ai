# Stitch 관리 가이드

> Stitch 증분 개선 워크플로우와 운영 정책 가이드
> Owner: dev-experience
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-14
> Canonical: docs/development/stitch-guide.md
> Tags: stitch,ui,workflow
>
> stitch-improvement-workflow + stitch-sync-policy 병합
> Last updated: 2026-02-14

## 1. 핵심 원칙

- **Source of Truth = 코드**. Stitch는 증분 개선/시안 생성용 보조 도구이다.
- Stitch 제안이 현재 구현과 충돌하면 **코드 기준 우선**.
- 반영 단위는 "페이지 전체"가 아니라 **컴포넌트 단위**(1~2개)로 제한한다.
- 기존 컴포넌트 경계, 상태 관리(TanStack Query/Zustand), API 계약을 유지한다.

## 2. 운영 정책

기준 파일: `config/ai/stitch-project-registry.json`

| 분류 | 설명 |
|------|------|
| `active` | 현재 코드 기준 운영 중, mapping 유효. 1개 권장(병렬 실험 시 복수 허용) |
| `legacy` | 과거 시안/중간 산출물. 참고 전용, 개발 기준 사용 금지 |
| `archived` | Stitch UI에서 보관 처리 완료 |

- active 프로젝트의 `mappedFiles`는 항상 최신 상태를 유지한다.
- UI 변경 PR에서 active 프로젝트 변경 여부를 명시한다.

## 3. 개선 워크플로우 (6단계)

1. **범위 명시** -- 예: `SystemOverviewSection` 카드 레이아웃 개선
2. **Stitch 시안 생성** -- 증분 개선 프롬프트 입력
3. **아이디어 추출** -- 구조/스타일 아이디어만 선별
4. **수동 병합** -- 기존 코드 구조를 유지한 채 적용
5. **검증 실행**
   - `npm run stitch:check` (권장)
   - `npm run type-check` / `npm run lint`
6. **PR 기록** -- project id, 적용 컴포넌트, 제외 사항, registry 갱신 내역

## 4. 금지사항

- Stitch 결과를 기존 화면 전체에 **일괄 치환**
- 상태 관리/데이터 패칭 구조를 Stitch 산출물에 맞춰 변경
- 근거 없이 active 프로젝트를 변경
- Stitch를 신규 전체 재구축 도구로 사용

## 5. 체크리스트

- [ ] 변경 범위가 컴포넌트 1~2개로 제한됨
- [ ] 기존 API/상태 구조 유지됨
- [ ] `npm run stitch:check` 실행함
- [ ] `stitch-project-registry.json`의 `updatedAt`, `lastVerifiedAt`, `mappedFiles` 갱신됨
- [ ] PR에 Stitch project id와 적용 내역 기록됨
