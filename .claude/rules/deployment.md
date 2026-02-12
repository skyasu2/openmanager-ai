# Deployment Rules

## Version Management (Lock-Step)

Next.js Root와 Cloud Run AI Engine 버전이 `.versionrc`를 통해 자동 동기화됩니다.

```bash
npm run release:patch       # 버그 수정 (5.84.1 → 5.84.2)
npm run release:minor       # 기능 추가 (5.84.1 → 5.85.0)
npm run release:major       # 메이저 변경 (5.84.1 → 6.0.0)
npm run release:dry-run     # 릴리스 미리보기
git push --follow-tags      # 태그 푸시 → 배포 트리거
```

## Deployment Targets

### Frontend (Vercel)

| 항목 | 값 |
|------|-----|
| Trigger | `git push` 자동 배포 |
| Branch | `main` → Production |
| URL | `openmanager-ai.vercel.app` |
| Plan | Pro ($20/mo, 비용 최소화) |

#### Pro 플랜 설정 (v8.0.0)

| 항목 | 설정 | 비고 |
|------|------|------|
| `maxDuration` | 10~60초 (엔드포인트별) | AI 라우트는 30~60초 |
| `memory` | 256~1024MB (엔드포인트별) | supervisor 1024MB |
| Build Machine | **Standard** ($0.014/min) | Turbo 사용 금지 |
| Cron Jobs | 비활성화 | `DISABLE_CRON_JOBS=true` |
| Fluid Compute | 활성화 | Cold start 제거 |

> **비용 주의**: Build Machine은 반드시 **Standard** 사용. Turbo($0.126/min)는 ~$50/월 추가 비용

### AI Engine (Cloud Run)

| 항목 | 값 |
|------|-----|
| Trigger | Tag 생성 (`v5.xx.x`) 또는 수동 |
| Region | `asia-northeast1` (Seoul) |
| URL | `ai-engine-*.asia-northeast1.run.app` |
| Script | `cloud-run/ai-engine/deploy.sh` |
| Plan | Free Tier |

```bash
# Cloud Run 수동 배포
cd cloud-run/ai-engine
./deploy.sh
```

#### Cloud Run / Cloud Build Free Tier 제한사항

| 항목 | 무료 한도 | 규칙 |
|------|----------|------|
| Cloud Build 머신 | `e2-medium` (기본값)만 무료 | `--machine-type` 옵션 **사용 금지** |
| Cloud Build 시간 | 120분/일 | 기본 머신만 해당 |
| Cloud Run vCPU | 180,000 vCPU-sec/월 (~50hr) | CPU: 1 vCPU |
| Cloud Run Memory | 360,000 GB-sec/월 (~200hr) | Memory: 512Mi |
| Cloud Run Requests | 2M/월 | - |

> **⚠️ 중요**: `E2_HIGHCPU_8`, `N1_HIGHCPU_8` 등 커스텀 머신 타입은 무료 대상이 아닙니다.
> `cloudbuild.yaml`에 `machineType` 추가하거나 `deploy.sh`에 `--machine-type` 옵션을 추가하지 마세요.

## Free Tier Guard Rules (AI 필독)

> **실제 사고**: 2026-01 Cloud Build `E2_HIGHCPU_8` + Cloud Run 과금으로 약 **20,000 KRW** 청구됨.
> AI가 "optimize" 명목으로 유료 머신을 추가한 것이 원인. (`/gcp-cost-check`로 비용 조회 가능)

AI가 인프라/배포 설정을 변경할 때 반드시 준수:

1. **비용 발생 옵션 추가 금지**: machine-type, GPU, 고사양 인스턴스 등
2. **리소스 증가 시 무료 한도 확인 필수**: vCPU, Memory, instances 변경 전 위의 Free Tier 테이블 참조
3. **"최적화" ≠ 스펙 업그레이드**: 성능 최적화는 캐시, 병렬화, 코드 개선으로 해결. 머신 스펙 올리는 건 최적화가 아님
4. **비용 변경 커밋에 [COST] 태그**: 인프라 비용에 영향을 주는 변경은 커밋 메시지에 명시

## Environment Variables

| 플랫폼 | 관리 방식 |
|--------|----------|
| Vercel | Vercel Dashboard / `.env.production` |
| Cloud Run | GCP Secret Manager |

## Health Check

```bash
# Vercel 상태 확인
curl https://openmanager-ai.vercel.app/api/health

# Cloud Run AI 상태 확인
curl https://ai-engine-*.run.app/health
```

## Rollback

### Vercel
- Dashboard → Deployments → 이전 배포 선택 → Promote to Production

### Cloud Run
```bash
# 이전 리비전으로 트래픽 전환
gcloud run services update-traffic ai-engine \
  --to-revisions=REVISION_NAME=100 \
  --region=asia-northeast1
```

## Checklist

배포 전 확인사항:
- [ ] `npm run validate:all` 통과
- [ ] `npm run test:e2e:critical` 통과
- [ ] CHANGELOG.md 업데이트
- [ ] 환경변수 동기화 확인

---

**See Also**: 상세 문서 → `docs/reference/architecture/infrastructure/deployment.md`
