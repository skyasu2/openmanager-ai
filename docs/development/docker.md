# Docker 개발 환경 가이드

> Docker Desktop + WSL 2 기반 AI Engine 로컬 개발 및 배포 워크플로우
> Owner: dev-experience
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-17
> Canonical: docs/development/docker.md
> Tags: docker,cloud-run,ai-engine

## 개요

이 프로젝트에서 Docker는 **Cloud Run AI Engine 전용**으로 사용됩니다. Frontend(Next.js)는 Vercel이 직접 빌드하므로 Docker가 필요 없습니다.

```
┌─────────────────────────────────────┐
│  Frontend (Next.js)                 │  Docker 불필요
│  → npm run dev (로컬)               │  → Vercel (프로덕션)
├─────────────────────────────────────┤
│  AI Engine (Hono + Multi-Agent)     │  Docker 사용
│  → docker-compose up (로컬)         │  → Cloud Run (프로덕션)
└─────────────────────────────────────┘
```

### 언제 Docker를 쓰는가?

| 상황 | Docker 필요 | 방법 |
|------|:-----------:|------|
| Frontend 개발 | ❌ | `npm run dev:network` |
| AI Engine 코드 수정 후 로컬 테스트 | ✅ | `docker-compose up --build` |
| AI Engine 프로덕션 배포 | ✅ (GCP 빌드) | `./deploy.sh` |
| Supabase 로컬 실행 | ❌ | `npx supabase start` (내부적으로 Docker 사용) |

> **판단 기준**: `cloud-run/ai-engine/` 내부 코드를 수정했다면 Docker 테스트 권장. `src/` 내부만 수정했다면 `npm run dev`로 충분.

---

## 아키텍처: Windows + WSL 2 + Docker

```
┌─────────────────────────────────────────────────┐
│  Windows 11                                     │
│  ┌───────────────────────────────┐              │
│  │  Docker Desktop               │              │
│  │  (Docker Engine + WSL Backend)│              │
│  │  Settings > WSL Integration   │              │
│  └──────────┬────────────────────┘              │
│             │ /var/run/docker.sock               │
│  ┌──────────▼────────────────────┐              │
│  │  WSL 2 (Ubuntu 24.04)        │              │
│  │                               │              │
│  │  $ docker build ...           │              │
│  │  $ docker-compose up          │              │
│  │  $ gcloud builds submit ──────┼──→ GCP      │
│  │                               │              │
│  │  /mnt/d/.../openmanager-...   │              │
│  └───────────────────────────────┘              │
└─────────────────────────────────────────────────┘
```

Docker Desktop이 Windows에서 Docker Engine을 실행하고, WSL 2에 소켓(`/var/run/docker.sock`)을 공유합니다. WSL 터미널에서 `docker` 명령을 실행하면 이 소켓을 통해 Windows 측 엔진에 명령이 전달됩니다.

---

## Docker Desktop 설치 및 WSL 연동

### 1. Docker Desktop 설치

1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) 다운로드
2. 설치 시 **Use WSL 2 instead of Hyper-V** 체크
3. 설치 완료 후 재부팅

### 2. WSL 2 Integration 활성화

```
Docker Desktop → Settings → Resources → WSL Integration
  → Enable integration with my default WSL distro: ON
  → Ubuntu-24.04: ON
  → Apply & Restart
```

### 3. 연동 확인 (WSL 터미널)

```bash
# Docker CLI 확인
docker --version
# Docker version 29.x.x

# Docker Engine 연결 확인
docker info | head -5
# Client:
#  Version: 29.x.x
#  Context: default

# Docker Compose 확인
docker compose version
# Docker Compose version v2.x.x
```

### 4. 리소스 설정 (권장)

Docker Desktop → Settings → Resources → WSL Integration:
- **Memory**: 4GB (기본값 유지, 전체 RAM의 25% 이하)
- **CPU**: 2-4 cores
- **Swap**: 1GB

> AI Engine 컨테이너는 512MB만 사용하므로 기본 설정으로 충분합니다.

---

## 로컬 개발: Docker Compose

### 프로젝트 구조

```
cloud-run/
├── docker-compose.yml          # 로컬 개발용 Compose
├── ai-engine/
│   ├── Dockerfile              # 3-Stage Multi-stage Build
│   ├── .dockerignore           # 빌드 컨텍스트 최적화
│   ├── deploy.sh               # GCP 배포 스크립트
│   ├── cloudbuild.yaml         # CI/CD 파이프라인
│   ├── src/                    # TypeScript 소스
│   ├── data/                   # SSOT 데이터 (빌드 시 복사)
│   └── config/                 # 설정 (빌드 시 복사)
```

### 기본 실행

```bash
# cloud-run 디렉토리로 이동
cd cloud-run

# 빌드 + 실행 (foreground)
docker compose up --build

# 백그라운드 실행
docker compose up --build -d

# 로그 확인
docker compose logs -f ai-engine

# 종료
docker compose down
```

### 헬스 체크

```bash
# 컨테이너 실행 후
curl http://localhost:8080/health
# {"status":"ok","version":"8.0.0",...}
```

### 환경변수 설정

`docker-compose.yml`은 호스트의 환경변수를 참조합니다. `.env` 파일을 `cloud-run/` 디렉토리에 생성:

```bash
# cloud-run/.env (Git 미추적)
CLOUD_RUN_API_SECRET=test-secret
CEREBRAS_API_KEY=your-key
GROQ_API_KEY=your-key
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```

또는 프로젝트 루트 `.env.local`의 값을 재사용:

```bash
# cloud-run 디렉토리에서
source ../.env.local && docker compose up --build
```

### 핫리로드 개발 (Override)

기본 `docker-compose.yml`은 프로덕션 이미지를 빌드합니다. 개발 시 소스 변경을 실시간 반영하려면 override 파일을 생성:

```yaml
# cloud-run/docker-compose.override.yml (Git 미추적)
services:
  ai-engine:
    build:
      target: deps      # deps 스테이지까지만 빌드 (빠름)
    volumes:
      - ./ai-engine/src:/app/src:ro    # 소스 마운트
      - ./ai-engine/data:/app/data:ro  # 데이터 마운트
    command: ["npx", "tsx", "watch", "src/server.ts"]
    environment:
      - NODE_ENV=development
```

```bash
# override가 자동 적용됨
docker compose up --build

# 이제 cloud-run/ai-engine/src/ 파일 수정 시 자동 재시작
```

> override 파일은 `.gitignore`에 이미 포함되어 있습니다.

---

## Dockerfile 구조 (3-Stage)

```
Stage 1: deps                Stage 2: builder             Stage 3: runner
────────────────             ────────────────             ────────────────
node:24-alpine3.21           node:24-alpine3.21           node:24-alpine3.21

  dumb-init 설치               node_modules 복사            dumb-init 복사
  npm ci                       TypeScript 빌드             non-root user
                               npm prune --prod            production deps
                                                           dist/ (빌드 결과)
                                                           data/ (SSOT)
                                                           config/

최종 이미지: ~693MB
실행: dumb-init → node dist/server.js
포트: 8080
메모리: max-old-space=384MB
```

핵심 설계:
- **dumb-init**: PID 1 문제 해결 (SIGTERM 정상 전파, graceful shutdown)
- **non-root user**: `appuser:nodejs` (UID 1001) 보안 강화
- **Alpine 3.21**: 최소 이미지 크기
- **384MB heap**: 512Mi Cloud Run 컨테이너 내 안전 마진

---

## 프로덕션 배포 (Cloud Run)

### 배포 흐름

```
WSL 터미널
  │
  ├─ ./deploy.sh 실행
  │
  ├─ Phase 0: SSOT 데이터 동기화
  │   public/data/otel-data/*   → cloud-run/ai-engine/data/otel-data/
  │   (호환 경로) otel-processed → cloud-run/ai-engine/data/otel-processed/
  │   src/config/rules/system-rules.json → cloud-run/ai-engine/config/
  │
  ├─ Phase 1: gcloud builds submit (GCP Cloud Build)
  │   ※ 로컬 Docker 사용 안 함! 소스를 GCS에 업로드 → GCP에서 빌드
  │   ※ 기본 e2-medium 머신 (Free Tier, --machine-type 금지)
  │
  ├─ Phase 2: Cloud Run Deploy
  │   1 vCPU, 512Mi, scale-to-zero, cpu-throttling ON
  │
  ├─ Phase 3: Health Check
  │
  └─ Phase 4: 구버전 정리 (이미지 3개, 리비전 3개만 보관)
```

### 배포 명령어

```bash
cd cloud-run/ai-engine
./deploy.sh
```

> `deploy.sh`는 `gcloud builds submit`을 사용하므로 **로컬 Docker가 없어도 배포 가능**합니다. 소스코드가 GCS에 업로드되고 GCP Cloud Build가 Dockerfile로 빌드합니다.

### Artifact Registry

이미지는 Artifact Registry에 저장됩니다:

```
asia-northeast1-docker.pkg.dev/{PROJECT_ID}/cloud-run/ai-engine:{TAG}
```

```bash
# 이미지 목록 확인
gcloud artifacts docker images list \
  asia-northeast1-docker.pkg.dev/{PROJECT_ID}/cloud-run/ai-engine

# 최신 3개만 유지 (deploy.sh가 자동 정리)
```

### Free Tier 제한

| 항목 | 무료 한도 | 현재 설정 |
|------|----------|----------|
| Cloud Build | e2-medium, 120분/일 | 기본 머신 (변경 금지) |
| Cloud Run vCPU | 180,000 sec/월 (~50hr) | 1 vCPU |
| Cloud Run Memory | 360,000 GB-sec/월 | 512Mi |
| Cloud Run Requests | 2M/월 | - |
| Artifact Registry | 500MB 무료 | ~693MB/이미지, 3개 보관 |

---

## 자주 사용하는 명령어

### 로컬 개발

```bash
# 빌드 + 실행
docker compose up --build

# 백그라운드 실행
docker compose up -d

# 로그
docker compose logs -f ai-engine

# 종료
docker compose down

# 이미지/볼륨 정리
docker compose down --rmi local --volumes
```

### 디버깅

```bash
# 실행 중인 컨테이너에 접속
docker exec -it ai-engine-local sh

# 컨테이너 상태 확인
docker ps
docker inspect ai-engine-local

# 이미지 크기 확인
docker images ai-engine
```

### 프로덕션 배포

```bash
# 전체 배포
cd cloud-run/ai-engine && ./deploy.sh

# 헬스 체크만
curl https://ai-engine-xxx.run.app/health
```

---

## 관련 문서

- [프로젝트 설정](./project-setup.md) - WSL/Node.js/환경변수 Canonical 설정
- [개발 도구](./dev-tools.md) - 개발 도구 레퍼런스
- [배포 토폴로지](../reference/architecture/system/system-architecture-current.md#9-deployment-topology) - Vercel + Cloud Run 배포
- [트러블슈팅](../troubleshooting/common-issues.md) - Docker 관련 문제 해결
- [Cloud Run README](../../cloud-run/README.md) - AI Engine 서비스 상세

_Last Updated: 2026-02-13_
