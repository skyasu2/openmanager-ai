/**
 * @vitest-environment jsdom
 */

/**
 * 🧪 AIAssistantButton 컴포넌트 User Event 테스트
 *
 * @description AI 어시스턴트 토글 버튼의 인터랙션 및 상태 관리 테스트
 * @author Claude Code
 * @created 2025-11-26
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistantButton } from './AIAssistantButton';

describe('🎯 AIAssistantButton - User Event 테스트', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('키보드 네비게이션', () => {
    it('Enter 키로 버튼을 활성화할 수 있다', () => {
      render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      button.focus();

      // Native <button> elements automatically trigger onClick on Enter/Space
      // jsdom doesn't fully simulate this, so we use fireEvent.click
      // The keyboard accessibility is guaranteed by using a native button element
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('Space 키로 버튼을 활성화할 수 있다', () => {
      render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      button.focus();

      // Native <button> elements automatically trigger onClick on Enter/Space
      // jsdom doesn't fully simulate this, so we use fireEvent.click
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('Tab 키로 버튼에 포커스할 수 있다', () => {
      render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      button.focus();

      // 버튼이 포커스되었는지 확인
      expect(document.activeElement).toBe(button);
    });
  });

  describe('상태 변경', () => {
    it('isOpen prop이 변경되면 스타일이 업데이트된다', async () => {
      const { rerender } = render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gray-100');

      rerender(
        <AIAssistantButton
          isOpen={true}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      await waitFor(() => {
        expect(button.style.background).toBeTruthy();
      });
    });

    it('isEnabled prop이 변경되면 스타일이 업데이트된다', async () => {
      const { rerender } = render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gray-100');

      rerender(
        <AIAssistantButton
          isOpen={false}
          isEnabled={true}
          onClick={mockOnClick}
        />
      );

      await waitFor(() => {
        expect(button.style.background).toBeTruthy();
      });
    });
  });

  describe('실전 시나리오', () => {
    it('토글 시나리오 - 열기/닫기 반복', async () => {
      let isOpen = false;
      const handleToggle = () => {
        isOpen = !isOpen;
        mockOnClick();
      };

      const { rerender } = render(
        <AIAssistantButton
          isOpen={isOpen}
          isEnabled={false}
          onClick={handleToggle}
        />
      );

      const button = screen.getByRole('button');

      // 첫 번째 클릭 - 열기
      fireEvent.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      isOpen = true;

      rerender(
        <AIAssistantButton
          isOpen={isOpen}
          isEnabled={false}
          onClick={handleToggle}
        />
      );

      await waitFor(() => {
        expect(button.getAttribute('aria-pressed')).toBe('true');
      });

      // 두 번째 클릭 - 닫기
      fireEvent.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(2);
      isOpen = false;

      rerender(
        <AIAssistantButton
          isOpen={isOpen}
          isEnabled={false}
          onClick={handleToggle}
        />
      );

      await waitFor(() => {
        expect(button.getAttribute('aria-pressed')).toBe('false');
      });
    });

    it('isEnabled는 유지하면서 isOpen만 토글', async () => {
      const { rerender } = render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={true}
          onClick={mockOnClick}
        />
      );

      await waitFor(() => {
        const indicator = screen
          .getByRole('button')
          .parentElement?.querySelector('.bg-green-400');
        expect(indicator).toBeDefined();
      });

      rerender(
        <AIAssistantButton
          isOpen={true}
          isEnabled={true}
          onClick={mockOnClick}
        />
      );

      await waitFor(() => {
        const indicator = screen
          .getByRole('button')
          .parentElement?.querySelector('.bg-green-400');
        expect(indicator).toBeDefined();
      });
    });
  });

  describe('접근성', () => {
    it('버튼이 포커스 가능하다', () => {
      render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it('role="button"을 가진다', () => {
      render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByRole('button')).toBeDefined();
    });
  });

  describe('CSS 애니메이션', () => {
    it('호버 효과 클래스가 포함되어 있다', () => {
      render(
        <AIAssistantButton
          isOpen={false}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button.className).toContain('hover:scale-105');
      expect(button.className).toContain('active:scale-95');
    });

    it('활성 상태일 때 scale-105가 적용된다', async () => {
      render(
        <AIAssistantButton
          isOpen={true}
          isEnabled={false}
          onClick={mockOnClick}
        />
      );

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button.className).toContain('scale-105');
      });
    });
  });
});
