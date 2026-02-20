import { fn } from 'storybook/test';

export const convertThinkingStepsToUI = fn(() => []);
export const useAIChatCore = fn(() => ({
  input: '',
  setInput: fn(),
  messages: [],
  isLoading: false,
  hybridState: { progress: null, jobId: null },
  currentMode: 'stream',
  error: null,
  clearError: fn(),
  sessionState: {
    isLimitReached: false,
    currentCount: 0,
    maxCount: 20,
    isNewSession: true,
    remaining: 20,
    sessionId: 'mock-session',
  },
  handleNewSession: fn(),
  handleFeedback: fn(),
  regenerateLastResponse: fn(),
  retryLastQuery: fn(),
  stop: fn(),
  cancel: fn(),
  handleSendInput: fn(),
}));
export default useAIChatCore;
