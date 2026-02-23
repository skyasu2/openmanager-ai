/**
 * @vitest-environment jsdom
 *
 * useAISidebarStore Unit Tests
 *
 * @description AI 사이드바 상태 관리 스토어 테스트 (핵심 액션)
 * @created 2026-01-22
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { EnhancedChatMessage } from './useAISidebarStore';
import { useAISidebarStore } from './useAISidebarStore';

describe('useAISidebarStore', () => {
  // 각 테스트 전 스토어 상태 초기화
  beforeEach(() => {
    const { result } = renderHook(() => useAISidebarStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('초기 상태', () => {
    it('isOpen이 false여야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      expect(result.current.isOpen).toBe(false);
    });

    it('isMinimized가 false여야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      expect(result.current.isMinimized).toBe(false);
    });

    it('messages가 빈 배열이어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      expect(result.current.messages).toEqual([]);
    });

    it('activeTab이 chat이어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      expect(result.current.activeTab).toBe('chat');
    });

    it('sidebarWidth가 600이어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      expect(result.current.sidebarWidth).toBe(600);
    });

    it('sessionId가 존재해야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      expect(result.current.sessionId).toBeTruthy();
    });
  });

  describe('사이드바 열기/닫기', () => {
    it('setOpen으로 사이드바를 열 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.setOpen(true);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('setOpen으로 사이드바를 닫을 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.setOpen(true);
      });

      act(() => {
        result.current.setOpen(false);
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('toggleSidebar로 토글할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('사이드바를 열면 isMinimized가 false로 리셋되어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      // 먼저 최소화 상태로 설정
      act(() => {
        result.current.setMinimized(true);
      });
      expect(result.current.isMinimized).toBe(true);

      // 사이드바를 열면 최소화 해제
      act(() => {
        result.current.setOpen(true);
      });

      expect(result.current.isMinimized).toBe(false);
    });
  });

  describe('최소화', () => {
    it('setMinimized로 최소화할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.setMinimized(true);
      });

      expect(result.current.isMinimized).toBe(true);
    });

    it('setMinimized로 최소화를 해제할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.setMinimized(true);
      });

      act(() => {
        result.current.setMinimized(false);
      });

      expect(result.current.isMinimized).toBe(false);
    });
  });

  describe('메시지 관리', () => {
    const createMockMessage = (
      id: string,
      content: string
    ): EnhancedChatMessage => ({
      id,
      content,
      role: 'user',
      timestamp: new Date(),
    });

    it('addMessage로 메시지를 추가할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      const message = createMockMessage('msg-1', 'Hello');

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello');
    });

    it('여러 메시지를 추가할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.addMessage(createMockMessage('msg-1', 'First'));
        result.current.addMessage(createMockMessage('msg-2', 'Second'));
        result.current.addMessage(createMockMessage('msg-3', 'Third'));
      });

      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[0].content).toBe('First');
      expect(result.current.messages[2].content).toBe('Third');
    });

    it('최대 50개 메시지만 유지해야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      // 55개 메시지 추가
      act(() => {
        for (let i = 0; i < 55; i++) {
          result.current.addMessage(createMockMessage(`msg-${i}`, `Msg ${i}`));
        }
      });

      // 최대 50개만 유지 (SESSION_LIMITS.MESSAGE_LIMIT: 50)
      expect(result.current.messages).toHaveLength(50);
      // 오래된 메시지가 삭제됨 (msg-0 ~ msg-4 삭제)
      expect(result.current.messages[0].id).toBe('msg-5');
    });

    it('updateMessage로 메시지를 업데이트할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      const message = createMockMessage('msg-1', 'Original');

      act(() => {
        result.current.addMessage(message);
      });

      act(() => {
        result.current.updateMessage('msg-1', { content: 'Updated' });
      });

      expect(result.current.messages[0].content).toBe('Updated');
    });

    it('존재하지 않는 메시지 업데이트는 무시되어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());
      const message = createMockMessage('msg-1', 'Original');

      act(() => {
        result.current.addMessage(message);
      });

      act(() => {
        result.current.updateMessage('non-existent', { content: 'Updated' });
      });

      expect(result.current.messages[0].content).toBe('Original');
    });

    it('clearMessages로 모든 메시지를 삭제할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.addMessage(createMockMessage('msg-1', 'First'));
        result.current.addMessage(createMockMessage('msg-2', 'Second'));
      });

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('탭 관리', () => {
    it('setActiveTab으로 활성 탭을 변경할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.setActiveTab('presets');
      });

      expect(result.current.activeTab).toBe('presets');
    });

    it('setFunctionTab으로 함수 탭을 변경할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.setFunctionTab('report');
      });

      expect(result.current.functionTab).toBe('report');
    });

    it('setSelectedContext로 컨텍스트를 변경할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.setSelectedContext('advanced');
      });

      expect(result.current.selectedContext).toBe('advanced');
    });
  });

  describe('사이드바 너비', () => {
    it('setSidebarWidth로 너비를 변경할 수 있어야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      act(() => {
        result.current.setSidebarWidth(800);
      });

      expect(result.current.sidebarWidth).toBe(800);
    });
  });

  describe('reset', () => {
    it('모든 상태를 초기화해야 함', () => {
      const { result } = renderHook(() => useAISidebarStore());

      // 상태 변경
      act(() => {
        result.current.setOpen(true);
        result.current.setMinimized(true);
        result.current.setActiveTab('settings');
        result.current.addMessage({
          id: 'msg-1',
          content: 'Test',
          role: 'user',
          timestamp: new Date(),
        });
      });

      // 리셋
      act(() => {
        result.current.reset();
      });

      // 초기 상태 확인
      expect(result.current.isOpen).toBe(false);
      expect(result.current.isMinimized).toBe(false);
      expect(result.current.activeTab).toBe('chat');
      expect(result.current.messages).toHaveLength(0);
    });
  });
});
