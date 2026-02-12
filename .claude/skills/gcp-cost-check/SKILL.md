---
name: gcp-cost-check
description: GCP 비용 조회 및 Free Tier 사용량 분석. Use when user requests cost check, billing review, or free tier usage analysis.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Write
---

# GCP Cost Check

## Purpose

GCP Cloud Build / Cloud Run 사용량과 예상 비용을 CLI로 조회하여 Free Tier 초과 여부를 분석합니다.

## Trigger Keywords

- "/gcp-cost-check"
- "비용 확인", "빌링 조회", "과금 확인"
- "cost check", "billing", "free tier usage"

## Context

- **Project**: OpenManager AI (GCP Project: `openmanager-free-tier`)
- **Billing Account**: `01D9C2-7A24CC-D7CD22` (KRW)
- **Dependencies**: `gcloud` CLI (authenticated)

## Prerequisites

```bash
# gcloud 인증 확인
gcloud auth list
# 프로젝트 확인
gcloud config get-value project
```

## Workflow

### 1. Cloud Build 사용량 분석

최근 빌드의 머신 타입과 비용을 분석합니다.

```bash
# 최근 빌드 목록 (머신 타입 포함)
gcloud builds list --project=openmanager-free-tier \
  --limit=20 \
  --format="table(id.slice(0:8),status,createTime.date(),options.machineType)"
```

**유료 머신 타입 감지**:
```bash
# E2_HIGHCPU_8 등 유료 머신 사용 빌드 상세 분석
gcloud builds list --project=openmanager-free-tier --limit=200 --format=json \
  > /tmp/builds.json

python3 <<'PYEOF'
import json
from datetime import datetime

with open("/tmp/builds.json") as f:
    data = json.load(f)

paid, total_min = [], 0
for b in data:
    mt = b.get("options", {}).get("machineType", "")
    if mt and mt != "UNSPECIFIED":
        ct, ft = b.get("createTime", ""), b.get("finishTime", "")
        paid.append(mt)
        if ct and ft:
            t1 = datetime.fromisoformat(ct.replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(ft.replace("Z", "+00:00"))
            total_min += (t2 - t1).total_seconds() / 60

print(f"Total builds: {len(data)}")
print(f"유료 머신 빌드: {len(paid)}")
print(f"무료 머신 빌드: {len(data) - len(paid)}")
if paid:
    # E2_HIGHCPU_8: $0.016/min
    cost = total_min * 0.016
    print(f"유료 빌드 총 시간: {total_min:.1f}분")
    print(f"예상 비용: ${cost:.2f} USD (약 {int(cost * 1400):,} KRW)")
PYEOF
```

**Free Tier 기준**:

| 항목 | 무료 한도 | 유료 시작 |
|------|----------|----------|
| Cloud Build 기본 머신 (e2-medium) | 120분/일 | 초과분 $0.003/min |
| Cloud Build 커스텀 머신 (E2_HIGHCPU_8 등) | **무료 아님** | $0.016/min |

### 2. Cloud Run 리소스 확인

```bash
# 서비스 리소스 설정 확인
gcloud run services describe ai-engine \
  --project=openmanager-free-tier \
  --region=asia-northeast1 \
  --format="table(status.url,spec.template.spec.containers[0].resources.limits)"
```

**Free Tier 기준**:

| 항목 | 무료 한도 |
|------|----------|
| vCPU | 180,000 vCPU-sec/월 (~50hr) |
| Memory | 360,000 GB-sec/월 (~200hr) |
| Requests | 2M/월 |

### 3. 빌링 계정 정보

```bash
# 빌링 계정 확인
gcloud billing accounts list

# 프로젝트 빌링 연결 확인
gcloud billing projects describe openmanager-free-tier

# 예산 알림 확인
gcloud billing budgets list --billing-account=01D9C2-7A24CC-D7CD22
```

### 4. 최근 빌드 머신 타입 검증

수정된 cloudbuild.yaml이 반영되었는지 확인합니다.

```bash
# 가장 최근 빌드의 머신 타입 확인
gcloud builds describe $(gcloud builds list --project=openmanager-free-tier --limit=1 --format="value(id)") \
  --project=openmanager-free-tier \
  --format="value(options.machineType)"
```

- 출력이 비어있으면: 기본 머신 (e2-medium, 무료)
- `E2_HIGHCPU_8` 출력: **유료 머신 사용 중 - 즉시 수정 필요**

## Output Format

```
GCP Cost Check Results
├─ Project: openmanager-free-tier
├─ Billing: 01D9C2-7A24CC-D7CD22 (KRW)
├─ Cloud Build
│  ├─ 최근 빌드: {N}개 (유료: {M}개)
│  ├─ 유료 빌드 시간: {X}분
│  └─ 예상 비용: ${Y} USD (~{Z} KRW)
├─ Cloud Run
│  ├─ CPU: {cpu}
│  ├─ Memory: {mem}
│  └─ Max Instances: {n}
└─ Status: {FREE_TIER_OK | COST_WARNING}
```

## Edge Cases

**Case 1: gcloud 미인증**
- Check: `gcloud auth list`에 계정 없음
- Action: `gcloud auth login` 실행

**Case 2: Billing API 비활성화**
- Check: `gcloud services list --enabled | grep billing` 결과 없음
- Action: `gcloud services enable cloudbilling.googleapis.com --project=openmanager-free-tier`

**Case 3: 유료 머신 타입 감지**
- Check: 빌드에 `E2_HIGHCPU_8`, `N1_HIGHCPU_8` 등 출력
- Action: `cloudbuild.yaml`에서 `machineType` 제거, `.claude/rules/deployment.md` Free Tier 규칙 참조

## Success Criteria

- Cloud Build 머신 타입이 기본값(e2-medium)인지 확인
- Cloud Run 리소스가 Free Tier 범위(1 vCPU, 512Mi) 내인지 확인
- 유료 리소스 감지 시 경고 출력

## Related Skills

- `cloud-run-deploy` - Cloud Run AI Engine 배포
- `security-audit-workflow` - 보안 감사

## Cost Incident Log (실제 과금 사례)

### 2026-01 (약 20,000 KRW, 세금 포함)

| 항목 | 원인 | 비용 |
|------|------|------|
| Cloud Build | `E2_HIGHCPU_8` 머신 95회 사용 (350분) | ~$5.6 |
| Cloud Run | gen2 실행환경 + cpu-throttling=false + maxScale=3 | 추가 과금 |
| **합계** | | **~20,000 KRW (세금 포함)** |

**근본 원인**: 커밋 `044ae3a36` (2026-01-06)에서 AI가 "optimize" 명목으로 `E2_HIGHCPU_8` 추가. Free Tier 규칙 부재로 리뷰에서 미발견.

**교훈**: 성능 최적화 = 머신 스펙 업그레이드가 아님. 캐시, 병렬화, 코드 개선으로 해결할 것.

## Changelog

- 2026-02-02: v1.0.0 - 초기 생성 (Cloud Build 유료 머신 사건 재발 방지)
