# Environment Variable Sync Rules

## 환경변수 변경 시 체크리스트

### 1. 환경변수 이름 변경/추가/삭제 시

```bash
# 1. 로컬 환경변수 확인
grep "NEW_VAR_NAME" .env.local

# 2. Vercel Production 동기화 (필수!)
vercel env ls production | grep "VAR_NAME"
vercel env add VAR_NAME production --force

# 3. 검증
curl https://openmanager-ai.vercel.app/api/health
```

### 2. Cloud Run 관련 변수 (Critical)

| 변수 | 용도 | 필수 |
|------|------|:----:|
| `CLOUD_RUN_ENABLED` | AI 기능 활성화 | ✅ |
| `CLOUD_RUN_AI_URL` | AI Engine URL | ✅ |
| `CLOUD_RUN_API_SECRET` | API 인증 키 | ✅ |

### 3. 동기화 명령어

```bash
# 전체 동기화 (로컬 → Vercel)
npm run env:sync:production

# 단일 변수 동기화
echo "VALUE" | vercel env add VAR_NAME production --force
```

### 4. 배포 전 검증

```bash
# AI health check (503 방지)
curl https://openmanager-ai.vercel.app/api/health?service=ai
```

## AI SDK 업그레이드 체크리스트

### useChat 옵션 변경 시

- [ ] `resume: true` 추가 시 → `prepareReconnectToStreamRequest` 확인
- [ ] `transport` 변경 시 → 서버 API 계약 확인
- [ ] 새 옵션 추가 시 → 공식 문서 URL 패턴 확인

### 서버 API 변경 시

- [ ] URL 패턴 변경 → 클라이언트 동기화 필요
- [ ] 새 엔드포인트 추가 → E2E 테스트 추가

## 관련 문서

- [AI SDK Resume Streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams)
- [Vercel CLI env](https://vercel.com/docs/cli/env)
