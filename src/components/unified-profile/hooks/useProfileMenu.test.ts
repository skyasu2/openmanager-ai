/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileMenu, useProfileMenuKeyboard } from './useProfileMenu';

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('useProfileMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('외부 클릭 시 드롭다운을 닫는다', () => {
    const dropdown = document.createElement('div');
    const outside = document.createElement('button');
    document.body.append(dropdown, outside);

    const { result } = renderHook(() => useProfileMenu());

    act(() => {
      result.current.dropdownRef.current = dropdown;
      result.current.openMenu();
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.menuState.showProfileMenu).toBe(true);

    act(() => {
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(result.current.menuState.showProfileMenu).toBe(false);
  });

  it('Escape 입력 시 드롭다운을 닫는다', () => {
    const { result } = renderHook(() => useProfileMenu());

    act(() => {
      result.current.openMenu();
    });

    expect(result.current.menuState.showProfileMenu).toBe(true);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });

    expect(result.current.menuState.showProfileMenu).toBe(false);
  });
});

describe('useProfileMenuKeyboard', () => {
  it('표시 가능한 메뉴가 없으면 포커스를 유지하지 않는다', () => {
    const { result } = renderHook(() =>
      useProfileMenuKeyboard(
        [
          { id: 'hidden', visible: false },
          { id: 'disabled', visible: true, disabled: true },
        ],
        true
      )
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
      );
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
      );
    });

    expect(result.current.focusedIndex).toBe(-1);
  });
});
