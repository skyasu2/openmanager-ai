> Owner: project
> Status: Completed
> Last reviewed: 2026-05-16

# Provider Runtime Env Sync Plan

- 상태: Completed
- 작성일: 2026-05-16
- TODO.md 연결: Backlog 완료 이력 > Provider runtime env sync

## 목표

Cloud Run production의 provider runtime 설정을 현재 코드/문서의 provider mesh 정책과 맞춘다. 특히 Z.AI/GLM은 로컬 `.env.local`에 키가 있으나 Cloud Run Secret Manager의 `ai-providers-config`에 반영되지 않아 `/health.config.zai=false` 상태이고, Cerebras는 production env/deploy defaults가 `llama3.1-8b`에 남아 있어 다음 배포에서 `gpt-oss-120b` 전환이 되돌아갈 수 있다.

## 현재 진단

```text
Local .env.local
  ZAI_API_KEY=true
  ZAI_DEFAULT_MODEL=true
  ZAI_BASE_URL=true

GCP Secret Manager: ai-providers-config
  groq=true
  mistral=true
  zai=false
  cerebras=true
  gemini=true
  openrouter=true

Cloud Run /health
  version=8.11.159
  config.zai=false
  config.cerebras=true

Deploy defaults
  cloud-run/ai-engine/deploy.sh        CEREBRAS_MODEL_ID=llama3.1-8b
  cloud-run/ai-engine/cloudbuild.yaml  CEREBRAS_MODEL_ID=llama3.1-8b
```

## 범위

포함:
- `ai-providers-config` JSON secret에 `zai` 값을 병합한다. 기존 provider key는 보존한다.
- Cloud Run revision에서 `AI_PROVIDERS_CONFIG=ai-providers-config:latest`가 새 secret version을 읽도록 revision refresh를 수행한다.
- `CEREBRAS_MODEL_ID` production/deploy 기본값을 `gpt-oss-120b`로 정렬한다.
- `ZAI_BASE_URL`, `ZAI_DEFAULT_MODEL`, `ZAI_VISION_MODEL_ID`는 코드 기본값과 env override 중 하나의 기준으로 명확히 고정한다.
- secret 값은 로그, 문서, 커밋 메시지, QA evidence에 기록하지 않는다.

제외:
- 새로운 paid provider 추가.
- provider quota 상향 또는 Cloud Run scale/memory 증설.
- Z.AI/GLM을 NLQ primary로 즉시 전환하는 정책 변경. 이번 작업은 provider 가용화와 drift 제거까지만 다룬다.

## 설계 판단

### 옵션 비교

| 옵션 | 방식 | 장점 | 단점 | 판정 |
|------|------|------|------|------|
| A | Secret만 업데이트 | 가장 작음 | 기존 revision이 latest secret을 즉시 다시 읽는지 보장 약함, Cerebras deploy drift 미해결 | 탈락 |
| B | Secret 업데이트 + Cloud Run revision refresh | 코드 없이 `zai=true` 회복 가능 | 다음 deploy defaults가 stale이면 Cerebras가 재드리프트 | 부분 사용 |
| C | deploy defaults 수정 + Secret 업데이트 + revision/deploy 검증 | 재발 방지와 현재 runtime 회복 모두 충족 | 검증 범위가 가장 큼 | 채택 |

### TO-BE 흐름

```text
local .env.local(ZAI_API_KEY)
  -> merge into Secret Manager ai-providers-config.latest
  -> Cloud Run revision refresh
  -> /health.config.zai=true

deploy defaults
  deploy.sh/cloudbuild.yaml CEREBRAS_MODEL_ID=gpt-oss-120b
  -> 다음 GitLab CI deploy에서도 Cerebras model drift 재발 방지
```

## 계약 (Contract)

### 변경 대상 파일

| 파일/대상 | 변경 |
|-----------|------|
| `cloud-run/ai-engine/deploy.sh` | `CEREBRAS_MODEL_ID` 기본값을 `gpt-oss-120b`로 정렬 |
| `cloud-run/ai-engine/cloudbuild.yaml` | Cloud Build deploy env의 `CEREBRAS_MODEL_ID`를 `gpt-oss-120b`로 정렬 |
| `docs/development/environment-variables.md` | Cerebras/Z.AI production env 설명을 현재 runtime 정책과 정렬 |
| GCP Secret Manager `ai-providers-config` | 기존 JSON 유지 + `zai` key 추가 |
| Cloud Run service `ai-engine` | 새 secret version과 provider env가 적용된 revision 생성 |

### Runtime 계약

| 항목 | 기대값 |
|------|--------|
| `/health.config.zai` | `true` |
| `/health.config.cerebras` | `true` |
| `AI_PROVIDERS_CONFIG.zai` | 존재, 값은 비공개 |
| `CEREBRAS_MODEL_ID` | `gpt-oss-120b` |
| `ZAI_DEFAULT_MODEL` | `glm-4.5-flash` 또는 코드 기본값과 동일 |
| `ZAI_BASE_URL` | `https://api.z.ai/api/paas/v4` 또는 코드 기본값과 동일 |

### 보안 계약

- Secret Manager 원문 출력 금지.
- 검증 로그는 provider별 boolean과 revision/version만 기록.
- `/tmp` 임시 파일은 작업 종료 후 삭제.
- 커밋에는 secret 값, masked prefix/suffix, base64 dump를 포함하지 않는다.

### 테스트/검증 시나리오

- [ ] Preflight: 로컬 `.env.local`에 `ZAI_API_KEY`가 있고 비어 있지 않다.
- [ ] Preflight: GCP `ai-providers-config` latest는 JSON으로 파싱 가능하고 기존 provider key가 보존된다.
- [ ] Code guard: `deploy.sh`와 `cloudbuild.yaml`에 `CEREBRAS_MODEL_ID=llama3.1-8b` production 기본값이 남지 않는다.
- [x] Secret sync: Secret Manager latest에 `zai=true`가 된다. 값은 출력하지 않는다.
- [x] Cloud Run health: 새 revision 이후 `/health.config.zai=true`, `/health.config.cerebras=true`.
- [ ] Smoke: 가능하면 인증된 `/api/ai/providers` 또는 provider status endpoint에서 Z.AI 모델이 `glm-4.5-flash`로 표시된다.

## Task 목록

> 착수 전 Status를 Approved로 전환한다. production Secret/Cloud Run 변경은 T1~T5 순서로만 진행한다.

- [x] T0. 계획서 검토 및 Approved 전환
- [x] T1. `deploy.sh`/`cloudbuild.yaml` Cerebras model default를 `gpt-oss-120b`로 정렬하고 회귀 테스트/문서 영향 확인
- [x] T2. `docs/development/environment-variables.md`의 Cerebras/Z.AI env 설명을 현재 정책으로 갱신
- [x] T3. Secret Manager `ai-providers-config` latest를 안전 병합 방식으로 업데이트
- [x] T4. Cloud Run `ai-engine` 새 revision 생성 또는 GitLab CI deploy로 secret/env 적용
- [x] T5. `/health`와 provider status smoke로 `zai=true`, Cerebras model drift 해소 확인
- [x] T6. TODO.md와 계획서에 검증 결과 기록, 필요 시 archive 이동

## 진행 기록

### 2026-05-16 — T3~T5 runtime sync

- Secret Manager `ai-providers-config` 새 version 생성: `8`
- Cloud Run 새 revision: `ai-engine-00476-hz2`, traffic `100%`
- Service URL: `https://ai-engine-490817238363.asia-northeast1.run.app`
- `/health` 확인:
  - `version=8.11.159`
  - `config.zai=true`
  - `config.cerebras=true`
  - `config.groq=true`, `config.mistral=true`, `config.gemini=true`, `config.openrouter=true`
- Cloud Run plain env 확인:
  - `CEREBRAS_MODEL_ID=gpt-oss-120b`
  - `ZAI_BASE_URL=https://api.z.ai/api/paas/v4`
  - `ZAI_DEFAULT_MODEL=glm-4.5-flash`
  - `ZAI_VISION_MODEL_ID=glm-4.6v-flash`
- `AI_PROVIDERS_CONFIG`는 `ai-providers-config:latest` secret ref 유지.
- `/api/ai/providers`는 unauthenticated 호출에서 `success=false`로 응답해 상세 provider model smoke는 health/env 검증으로 대체했다.

### 2026-05-16 — T6 commit/push closure

- 재발 방지 변경 커밋: `f3e4eddf7 fix(deploy): sync provider runtime env defaults`
- GitLab main pipeline: `2530020344` success
- Pipeline URL: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2530020344`
- 완료 정리 커밋: `docs(planning): close provider runtime env sync`

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| T0 계획서 | `docs(planning):` | 선택 | 아니오 | 아니오 |
| T1~T2 deploy/docs hardening | `fix(deploy):` 또는 `docs:` | 예 | 예, env/deploy 적용 필요 | 아니오 |
| T3 Secret sync | 커밋 없음 | 아니오 | revision refresh 필요 | 아니오 |
| T4~T5 검증 | `test(qa):` 또는 계획서 갱신 | 선택 | 이미 수행 | 아니오 |

## 완료 기준

- [x] `zai=false` production health drift가 해소된다.
- [x] 다음 Cloud Run deploy가 `CEREBRAS_MODEL_ID=llama3.1-8b`로 되돌리지 않는다.
- [x] Secret 값이 git diff, 로그 요약, QA evidence에 남지 않는다.
- [x] Free Tier 원칙을 유지한다. provider 가용화 외 Cloud Run 리소스 증설 없음.
