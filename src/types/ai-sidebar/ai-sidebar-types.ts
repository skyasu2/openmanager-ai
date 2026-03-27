/**
 * AI Sidebar 타입 정의
 * 모든 AI 사이드바 관련 타입 통합 관리
 */

import type { ComponentType, RefObject } from 'react';
import type { AIMode } from '@/types/ai-types';

/**
 * 사고 과정 단계
 */
export interface ThinkingStep {
  id: string;
  title?: string;
  description?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  duration?: number;
  step?: string;
  content?: string;
  // AI 사고 과정의 모든 type 값들을 지원하도록 확장
  type?:
    | 'analysis'
    | 'data_processing'
    | 'pattern_matching'
    | 'reasoning'
    | 'response_generation'
    | 'analyzing'
    | 'processing'
    | 'generating'
    | 'completed'
    | 'error';
  timestamp?: string | Date;
  progress?: number;
  confidence?: number;
  subSteps?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * AI 사고 과정 단계 (ThinkingStep 별칭)
 */
export type AIThinkingStep = ThinkingStep;

/**
 * 시스템 알림
 */
export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  isClosable?: boolean;
  autoClose?: boolean | number;
}

/**
 * AI 쿼리 응답 (UI 표시용)
 */
export interface AIQueryResponse {
  id?: string;
  query?: string;
  content: string;
  response?: string; // 실제 AI 응답 내용
  engine: string;
  processingTime: number;
  confidence?: number;
  timestamp?: Date;
  thinkingSteps?: AIThinkingStep[];
  source?: 'supabase-rag' | 'local';
  metadata?: {
    sources?: string[];
    suggestions?: string[];
    relatedQuestions?: string[];
    thinkingSteps?: AIThinkingStep[];
  };
}

/**
 * 세션 정보
 */
export interface SessionInfo {
  id: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  engines: string[];
}

/**
 * AI 사이드바 상태
 */
export interface AISidebarState {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  selectedEngine?: AIMode;
  sessionId: string;
  messages: ChatMessage[];
}

/**
 * 채팅 메시지
 */
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'thinking';
  timestamp: Date;
  engine?: string;
  isTyping?: boolean;
  typingSpeed?: 'slow' | 'normal' | 'fast' | number; // 문자열 또는 숫자로 확장
  thinking?: ThinkingStep[]; // AI 사고 과정 단계들
  thinkingSteps?: ThinkingStep[]; // thinking의 별칭 (AISidebarV3 호환)
  isStreaming?: boolean; // 스트리밍 상태 (AISidebarV3 호환)
  confidence?: number; // AI 응답 신뢰도 (0-1 범위)
  metadata?: {
    processingTime?: number;
    confidence?: number;
    error?: string;
  };
}

/**
 * 자동 보고서 트리거
 */
export interface AutoReportTrigger {
  type: 'critical' | 'performance' | 'security';
  message: string;
  data?: Record<string, unknown>;
  shouldGenerate?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  lastQuery?: string;
}

/**
 * AI 엔진 정보
 */
export interface AIEngineInfo {
  id: string;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  features: string[];
  status: 'ready' | 'loading' | 'error' | 'unavailable';
  usage?: {
    used: number;
    limit: number;
  };
}

/**
 * AI 사이드바 Props
 */
export interface AISidebarProps {
  className?: string;
  defaultEngine?: AIMode;
  sessionId?: string;
  onClose?: () => void;
  onEngineChange?: (engine: AIMode) => void;
  onMessageSend?: (message: string) => void;
}

/**
 * AI 사이드바 핸들러
 */
export interface AISidebarHandlers {
  handleSendMessage: (message: string) => Promise<void>;
  handleEngineChange: (engine: AIMode) => Promise<void>;
  handleClearChat: () => void;
  handleExportChat: () => void;
}

/**
 * AI 사이드바 상태 훅 반환값
 */
export interface UseAISidebarReturn {
  state: AISidebarState;
  handlers: AISidebarHandlers;
  refs: {
    messagesEndRef: RefObject<HTMLDivElement | null>;
    inputRef: RefObject<HTMLTextAreaElement>;
  };
}

/**
 * AI 사이드바 V2 Props
 */
export interface AISidebarV2Props {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * AI 사이드바 V3 Props (확장된 기능)
 */
export interface AISidebarV3Props extends AISidebarV2Props {
  defaultEngine?: AIMode;
  sessionId?: string;
  onEngineChange?: (engine: AIMode) => void;
  onMessageSend?: (message: string) => void;
}
