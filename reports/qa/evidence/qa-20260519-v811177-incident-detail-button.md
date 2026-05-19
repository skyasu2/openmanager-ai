# v8.11.177 Incident Report Detail Button QA

- Target: https://openmanager-ai.vercel.app/dashboard
- Version: v8.11.177
- GitLab tag pipeline: 2535652127 (success)
- Scenario: AI assistant sidebar -> 자동장애 보고서 -> 첫 보고서 생성하기 -> 보고서 상세 보기 -> 상세 접기

## Result

- Incident report generation returned HTTP 200.
- Browser console warnings/errors: 0.
- Collapsed action was visible as `보고서 상세 보기`.
- Expanded action changed to `상세 접기`.
- Expanded button exposed `aria-expanded=true` and `aria-controls=report-...-details`.
- Controlled detail section rendered the expected headings: `감지된 이상 항목`, `권장 조치`, `감지된 패턴`, `Postmortem`, `로그 타임라인`.

## Evidence

- Screenshot: `reports/qa/evidence/qa-20260519-v811177-incident-detail-button.png`
