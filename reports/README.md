# Reports (동적 문서)

동적으로 생성/완료되는 실행 문서를 관리합니다.

## 개념 정리

| 폴더 | 성격 | Git |
|------|------|-----|
| `docs/` | 정적 가이드/레퍼런스 | ✅ Tracked |
| `reports/planning/` | 진행 중 계획서 | ✅ Tracked |
| `reports/planning/archive/` | 완료된 계획서 보관 | ✅ Tracked |
| `reports/qa/` | QA 결과 및 누적 품질 추적 | ✅ Tracked |
| `reports/history/` | 레거시 히스토리 스냅샷 | ⚠️ Legacy (신규 저장 금지) |
| `logs/` | 실행 로그/브리지 결과 | ❌ Ignored |

## 표준 구조

```text
reports/
├── planning/
│   ├── TODO.md
│   ├── *.md
│   └── archive/
├── qa/
│   ├── QA_STATUS.md
│   ├── qa-tracker.json
│   ├── templates/
│   └── runs/
└── history/   # 과거 자산 보존용 (read-only)
```

## 워크플로우

```text
[계획] reports/planning/*.md
  → 진행(상태 업데이트)
  → 완료
  → reports/planning/archive/ 로 이동
```

## 운영 원칙

- 계획서 SSOT는 `AGENTS.md`의 `Planning Docs Policy`를 따릅니다.
- 계획서에는 API 키/토큰/시크릿 등 민감정보를 기록하지 않습니다.
- `reports/history/`는 과거 Claude Code 자산의 레거시 보관 경로이며, 신규 완료본 저장 경로로 사용하지 않습니다.

_Last Updated: 2026-02-14_
