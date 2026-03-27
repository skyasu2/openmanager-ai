/**
 * Message Normalizer
 *
 * @description AI SDK v6 UIMessage와 레거시 메시지 형식을 통합 처리
 * @updated 2026-01-27 - 멀티모달 지원 (이미지, 파일)
 *
 * @usage
 * - UI 컴포넌트: extractTextFromUIMessage(message)
 * - API 라우트: normalizeMessagesForCloudRun(messages)
 *
 * @created 2025-12-30
 * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#image-parts
 */

import type { UIMessage } from '@ai-sdk/react';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 이미지 첨부 파일 (Vision Agent용)
 * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#image-parts
 */
export interface ImageAttachment {
  /** 이미지 데이터: Base64, Data URL, 또는 HTTP(S) URL */
  data: string;
  /** MIME 타입 (예: 'image/png', 'image/jpeg') */
  mimeType: string;
  /** 표시용 파일명 (선택) */
  name?: string;
}

/**
 * 파일 첨부 (PDF, 오디오 등)
 * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#file-parts
 */
export interface FileAttachment {
  /** 파일 데이터: Base64 또는 HTTP(S) URL */
  data: string;
  /** MIME 타입 (예: 'application/pdf', 'audio/mpeg') */
  mimeType: string;
  /** 파일명 (선택) */
  name?: string;
}

/**
 * Cloud Run용 정규화된 메시지 (멀티모달 지원)
 */
export interface NormalizedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** 이미지 첨부 (Vision Agent) */
  images?: ImageAttachment[];
  /** 파일 첨부 (PDF, 오디오 등) */
  files?: FileAttachment[];
}

/**
 * AI SDK v6 TextPart 타입
 */
interface TextPart {
  type: 'text';
  text: string;
}

/**
 * AI SDK v6 ImagePart 타입
 */
interface ImagePart {
  type: 'image';
  image: string;
  mimeType?: string;
}

/**
 * AI SDK v6 FilePart 타입
 * 🎯 Fix: url/mediaType (클라이언트) + data/mimeType (서버) 모두 지원
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#files
 */
interface FilePart {
  type: 'file';
  /** 파일 데이터 (서버 측 사용) */
  data?: string;
  /** 파일 URL (클라이언트 측 사용, data URL 포함) */
  url?: string;
  /** MIME 타입 (서버 측) */
  mimeType?: string;
  /** Media 타입 (클라이언트 측) */
  mediaType?: string;
  /** 파일명 (다양한 필드명 지원) */
  name?: string;
  filename?: string;
}

/**
 * 하이브리드 메시지 타입 (parts + content 모두 지원, 멀티모달 포함)
 * 🎯 Fix: url/mediaType/filename 필드 추가 (AI SDK v6 FileUIPart 호환)
 */
export interface HybridMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  parts?: Array<{
    type: string;
    text?: string;
    image?: string;
    /** 파일 데이터 (서버 측) */
    data?: string;
    /** 파일 URL (클라이언트 측, data URL 포함) */
    url?: string;
    /** MIME 타입 (서버 측) */
    mimeType?: string;
    /** Media 타입 (클라이언트 측) */
    mediaType?: string;
    /** 파일명 */
    name?: string;
    filename?: string;
  }>;
  content?: string;
  createdAt?: Date | string;
}

// ============================================================================
// 텍스트 추출 함수
// ============================================================================

/**
 * AI SDK v5 UIMessage에서 텍스트 콘텐츠 추출
 *
 * @description UI 컴포넌트용 (AISidebarV4, AIWorkspace)
 * @param message - UIMessage 객체
 * @returns 추출된 텍스트 (없으면 빈 문자열)
 *
 * @example
 * const text = extractTextFromUIMessage(message);
 * // message.parts: [{ type: 'text', text: 'Hello' }]
 * // returns: 'Hello'
 */
export function extractTextFromUIMessage(message: UIMessage): string {
  if (!message.parts || message.parts.length === 0) {
    return '';
  }

  return message.parts
    .filter((part): part is TextPart => part != null && part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/**
 * 하이브리드 메시지에서 텍스트 콘텐츠 추출
 *
 * @description API 라우트용 (AI SDK v5 parts + 레거시 content 모두 지원)
 * @param message - HybridMessage 객체
 * @returns 추출된 텍스트 (없으면 빈 문자열)
 *
 * @example
 * // AI SDK v5 형식
 * extractTextFromHybridMessage({ parts: [{ type: 'text', text: 'Hello' }] })
 * // returns: 'Hello'
 *
 * // 레거시 형식
 * extractTextFromHybridMessage({ content: 'Hello' })
 * // returns: 'Hello'
 */
export function extractTextFromHybridMessage(message: HybridMessage): string {
  // 1. AI SDK v5 parts 배열에서 텍스트 추출
  if (message.parts && Array.isArray(message.parts)) {
    const textParts = message.parts
      .filter(
        (part): part is TextPart =>
          part != null && part.type === 'text' && typeof part.text === 'string'
      )
      .map((part) => part.text);

    if (textParts.length > 0) {
      return textParts.join('\n');
    }
  }

  // 2. 레거시 content 필드 사용
  if (typeof message.content === 'string') {
    return message.content;
  }

  return '';
}

// ============================================================================
// 멀티모달 추출 함수
// ============================================================================

/**
 * 하이브리드 메시지에서 이미지 첨부 추출
 *
 * @param message - HybridMessage 객체
 * @returns ImageAttachment 배열
 */
export function extractImagesFromHybridMessage(
  message: HybridMessage
): ImageAttachment[] {
  if (!message.parts || !Array.isArray(message.parts)) {
    return [];
  }

  return message.parts
    .filter(
      (part): part is ImagePart =>
        part != null && part.type === 'image' && typeof part.image === 'string'
    )
    .map((part) => ({
      data: part.image,
      mimeType: part.mimeType || 'image/png',
    }));
}

/**
 * 하이브리드 메시지에서 파일 첨부 추출
 * 🎯 Fix: url/mediaType + data/mimeType 모두 지원
 * 🎯 Fix: 이미지 MIME 타입의 file 파트는 제외 (images로 승격됨)
 *
 * @param message - HybridMessage 객체
 * @returns FileAttachment 배열
 */
export function extractFilesFromHybridMessage(
  message: HybridMessage
): FileAttachment[] {
  if (!message.parts || !Array.isArray(message.parts)) {
    return [];
  }

  return message.parts
    .filter((part): part is FilePart => {
      if (part == null || part.type !== 'file') return false;

      // data 또는 url 중 하나 필요
      const fileData = part.data ?? part.url;
      if (typeof fileData !== 'string') return false;

      // mimeType 또는 mediaType 중 하나 필요
      const fileMime = part.mimeType ?? part.mediaType;
      if (typeof fileMime !== 'string') return false;

      // 이미지 MIME 타입은 제외 (images로 승격됨)
      if (fileMime.startsWith('image/')) return false;

      return true;
    })
    .map((part) => ({
      data: part.data ?? part.url!,
      mimeType: part.mimeType ?? part.mediaType!,
      name: part.name ?? part.filename,
    }));
}

/**
 * file 타입 파트에서 이미지 추출 (이미지 MIME 타입인 경우)
 * 🎯 Fix: type='file'이지만 mimeType이 image/*인 경우 이미지로 승격
 *
 * @param message - HybridMessage 객체
 * @returns ImageAttachment 배열
 */
export function extractImagesFromFileParts(
  message: HybridMessage
): ImageAttachment[] {
  if (!message.parts || !Array.isArray(message.parts)) {
    return [];
  }

  return message.parts
    .filter((part) => {
      if (part == null || part.type !== 'file') return false;

      const fileData = part.data ?? part.url;
      if (typeof fileData !== 'string') return false;

      const fileMime = part.mimeType ?? part.mediaType;
      if (typeof fileMime !== 'string') return false;

      // 이미지 MIME 타입만 선택
      return fileMime.startsWith('image/');
    })
    .map((part) => ({
      data: part.data ?? part.url!,
      mimeType: part.mimeType ?? part.mediaType ?? 'image/png',
      name: part.name ?? part.filename,
    }));
}

// ============================================================================
// 메시지 정규화 함수
// ============================================================================

/**
 * 메시지 배열을 Cloud Run 호환 형식으로 정규화 (멀티모달 지원)
 *
 * @description
 * AI SDK v6 UIMessage 형식을 Cloud Run이 기대하는 형식으로 변환
 * 이미지와 파일 첨부를 보존하여 Vision Agent에서 사용 가능
 *
 * Input (AI SDK v6):
 *   { role: 'user', parts: [
 *     { type: 'text', text: '...' },
 *     { type: 'image', image: 'base64...' }
 *   ]}
 *
 * Output (Cloud Run):
 *   { role: 'user', content: '...', images: [{ data: 'base64...', mimeType: 'image/png' }] }
 *
 * @note 빈 content는 '[Non-text content]'로 대체하여 대화 맥락 보존
 *
 * @note 다음 part 타입은 Cloud Run 전송 시 의도적으로 제거됩니다:
 *   - `tool-invocation`, `tool-result`: Cloud Run이 자체 tool 실행을 관리
 *   - `reasoning`, `step-start`, `step-finish`: UI 전용 메타데이터 (AI 응답 생성에 불필요)
 *   - `source`: RAG 소스 참조 (UI 표시용)
 *   Cloud Run에는 사용자 의도(text) + 첨부(image/file)만 전달하면 충분합니다.
 *
 * @param messages - HybridMessage 배열
 * @returns NormalizedMessage 배열 (멀티모달 포함)
 */
export function normalizeMessagesForCloudRun(
  messages: HybridMessage[]
): NormalizedMessage[] {
  return messages.map((msg) => {
    const content = extractTextFromHybridMessage(msg);

    // 🎯 Fix: type='image' 파트 + type='file' 파트 중 이미지 MIME 타입 모두 수집
    // 🎯 P0 Fix: data 기준 중복 제거 (동일 이미지가 image/file 파트 모두에 있을 수 있음)
    const imagesFromImageParts = extractImagesFromHybridMessage(msg);
    const imagesFromFileParts = extractImagesFromFileParts(msg);

    // data 필드 기준 중복 제거
    const seenData = new Set(imagesFromImageParts.map((img) => img.data));
    const uniqueFileParts = imagesFromFileParts.filter(
      (img) => !seenData.has(img.data)
    );
    const allImages = [...imagesFromImageParts, ...uniqueFileParts];

    const files = extractFilesFromHybridMessage(msg);

    // 기본 메시지 구성
    const normalizedMessage: NormalizedMessage = {
      role: msg.role,
      content: content || '[Non-text content]',
    };

    // 이미지가 있으면 추가 (image 파트 + file 파트에서 승격된 이미지)
    if (allImages.length > 0) {
      normalizedMessage.images = allImages;
    }

    // 파일이 있으면 추가 (이미지 제외)
    if (files.length > 0) {
      normalizedMessage.files = files;
    }

    return normalizedMessage;
  });
}

// ============================================================================
// AI 응답 정규화 (JSON → 텍스트)
// ============================================================================

/**
 * AI 응답이 JSON 문자열인 경우 `answer` 필드만 추출
 *
 * Cloud Run AI Engine이 `{ answer, confidence, toolsUsed }` 형태의 JSON을
 * 반환할 때, UI에 원본 JSON이 노출되는 것을 방지합니다.
 *
 * @param text - AI 응답 텍스트 (JSON 또는 일반 텍스트)
 * @returns 정규화된 텍스트
 */
export function normalizeAIResponse(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const trimmed = text.trim();

  // JSON 객체가 아닌 경우 원본 반환
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return text;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    // `answer` 필드가 있는 AI 응답 JSON → 텍스트만 추출
    if (typeof parsed.answer === 'string' && parsed.answer.length > 0) {
      return parsed.answer;
    }

    // `response` 필드가 있는 Cloud Run 응답 JSON
    if (typeof parsed.response === 'string' && parsed.response.length > 0) {
      return parsed.response;
    }

    // 인식할 수 없는 JSON 구조 → 원본 반환
    return text;
  } catch {
    // JSON 파싱 실패 → 일반 텍스트로 취급
    return text;
  }
}

/**
 * 마지막 사용자 메시지에서 쿼리 텍스트 추출
 *
 * @description 복잡도 분석, 캐시 키 생성 등에 사용
 * @param messages - HybridMessage 배열
 * @returns 마지막 사용자 쿼리 (없으면 빈 문자열)
 *
 * @note 빈 텍스트를 가진 user 메시지는 건너뜁니다 (명확화 플로우에서 발생 가능)
 */
export function extractLastUserQuery(messages: HybridMessage[]): string {
  // 역순으로 순회하여 텍스트가 있는 마지막 사용자 메시지 찾기
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message && message.role === 'user') {
      const text = extractTextFromHybridMessage(message);
      // 빈 메시지는 건너뛰고 다음 사용자 메시지 확인
      if (text && text.trim().length > 0) {
        return text;
      }
    }
  }
  return '';
}
