---
name: openmanager-qa-state
description: 통합 QA 및 상태 분석 스킬. 최근 QA/런타임 상태를 분석하고, Vercel/로컬 환경에서 QA를 실행하여 결과를 reports/qa에 누적 기록합니다.
version: v2.0.0
---

# OpenManager QA & State (통합)

이 스킬은 시스템의 현재 상태를 진단하고(Triage), 최적의 환경에서 QA를 수행하며(Ops), 그 결과를 공식 기록(Tracker)에 남기는 전 과정을 담당합니다.

## 🎯 실행 트리거
- "현재 상태 점검해줘", "왜 실패했어?", "QA 실행해줘", "/qa-state"
- 배포 후 "정상인지 확인해줘", "로그 분석해줘"

## 🛠 워크플로우

### 1단계: 상태 진단 (Triage)
1. **실시간 오류 확인**: `nextjs_index`로 서버 확인 후 `nextjs_call(toolName="get_errors")`를 호출하여 브라우저/빌드 에러를 즉시 파악합니다.
2. **최신 증거 로드**: `reports/qa/qa-tracker.json`과 `reports/qa/QA_STATUS.md`를 읽어 직전 QA의 실패 항목을 확인합니다.
3. **무료 티어 점검**: `scripts/check-free-tier-usage.js`를 실행하여 GCP/Vercel 예산 소진 상태를 확인합니다.

### 2단계: QA 실행 (Ops)
1. **환경 결정**: 
   - AI 엔진/API 연동 검증: **Vercel Preview/Production** 권장.
   - UI/레이아웃/단순 로직: **로컬 개발 서버(3004/3005)** 권장.
2. **시나리오 수행**: Playwright MCP를 사용하여 랜딩 → 로그인 → 대시보드 → 모달(바이브 코딩 포함) 순으로 검증합니다.
3. **Data Parity 체크**: AI 응답 시 `GET /api/health?service=parity`의 슬롯 인덱스와 AI 도구 호출의 인덱스가 일치하는지 대조합니다.

### 3단계: 결과 기록 및 보고 (Reporting)
1. **자동 기록**: QA 완료 후 반드시 `npm run qa:record -- --input <json>`을 호출하여 `reports/qa`에 누적합니다.
2. **상태 업데이트**: `npm run qa:status`를 통해 현재 전체 Pass/Fail 현황을 출력합니다.
3. **다음 액션 제시**: `code-fix`, `config-sync`, `deploy-retry` 중 가장 적합한 다음 단계를 권고합니다.

## 📋 출력 형식
```text
[QA & State Report]
- 상태 요약: <Healthy | Degraded | Broken>
- 주요 증상: <에러 메시지 또는 현상>
- QA 결과: <Run ID> - <Pass/Total> (환경: <Vercel/Local>)
- 무료 티어 적합성: <Safe | Warning | OverLimit>
- 권장 조치: <한 줄 요약>
```

## 🔗 연관 스킬
- `openmanager-env-sync`: 환경 변수 불일치 의심 시 호출
- `openmanager-cloud-run`: GCP 배포 및 비용 상세 분석 필요 시 호출
- `openmanager-git-workflow`: 문제 해결 후 커밋/푸시 시 호출

## 🔄 변경 이력
- 2026-04-02: v2.0.0 - `state-triage`와 `qa-ops`를 통합. Next.js MCP 연동 및 데이터 패리티 체크 강화.
