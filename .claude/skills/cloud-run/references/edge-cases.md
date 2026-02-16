# Cloud Run Deployment - Edge Cases

배포 과정에서 발생할 수 있는 문제 상황과 해결책입니다.

## Case 1: Build Failure

**증상**: Cloud Build 단계에서 빌드 실패

**확인사항**:
- Dockerfile syntax 오류
- npm dependencies 설치 실패
- TypeScript 컴파일 에러

**해결책**:
```bash
# 로컬에서 빌드 테스트
cd cloud-run/ai-engine
docker build -t ai-engine-test .

# TypeScript 컴파일 확인
npm run build

# 의존성 확인
npm ci
```

**추가 진단**:
- Cloud Console에서 Cloud Build 로그 확인
- 이전 성공한 빌드와 Dockerfile 비교

---

## Case 2: Deployment Timeout

**증상**: 빌드는 성공했지만 배포가 600s 시간 초과

**확인사항**:
- 이미지 크기 확인 (< 500MB 권장)
- 네트워크 문제
- Cloud Run 할당량 초과

**해결책**:
```bash
# 이미지 크기 확인
docker images | grep ai-engine

# Cloud Build 로그 확인
gcloud builds list --limit=5

# 시간 초과 설정 증가 (최대 900s)
gcloud builds submit --timeout=900s
```

---

## Case 3: Health Check Failure

**증상**: 배포 후 /health 엔드포인트에서 오류 응답

**확인사항**:
- Cold start 지연 (~10-20s)
- 환경변수 누락
- 포트 설정 오류

**해결책**:
```bash
# 30초 대기 후 재시도
sleep 30
SERVICE_URL=$(gcloud run services describe ai-engine --region asia-northeast1 --format='value(status.url)')
curl -s ${SERVICE_URL}/health | jq

# 환경변수 확인
gcloud run services describe ai-engine --region asia-northeast1 --format='yaml(spec.template.spec.containers[0].env)'

# 로그 확인
gcloud run services logs ai-engine --region asia-northeast1 --limit=50
```

---

## Case 4: Permission Denied

**증상**: `PERMISSION_DENIED` 또는 인증 오류

**확인사항**:
- gcloud 인증 상태
- 프로젝트 접근 권한
- Service Account 권한

**해결책**:
```bash
# 재인증
gcloud auth login
gcloud auth application-default login

# 프로젝트 확인
gcloud config get-value project

# 권한 확인
PROJECT_ID=$(gcloud config get-value project)
gcloud projects get-iam-policy "$PROJECT_ID" --flatten="bindings[].members" --format='table(bindings.role)'
```

---

## Case 5: Free Tier 초과

**증상**: 예상치 못한 비용 발생 또는 서비스 중단

**확인사항**:
- 월별 vCPU-sec 사용량 (180,000 제한)
- 월별 GB-sec 사용량 (360,000 제한)
- 요청 수 (2M 제한)

**해결책**:
```bash
# 사용량 확인
gcloud monitoring metrics list --filter="resource.type=cloud_run_revision"

# 인스턴스 수 줄이기
gcloud run services update ai-engine --max-instances=1 --region asia-northeast1
```

---

## 관련 링크

- [Cloud Run 할당량](https://cloud.google.com/run/quotas)
- [Cloud Build 문제 해결](https://cloud.google.com/build/docs/troubleshooting)
- [Cloud Run Free Tier](https://cloud.google.com/run/pricing#free-tier)
