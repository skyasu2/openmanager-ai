# Vision Agent 사용 가이드

> Vision Agent 멀티모달 분석 기능의 사용법/제약/운영 가이드
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-14
> Canonical: docs/guides/ai/vision-agent-guide.md
> Tags: ai,vision,guide
>
> **Version**: 1.1.0 | **Last Updated**: 2026-01-28

## 개요

Vision Agent는 멀티모달 분석을 위한 AI 에이전트로, 이미지와 문서를 분석하여 서버 모니터링 컨텍스트에서 인사이트를 제공합니다.

### 핵심 특징

- **모델**: Gemini 2.5 Flash (AI SDK v6 호환)
- **컨텍스트 윈도우**: 1M 토큰 (대용량 문서 처리)
- **멀티모달 지원**: 이미지 + 텍스트 동시 분석

> **Note**: `gemini-2.5-flash-lite`는 AI SDK v6과 호환되지 않음 (spec v1 반환, v2+ 필요)

## 지원 파일 형식

| 카테고리 | 형식 | MIME 타입 | 최대 크기 |
|---------|------|----------|---------|
| **이미지** | PNG | `image/png` | 10MB |
| | JPEG | `image/jpeg` | 10MB |
| | GIF | `image/gif` | 10MB |
| | WebP | `image/webp` | 10MB |
| **문서** | PDF | `application/pdf` | 5MB |
| | Markdown | `text/markdown` | 5MB |
| | Plain Text | `text/plain` | 5MB |

### 제한사항

- **최대 파일 개수**: 3개 (동시 첨부)
- **총 크기**: 개별 파일 제한 적용
- **Gemini 미설정 시**: Analyst Agent로 폴백 (텍스트 전용 분석)

## 사용 예시

### 1. 스크린샷 분석

대시보드 스크린샷을 첨부하고 분석을 요청합니다:

```
[이미지 첨부: dashboard-screenshot.png]
"이 대시보드에서 문제가 있는 서버를 식별해줘"
```

Vision Agent가 제공하는 분석:
- 빨간색/경고 표시 서버 식별
- 그래프의 이상 패턴 감지
- 텍스트 레이블 인식 및 해석

### 2. 로그 파일 분석

대용량 로그 파일(Markdown/TXT)을 첨부:

```
[파일 첨부: server-logs.txt]
"이 로그에서 에러 패턴을 분석하고 원인을 추론해줘"
```

Vision Agent 활용:
- 1M 토큰 컨텍스트로 대용량 로그 전체 분석
- 에러 스택 트레이스 패턴 인식
- 시간대별 에러 빈도 분석

### 3. 아키텍처 다이어그램 해석

시스템 아키텍처 이미지 분석:

```
[이미지 첨부: architecture-diagram.png]
"이 아키텍처에서 병목 지점이 될 수 있는 부분은?"
```

### 4. PDF 보고서 분석

```
[파일 첨부: monthly-report.pdf]
"이 보고서에서 개선이 필요한 메트릭을 요약해줘"
```

## API 사용법

### 프론트엔드 (useFileAttachments 훅)

```typescript
import { useFileAttachments } from '@/hooks/ai/useFileAttachments';

function ChatInput() {
  const {
    attachments,
    addFiles,
    removeFile,
    dragHandlers,
    canAddMore,
  } = useFileAttachments({
    maxFiles: 3,
    maxImageSize: 10 * 1024 * 1024, // 10MB
    maxDocSize: 5 * 1024 * 1024,    // 5MB
  });

  return (
    <div {...dragHandlers}>
      {/* 드래그 앤 드롭 영역 */}
      {attachments.map(file => (
        <AttachmentPreview
          key={file.id}
          file={file}
          onRemove={() => removeFile(file.id)}
        />
      ))}
    </div>
  );
}
```

### 메시지 형식 (AI SDK v5 호환)

```typescript
// 이미지 첨부 메시지
const message = {
  role: 'user',
  parts: [
    { type: 'text', text: '이 대시보드 분석해줘' },
    {
      type: 'image',
      image: 'data:image/png;base64,...',
      mimeType: 'image/png',
    },
  ],
};

// 파일 첨부 메시지
const fileMessage = {
  role: 'user',
  parts: [
    { type: 'text', text: '이 로그 분석해줘' },
    {
      type: 'file',
      data: 'data:text/plain;base64,...',
      mediaType: 'text/plain',
      filename: 'server.log',
    },
  ],
};
```

## 에이전트 라우팅

AgentFactory가 자동으로 Vision Agent를 선택하는 조건:

1. **파일 첨부 감지**: 메시지에 이미지 또는 파일 파트 존재
2. **Gemini 가용성**: `GOOGLE_AI_API_KEY` 환경변수 설정됨
3. **폴백**: Gemini 미설정 시 Analyst Agent 사용 (텍스트 전용)

```typescript
// AgentFactory 내부 로직
if (hasAttachments && isGeminiAvailable()) {
  return new VisionAgent();
}
return new AnalystAgent(); // 폴백
```

## 환경변수 설정

Vision Agent 사용을 위한 필수 환경변수:

```bash
# .env.local 또는 Vercel 환경변수
GOOGLE_AI_API_KEY=your-gemini-api-key
```

### 환경변수 확인

```bash
# Cloud Run에서 확인
curl https://ai-engine-xxx.run.app/health
# 응답: { "providers": { "gemini": true, ... } }
```

## 문제 해결

### Vision Agent가 선택되지 않음

1. **Gemini API 키 확인**:
   ```bash
   # 로컬
   echo $GOOGLE_AI_API_KEY

   # Vercel
   vercel env ls production | grep GOOGLE
   ```

2. **첨부 파일 형식 확인**:
   - 지원되는 MIME 타입인지 확인
   - 파일 크기 제한 확인

### 분석 품질이 낮음

- 이미지 해상도 확인 (너무 작으면 인식률 저하)
- 텍스트 포함 이미지는 선명도 중요
- 복잡한 다이어그램은 명확한 질문과 함께 제출

### 폴백이 발생함

```
Agent: Analyst (Groq/Mistral)
원인: Gemini API 키 미설정 또는 rate limit
```

해결: GOOGLE_AI_API_KEY 환경변수 설정 확인

### 재시도 시 첨부 파일 유실

**v7.1.0 이전 버전**에서는 에러 후 "재시도" 버튼 클릭 시 첨부 파일이 전달되지 않는 버그가 있었습니다.

**해결됨** (v7.1.0+):
- `useAIChatCore`의 `retryLastQuery`가 `lastAttachmentsRef`를 통해 첨부 파일 보존
- 명확화(Clarification) 플로우에서도 첨부 파일 유지

## 관련 문서

- [AI 엔진 아키텍처](../../reference/architecture/ai/ai-engine-architecture.md)
- [API 엔드포인트 레퍼런스](../../reference/api/endpoints.md)
- [시스템 아키텍처](../../reference/architecture/system/system-architecture-current.md)

---

_Last Updated: 2026-01-28_
