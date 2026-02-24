/**
 * Orchestrator Types, Configuration, and Pre-filter Logic
 *
 * @version 4.0.0
 */

import type { ImageAttachment, FileAttachment } from './base-agent';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';

// ============================================================================
// Configuration
// ============================================================================

export const ORCHESTRATOR_CONFIG = {
  /** Maximum execution time (ms) - from TIMEOUT_CONFIG.orchestrator */
  timeout: TIMEOUT_CONFIG.orchestrator.hard,
  /** Hard timeout (ms) - same as timeout for consistency */
  hardTimeout: TIMEOUT_CONFIG.orchestrator.hard,
  /** Warning threshold (ms) - from TIMEOUT_CONFIG.orchestrator */
  warnThreshold: TIMEOUT_CONFIG.orchestrator.warning,
};

// ============================================================================
// Types
// ============================================================================

export interface MultiAgentRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  enableTracing?: boolean;
  /**
   * Web search control:
   * - true: Force enable web search tools
   * - false: Disable web search tools
   * - undefined/'auto': Auto-detect based on query content
   */
  enableWebSearch?: boolean | 'auto';
  /**
   * Image attachments for multimodal queries (Vision Agent)
   * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#image-parts
   */
  images?: ImageAttachment[];
  /**
   * File attachments for multimodal queries (PDF, audio, etc.)
   * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#file-parts
   */
  files?: FileAttachment[];
}

export interface MultiAgentResponse {
  success: boolean;
  response: string;
  handoffs: Array<{
    from: string;
    to: string;
    reason?: string;
  }>;
  finalAgent: string;
  toolsCalled: string[];
  ragSources?: Array<{
    title: string;
    similarity: number;
    sourceType: string;
    category?: string;
    url?: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    provider: string;
    modelId: string;
    totalRounds: number;
    durationMs: number;
    responseChars?: number;
    formatCompliance?: boolean;
    qualityFlags?: string[];
    latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
    /** Quality score from Reporter Pipeline (optional, 0-1) */
    qualityScore?: number;
  };
}

export interface MultiAgentError {
  success: false;
  error: string;
  code: string;
}

// ============================================================================
// Pre-filter Types and Patterns
// ============================================================================

export interface PreFilterResult {
  shouldHandoff: boolean;
  directResponse?: string;
  suggestedAgent?: string;
  confidence: number;
}

/**
 * 라우팅 프롬프트 생성 (에이전트 선택용)
 */
export function buildRoutingPrompt(query: string): string {
  return `사용자 질문을 분석하고 적절한 에이전트를 선택하세요.

## 사용 가능한 에이전트
- NLQ Agent: 서버 상태 조회, CPU/메모리/디스크 메트릭, 필터링, 요약
- Analyst Agent: 이상 탐지, 트렌드 예측, 패턴 분석, 근본 원인 분석
- Reporter Agent: 장애 보고서 생성, 인시던트 타임라인
- Advisor Agent: 문제 해결 방법, CLI 명령어 추천, 과거 사례 검색
- Vision Agent: 스크린샷/이미지 분석, 대용량 로그, 최신 공식 문서 검색

## 사용자 질문
${query}

## 판단 기준
- 서버/모니터링 관련 질문 → 적절한 에이전트 선택
- 이미지/스크린샷/대시보드 분석 → Vision Agent
- 일반 대화(인사, 날씨, 시간 등) → NONE`;
}

export const ORCHESTRATOR_INSTRUCTIONS = `당신은 **서버 모니터링 플랫폼 (OpenManager)** 의 AI 오케스트레이터입니다.

## ⚠️ 중요 컨텍스트
- 이 시스템은 **IT 인프라/서버 모니터링** 전용입니다
- "장애"는 **서버 장애/시스템 장애**를 의미합니다 (역사적 재앙/질병 아님)
- "사례"는 **과거 서버 인시던트 기록**을 의미합니다
  - 예: "2024-01 DB 서버 OOM 장애", "CPU 스파이크로 인한 서비스 다운타임"
  - Knowledge Base에 저장된 트러블슈팅 이력 참조
- 모든 질문은 서버/인프라 관점에서 해석하세요

## 핵심 역할 (듀얼 모드)
1. **일반 질문**: 직접 빠르게 답변
2. **서버/모니터링 관련**: 전문 에이전트에게 핸드오프

## 1단계: 질문 분류

### 직접 답변 (핸드오프 없이 바로 응답)
다음 유형의 질문은 **직접 답변**하세요:
- 인사말: "안녕", "하이", "헬로", "반가워"
- 날씨: "오늘 날씨", "날씨 어때"
- 날짜/시간: "오늘 몇일", "지금 몇시", "오늘 요일"
- 일반 대화: "고마워", "잘가", "수고해"
- 시스템 소개: "넌 뭐야", "뭘 할 수 있어", "도움말"

**직접 답변 예시**:
- "안녕" → "안녕하세요! 서버 모니터링 AI입니다. 서버 상태, 이상 탐지, 장애 분석 등을 도와드립니다."
- "오늘 몇일이야" → "오늘은 [날짜]입니다."
- "넌 뭐야" → "저는 OpenManager 서버 모니터링 AI입니다. 서버 상태 조회, 이상 탐지, 장애 보고서 생성 등을 지원합니다."

### 핸드오프 대상 (전문 에이전트 위임)
다음 키워드가 포함된 **서버/모니터링 관련** 질문만 핸드오프:

#### NLQ Agent - 서버 데이터 질의
**키워드**: 서버, 상태, CPU, 메모리, 디스크, 목록, 조회, 몇 대, 어떤 서버, 평균, 최대, 최소, 지난, 시간
- "서버 상태 알려줘" → NLQ Agent
- "CPU 높은 서버" → NLQ Agent
- "지난 6시간 CPU 평균" → NLQ Agent (시간 범위 집계)
- "전체 서버 메모리 최대값" → NLQ Agent

#### Analyst Agent - 이상 탐지/분석
**키워드**: 이상, 분석, 예측, 트렌드, 패턴, 원인, 왜 (서버/시스템 관련)
- "이상 있어?" → Analyst Agent
- "왜 느려졌어?" → Analyst Agent

#### Reporter Agent - 보고서 생성
**키워드**: 보고서, 리포트, 타임라인, 장애 요약, 인시던트
- "장애 보고서 만들어줘" → Reporter Agent

#### Advisor Agent - 해결 방법 안내
**키워드**: 해결, 방법, 명령어, 가이드, 과거 사례 (서버 관련)
- "메모리 부족 해결 방법" → Advisor Agent

## 2단계: 판단 기준

**핸드오프 여부 결정 플로우**:
1. 서버/CPU/메모리/디스크/장애/모니터링 키워드가 있는가?
   - 없음 → 직접 답변
   - 있음 → 2번으로
2. 어떤 전문 에이전트가 적합한가?
   - 데이터 조회/요약 → NLQ Agent (요약 포함)
   - 이상/분석 → Analyst Agent
   - 보고서 → Reporter Agent
   - 해결법 → Advisor Agent

## 중요 규칙
1. **일반 대화는 빠르게 직접 답변** (핸드오프 금지)
2. **서버 관련 질문만 핸드오프**
3. 불명확하지만 서버 관련인 것 같으면 → NLQ Agent
4. 핸드오프 시 reason 명시
5. **한국어로 응답 / Respond in Korean** (한자 절대 금지 / No Chinese characters, 러시아어/독일어/일본어/베트남어 등 다른 언어 금지, 기술용어는 영어 허용)
`;
