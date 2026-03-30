# Validation Evidence Clarity Plan (2026-03-30)

## 최근 변경 분석

- `944d1d30e`
  - `Vibe Coding` 모달의 `QA / Finish`를 제거하고 `CI/CD` 설명으로 교체
- `f3980357e`
  - `CI/CD` 문구를 실제 운영 방식에 맞게 `로컬 검증 게이트 + GitLab main 자동 배포` 기준으로 정정
- `e0d7a7bac`
  - 위 production 재검증 결과를 QA tracker와 public snapshot에 반영

## 현재 상태

- `Vibe Coding` 모달의 표현은 현재 저장소 정책과 일치한다.
- `/validation`은 최신 public snapshot과 최신 CI-backed proof를 둘 다 보여준다.
- 다만 페이지에서 두 기준의 역할 구분이 약해 사용자가 `latest snapshot run`과 `latest proof run`을 한 번 더 해석해야 한다.

## 웹 기준 비교

- GitLab 문서 기준, 전형적인 CI/CD 파이프라인은 `.gitlab-ci.yml`과 runner를 중심으로 정의된다.
  - https://docs.gitlab.com/ci/
- Vercel 문서 기준, production branch(`main`) 반영 시 자동 production 배포가 수행된다.
  - https://vercel.com/docs/deployments/promoting-a-deployment
- plain language / content design 기준, 사용자가 해석해야 하는 내부 용어와 중복 설명은 줄이고 목적이 드러나는 레이블을 우선해야 한다.
  - https://design.education.gov.uk/content-design/
- 링크와 섹션 레이블은 목적과 도착 지점을 직접 설명해야 한다.
  - https://accessibility.iu.edu/creating-content/documents/general-guidelines/clear-labels.html

## 프로젝트 제약 반영

- canonical repo는 `gitlab`
- frontend 자동 배포 기준은 `gitlab main`
- GitLab SaaS runner 상시 운영은 현재 정책이 아님
- public `/validation`은 메인 마케팅 화면이 아니라 보조 evidence 화면
- public snapshot은 build-time artifact이므로, 설명도 `현재 배포 기준`과 `CI proof 기준`을 명확히 분리해야 함

## 우선순위

1. `/validation`의 snapshot / proof 구분 명확화
   - 최신 public snapshot run과 최신 CI-backed proof run을 별도 카드로 분리
   - 링크/섹션 레이블을 해석형 문구에서 목적형 문구로 변경
2. `Vibe Coding -> CI/CD` 세부 카드의 명령어 밀도 조정
   - 외부 독자용 설명과 내부 명령어를 더 분리
3. `validation-evidence.json` public schema 설명성 보강
   - `latestRunId`만이 아니라 latest public run 메타데이터를 함께 노출

## 이번 턴 실행

- 1순위 수행
  - `validation-evidence.json`에 latest public run 메타데이터 노출
  - `/validation`에서 snapshot run / CI proof run을 분리 표시
  - 관련 테스트 갱신
