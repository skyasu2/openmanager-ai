# Stitch 동기화 정책

> Doc type: Policy  
> Last updated: 2026-02-13

## 목적

완성된 UI 구현을 유지하면서, Stitch를 증분 개선/시안 생성에 효율적으로 활용합니다.

## Source of Truth

- 운영 기준은 **코드**입니다.
- Stitch는 코드 기반 UI를 추적/공유하는 보조 디자인 자산입니다.
- 기준 파일: `config/ai/stitch-project-registry.json`

## 운영 규칙

1. 활성(active) Stitch 프로젝트는 1개를 권장하되, 병렬 실험 시 복수 운영도 허용합니다.
2. UI 관련 PR에서는 가능하면 `npm run stitch:check`를 실행합니다.
3. active 프로젝트의 `mappedFiles`는 최신 상태를 유지합니다.
4. legacy 프로젝트는 참고 자료로만 사용하고, 구현 기준은 코드로 유지합니다.

## 완성형 프론트엔드에서의 사용 원칙

- Stitch는 **신규 전체 재구축 도구가 아니라 증분 개선 도구**로 사용합니다.
- 기존 컴포넌트 경계, 상태 관리(TanStack Query/Zustand), API 계약은 유지합니다.
- Stitch 산출물은 바로 반영하지 않고, 다음 순서로 적용합니다.
1. 디자인 초안 생성
2. 현재 코드 구조에 맞춰 수동 병합
3. 타입/접근성/테스트 점검
- Stitch 제안이 현재 구현과 충돌하면 코드 기준을 우선합니다.

## 실행 절차

1. UI 변경 후 코드 먼저 확정합니다.
2. `config/ai/stitch-project-registry.json`의 `updatedAt`, `lastVerifiedAt`, `mappedFiles`를 갱신합니다.
3. `npm run stitch:check`를 실행합니다(권장).
4. 필요 시 Stitch UI에서 legacy 프로젝트를 archive 처리합니다.

## 분류 기준

- `active`: 현재 코드 기준으로 운영 중이며, 매핑 파일이 유효한 프로젝트
- `legacy`: 과거 시안/중간 산출물로, 직접 개발 기준으로 쓰지 않는 프로젝트
- `archived`: Stitch UI에서 보관 처리된 프로젝트

## 장애 예방 포인트

- UI 변경 PR에서 active 프로젝트 변경 여부를 명시합니다.
- 프로젝트 ID를 커밋 메시지 또는 PR 본문에 기록합니다.
- Stitch 산출물은 아이디어/레이아웃 기준으로 활용하고, 실제 반영은 코드 구조 기준으로 적용합니다.
- 개선 작업 시 변경 범위를 컴포넌트 단위로 제한하고, 한 번에 하나의 UI 영역만 반영합니다.
