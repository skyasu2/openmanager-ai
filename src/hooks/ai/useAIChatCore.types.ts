import type {
  AgentStatusEventData,
  AIStreamStatus,
  ClarificationOption,
  ClarificationRequest,
  HandoffEventData,
} from '@/hooks/ai/useHybridAIQuery';
import type { DeveloperPanelData } from '@/lib/ai/developer-panel';
import type { AIErrorDetails } from '@/lib/ai/error-details';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { SessionState } from '@/types/session';
import type { GuidanceCtaTarget } from './core/chat-artifact-metadata';
import type { FileAttachment } from './useFileAttachments';

export interface UseAIChatCoreOptions {
  /** 세션 ID (외부에서 전달 시 사용) */
  sessionId?: string;
  /** 메시지 전송 콜백 */
  onMessageSend?: (message: string) => void;
  /** 세션 제한 비활성화 (전체화면에서 필요시) */
  disableSessionLimit?: boolean;
  /** Dashboard snapshot data slot used to keep sidebar AI answers aligned. */
  queryAsOfDataSlot?: JobDataSlot;
}

export interface UseAIChatCoreReturn {
  // 입력 상태
  input: string;
  setInput: (value: string) => void;

  // 메시지
  messages: EnhancedChatMessage[];
  sendQuery: (query: string) => void;

  // 로딩/진행 상태
  isLoading: boolean;
  hybridState: {
    progress?: { progress: number; stage: string; message?: string };
    jobId?: string;
    error?: string | null;
    errorDetails?: AIErrorDetails | null;
  };
  currentMode?: 'streaming' | 'job-queue';
  streamStatus?: AIStreamStatus;

  // 에러 상태
  error: string | null;
  clearError: () => void;

  // 세션 관리
  sessionId: string;
  sessionState: SessionState;
  handleNewSession: () => void;

  // 액션
  regenerateLastResponse: () => void;
  canRegenerateLastResponse: boolean;
  regenerateCooldownSeconds: number;
  /** 마지막 쿼리 재시도 (파일 첨부 포함) */
  retryLastQuery: () => void;
  stop: () => void;
  cancel: () => void;

  // 입력 처리 (파일 첨부 지원)
  handleSendInput: (
    attachments?: FileAttachment[],
    overrideText?: string
  ) => void;
  handleArtifactGuidanceCta: (target: GuidanceCtaTarget) => void;
  // 명확화 기능
  clarification: ClarificationRequest | null;
  selectClarification: (option: ClarificationOption) => void;
  submitCustomClarification: (customInput: string) => void;
  skipClarification: () => void;
  /** 명확화 취소 (쿼리 미실행, 상태 정리만) */
  dismissClarification: () => void;

  // 대기열 큐 상태
  queuedQueries: Array<{
    id: number;
    text: string;
    attachments?: FileAttachment[];
  }>;
  removeQueuedQuery: (index: number) => void;

  // 🎯 실시간 Agent 상태 (스트리밍 중 표시)
  currentAgentStatus: AgentStatusEventData | null;
  currentHandoff: HandoffEventData | null;
  developerPanelData: DeveloperPanelData | null;

  /** Cloud Run AI Engine 웜업 중 여부 */
  warmingUp: boolean;
  /** 웜업 예상 대기 시간 (초) */
  estimatedWaitSeconds: number;
}
