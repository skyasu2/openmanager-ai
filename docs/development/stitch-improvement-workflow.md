# Stitch 개선 워크플로우

> Doc type: How-to  
> Last updated: 2026-02-13

## 대상

프론트엔드 구현이 이미 완료된 상태에서, UI 개선/추가 작업을 할 때 사용합니다.

## 기본 원칙

- Source of Truth는 코드입니다.
- Stitch는 개선 시안 생성용으로만 사용합니다.
- 반영 단위는 "페이지 전체"가 아니라 "컴포넌트 단위"로 제한합니다.
- 핵심 목표는 "빠른 개선 시도 + 안정적 코드 반영"입니다.

## 권장 절차

1. 개선 범위를 명시합니다.
   - 예: `SystemOverviewSection` 카드 레이아웃만 개선
2. Stitch에 증분 개선 프롬프트를 입력합니다.
3. 생성 결과에서 구조/스타일 아이디어만 추출합니다.
4. 기존 코드 구조를 유지한 채 수동 적용합니다.
5. 검증을 실행합니다.
   - `npm run stitch:check`
   - `npm run type-check`
   - `npm run lint`
6. PR에 Stitch 관련 정보를 기록합니다.
   - 대상 project id
   - 적용한 컴포넌트 파일
   - 제외한 제안(충돌/회귀 위험)
   - (선택) 실험용 active 프로젝트를 별도로 사용했다면 이유를 함께 기록

## 금지 사항

- Stitch 결과를 기존 화면 전체에 일괄 치환
- 상태 관리/데이터 패칭 구조를 UI 생성 결과에 맞춰 변경
- 근거 없이 active 프로젝트를 변경

## 빠른 체크리스트

- [ ] 변경 범위가 컴포넌트 1~2개로 제한됨
- [ ] 기존 API/상태 구조 유지됨
- [ ] `npm run stitch:check` 실행(권장)
- [ ] `config/ai/stitch-project-registry.json` 갱신됨
