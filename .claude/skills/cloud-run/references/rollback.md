# Cloud Run Deployment - Rollback 절차

배포 실패 또는 문제 발생 시 이전 버전으로 롤백하는 방법입니다.

## 빠른 롤백

### 1. 최근 리비전 목록 확인

```bash
gcloud run revisions list \
  --service ai-engine \
  --region asia-northeast1 \
  --format="table(metadata.name, status.conditions[0].status, metadata.creationTimestamp)"
```

**출력 예시**:
```
NAME                           READY  CREATED
ai-engine-00042-abc            True   2026-01-27T00:00:00Z
ai-engine-00041-xyz            True   2026-01-26T00:00:00Z  ← 롤백 대상
ai-engine-00040-def            True   2026-01-25T00:00:00Z
```

### 2. 이전 리비전으로 트래픽 전환

```bash
# 특정 리비전으로 100% 트래픽 전환
gcloud run services update-traffic ai-engine \
  --region asia-northeast1 \
  --to-revisions ai-engine-00041-xyz=100
```

### 3. 롤백 확인

```bash
# 현재 트래픽 분배 확인
gcloud run services describe ai-engine \
  --region asia-northeast1 \
  --format='yaml(status.traffic)'

# Health check
SERVICE_URL=$(gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)')
curl -s ${SERVICE_URL}/health | jq
```

---

## 점진적 롤백 (Canary)

문제가 불확실한 경우 트래픽을 점진적으로 이동:

```bash
# 90% 새 버전, 10% 이전 버전
gcloud run services update-traffic ai-engine \
  --region asia-northeast1 \
  --to-revisions ai-engine-00042-abc=90,ai-engine-00041-xyz=10

# 모니터링 후 문제 발견 시 완전 롤백
gcloud run services update-traffic ai-engine \
  --region asia-northeast1 \
  --to-revisions ai-engine-00041-xyz=100
```

---

## 최신 리비전으로 복원

롤백 후 문제가 해결되면 최신 리비전으로 다시 전환:

```bash
gcloud run services update-traffic ai-engine \
  --region asia-northeast1 \
  --to-latest
```

---

## 리비전 정리

오래된 리비전 삭제 (비용 절감):

```bash
# 특정 리비전 삭제
gcloud run revisions delete ai-engine-00040-def \
  --region asia-northeast1 \
  --quiet

# 오래된 리비전 일괄 삭제 (최근 3개 유지)
gcloud run revisions list \
  --service ai-engine \
  --region asia-northeast1 \
  --format="value(metadata.name)" \
  | tail -n +4 \
  | xargs -I {} gcloud run revisions delete {} --region asia-northeast1 --quiet
```

---

## 주의사항

1. **롤백 전 확인**: 롤백할 리비전이 정상 작동하는지 먼저 확인
2. **데이터 호환성**: 스키마 변경이 있었다면 데이터 호환성 검토
3. **환경변수**: 이전 리비전과 현재 환경변수 차이 확인
4. **로그 보존**: 문제 분석을 위해 롤백 전 로그 저장

---

## 관련 명령어 요약

| 작업 | 명령어 |
|------|--------|
| 리비전 목록 | `gcloud run revisions list` |
| 롤백 | `gcloud run services update-traffic --to-revisions` |
| 최신으로 복원 | `gcloud run services update-traffic --to-latest` |
| 트래픽 확인 | `gcloud run services describe` |
| 리비전 삭제 | `gcloud run revisions delete` |
