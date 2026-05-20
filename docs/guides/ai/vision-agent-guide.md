# Vision Agent 사용 가이드

> Vision Agent 멀티모달 분석 기능의 사용법/제약/운영 가이드
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-05-20
> Canonical: docs/guides/ai/vision-agent-guide.md
> Tags: ai,vision,guide
>
> **Version**: 1.3.4 | **Last Updated**: 2026-05-20

## 개요

Vision Agent는 멀티모달 분석을 위한 AI 에이전트로, 이미지와 문서를 분석하여 서버 모니터링 컨텍스트에서 인사이트를 제공합니다.

### 핵심 특징

- **모델**: Gemini 2.5 Flash-Lite 기본 (`GEMINI_VISION_MODEL_ID`로 override 가능)
- **컨텍스트 윈도우**: 1M 토큰 (대용량 문서 처리)
- **멀티모달 지원**: 이미지 + 텍스트 동시 분석
- **폴백**: Gemini 미가용 시 텍스트 기반 Analyst Agent로 graceful degradation

> 운영 기준 note:
> 기본 Vision 경로는 `gemini-2.5-flash-lite`입니다. Google Gemini API 기준 Flash-Lite는 thinking capability가 있지만, thinking budget 미설정 기본값은 "model does not think"이며 `thinkingBudget=-1`로 dynamic thinking을 켤 수 있습니다. 현재 OpenManager Vision runtime은 `thinkingConfig`를 전달하지 않고, UI의 `심층 분석` 모드도 Vision provider-native thinking을 켜지 않습니다.

### 운영 검증 상태

- Gemini Vision primary: `v8.11.184` / `QA-20260519-0538`에서 기존 Playwright PNG 1장으로 production 수동 smoke 확인
- Z.AI `glm-4.6v-flash` fallback: `QA-20260519-0539`에서 historical smoke를 통과했지만, `QA-20260520-0541`에서 upstream overload로 HTTP 500이 재현되어 2026-05-20 runtime fallback에서 제거
- Gemini answer quality: `QA-20260520-0542`에서 서버명/현재 수치 판독은 통과했지만, forecast delta 일부를 오인식했다. 정확한 수치 판단은 metric data tool/evidence가 우선이다.
- 현재 runtime Vision provider는 Gemini 하나뿐이며 Z.AI는 text fallback 전용
- 실이미지 Vision smoke는 provider quota 보호를 위해 명시 요청 또는 Vision routing/provider 변경 시에만 1회 실행한다.

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
- **폴백**: `Gemini` 설정/사용 불가 시 분석 용도를 유지한 채 텍스트 기반 `Analyst Agent`로 폴백합니다. Z.AI GLM Vision은 runtime fallback으로 사용하지 않습니다.
- **범위 제한**: Vision Agent는 모니터링/운영 판단과 관련된 스크린샷, 로그 이미지, 인프라 다이어그램, 성능 지표를 우선 분석합니다. 무관한 이미지이거나 판독이 불가능하면 억지 분석 대신 "첨부 이미지만으로는 OpenManager 운영 분석을 할 수 없습니다" 형태로 짧게 반환합니다.

### Gemini 멀티모달 입력 기준

- 단일 이미지 요청은 Google Gemini 권장 방식에 맞춰 이미지 파트를 텍스트 요청보다 먼저 배치합니다.
- 단일 PDF 요청도 Google Gemini 권장 방식에 맞춰 PDF 파일 파트를 텍스트 요청보다 먼저 배치합니다.
- 여러 이미지를 보낼 때는 `image 1`, `image 2`처럼 인덱스를 붙여 모델이 이미지를 구분하도록 합니다.
- 여러 파일을 보낼 때는 `file 1`, `file 2`처럼 인덱스를 붙여 모델이 파일을 구분하도록 합니다.
- 흐림/저해상도/회전된 이미지, 작은 글자 OCR, 여러 카드의 수치 매칭은 모델 한계가 있으므로 정확한 운영 수치는 metric data tool/evidence를 우선합니다.

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
- 첨부 로그/문서 내용을 멀티모달 입력으로 받아 요약
- 에러 스택 트레이스 패턴 인식
- 필요 시 Vision 실패 후 Analyst Agent로 안전 폴백

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

### 메시지 형식 (AI SDK v6)

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

Vision 요청은 백엔드에서 다음 우선순위로 처리됩니다.

1. **첨부 파일/이미지 감지**: 메시지에 이미지 또는 파일 파트 존재
2. **Vision Agent 가용성**: `GEMINI_API_KEY` 또는 `GEMINI_API_KEY_PRIMARY`로 Gemini Vision Provider 구성 여부 확인
3. **폴백 처리**: Gemini Vision Provider가 미설정/장애 상태이면 텍스트 기반 `Analyst Agent`로 라우팅

```typescript
// 핵심 라우팅 의사코드
if (hasAttachments && isVisionAgentAvailable()) {
  return { agent: 'Vision Agent', isFallback: false };
}
if (hasAttachments) {
  return { agent: 'Analyst Agent', isFallback: true };
}
return null; // 오케스트레이터 기본 라우팅으로 진행
```

## 환경변수 설정

Vision Agent 사용을 위한 권장 환경변수:

```bash
# .env.local 또는 Cloud Run/Vercel 환경변수
GEMINI_API_KEY=your-gemini-api-key
GEMINI_VISION_MODEL_ID=gemini-2.5-flash-lite
```

### 환경변수 확인

```bash
# Cloud Run에서 확인
curl https://ai-engine-xxx.run.app/health
# 응답: { "providers": { "gemini": true, "zai": true, ... } }
```

## 문제 해결

### Vision Agent가 선택되지 않음

1. **Vision Provider API 키 확인**:
```bash
# 로컬
echo $GEMINI_API_KEY

# Cloud Run / Vercel
vercel env ls production | grep GEMINI
```

1. **첨부 파일 형식 확인**:
   - 지원되는 MIME 타입인지 확인
   - 파일 크기 제한 확인

### Search Grounding이 바로 보이지 않음

- `searchWithGrounding`, `analyzeLargeLog`, `analyzeUrlContent` 도구는 코드베이스에 존재하지만,
  현재 `Vision Agent` 기본 노출 도구는 `analyzeScreenshot` + `finalAnswer`입니다.
- 즉 "Vision 기능이 있다"와 "기본 Vision tool loop에 항상 노출된다"는 다른 개념입니다.

### 분석 품질이 낮음

- 이미지 해상도 확인 (너무 작으면 인식률 저하)
- 텍스트 포함 이미지는 선명도 중요
- 복잡한 다이어그램은 명확한 질문과 함께 제출
- OpenManager metric 카드의 현재값/예측 변화율처럼 정확한 수치가 필요한 답변은 Vision OCR만 신뢰하지 말고 metric data 기반 질의로 확인
- 모니터링/운영과 무관한 이미지는 정상적으로 분석 거절될 수 있음

### 폴백이 발생함

```
Agent: Analyst (텍스트 모드)
원인: Gemini Vision Provider 미설정, rate limit, 또는 provider 장애
```

해결: `GEMINI_API_KEY` 또는 `GEMINI_API_KEY_PRIMARY`, `GEMINI_VISION_MODEL_ID` 환경변수 설정/가용성 확인

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

_Last Updated: 2026-05-20_
