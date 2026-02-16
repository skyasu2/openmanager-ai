---
name: doc-management
description: 문서 현황 점검, 예산 초과 감지, 병합/아카이브 제안. Triggers on /doc-management or 문서 정리/관리 요청.
version: v1.2.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
disable-model-invocation: true
---

# 문서 관리 스킬

문서 수량 예산(Doc Budget Policy)에 따른 현황 점검 및 정리 도구.

## Trigger Keywords

- "/doc-management"
- "문서 정리", "문서 현황", "doc cleanup"

## Workflow

### 1. 현황 스캔

```bash
# 권장: 통합 리포트 실행
npm run docs:budget

# 활성 문서 수 (한도: 55)
ACTIVE=$(find docs/ -name "*.md" -not -path "*/archived/*" | wc -l)
echo "Active: $ACTIVE / 55"

# 디렉토리별 분포
find docs/ -name "*.md" -not -path "*/archived/*" | \
  sed 's|docs/||' | cut -d'/' -f1 | sort | uniq -c | sort -rn
```

### 2. 예산 초과 감지

디렉토리별 한도와 비교:
- reference/architecture/*: 20 | development/*: 12 | guides/*: 12
- vibe-coding/*: 8 | troubleshooting/*: 5 | root: 5

초과 시 병합/아카이브 후보 제안.

### 3. 중복 감지

유사한 파일명/내용 패턴을 검색:
- 동일 prefix (otel-*, prometheus-*, data-*)
- 동일 디렉토리 내 300줄 미만 소형 파일 2개 이상

### 4. Stale 문서 감지

```bash
# 90일 이상 미수정 파일
find docs/ -name "*.md" -not -path "*/archived/*" -mtime +90
```

### 5. 리포트 출력

```markdown
## 문서 현황 리포트

| 항목 | 현재 | 한도 | 상태 |
|------|------|------|------|
| 전체 | XX | 55 | OK/OVER |
| reference/architecture | XX | 20 | ... |
| ...  | ... | ... | ... |

### 조치 필요
- [ ] 병합 후보: {파일1} + {파일2}
- [ ] 아카이브 후보: {90일 미갱신 파일}
- [ ] 메타데이터 누락(변경 문서): {Owner/Status/Doc type/Last reviewed 즉시 보완}
- [ ] 메타데이터 누락(레거시): {백로그}
```

## Edge Cases

**예산 초과 시**:
- 먼저 archived/ 이동 가능한 Historical 문서 식별
- 그 다음 병합 가능한 유사 문서 쌍 제안
- 강제 삭제는 하지 않음 (사용자 확인 필수)

**신규 문서 생성 요청 시**:
- 이 스킬을 먼저 실행하여 예산 여유 확인
- 여유 없으면 병합/아카이브 후 생성

## Success Criteria

- 활성 문서 수가 55개 한도 이내
- 이번 작업에서 변경한 문서는 Owner / Status / Doc type / Last reviewed 메타데이터 100% 충족
- 기존 레거시 문서는 누락 리포트 생성 후 점진 보강
- 각 디렉토리 README.md에 모든 문서가 링크됨
- 90일 이상 stale 문서 0개

## Related Skills

- `lint-smoke` - 코드 품질 점검 (문서 점검과 병행 가능)
- `git-workflow` - 정리 후 커밋
- `cloud-run` - 배포 전 문서 점검

## Changelog

- 2026-02-14: v1.2.0 - metadata 스키마를 Owner/Last reviewed 기준으로 확장, strict gate 기준 문구 동기화
- 2026-02-14: v1.1.0 - 예산 범위 통일(reference/architecture), 메타데이터 단계적 적용 기준 추가
- 2026-02-14: v1.0.0 - 초기 생성 (Diataxis + Doc Budget Policy 기반)
