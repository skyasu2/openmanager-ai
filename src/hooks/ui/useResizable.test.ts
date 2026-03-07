/**
 * useResizable Unit Tests
 *
 * 드래그 리사이즈 훅: 너비 클램핑, 콜백, 비활성화 검증.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useResizable } from './useResizable';

describe('useResizable', () => {
  describe('initial state', () => {
    it('should initialize with given width', () => {
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600 })
      );
      expect(result.current.width).toBe(600);
      expect(result.current.isResizing).toBe(false);
    });
  });

  describe('setWidth', () => {
    it('should update width within bounds', () => {
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600, minWidth: 400, maxWidth: 900 })
      );

      act(() => result.current.setWidth(700));
      expect(result.current.width).toBe(700);
    });

    it('should clamp width to minWidth', () => {
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600, minWidth: 400, maxWidth: 900 })
      );

      act(() => result.current.setWidth(200));
      expect(result.current.width).toBe(400);
    });

    it('should clamp width to maxWidth', () => {
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600, minWidth: 400, maxWidth: 900 })
      );

      act(() => result.current.setWidth(1200));
      expect(result.current.width).toBe(900);
    });

    it('should call onWidthChange callback', () => {
      const onWidthChange = vi.fn();
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600, onWidthChange })
      );

      act(() => result.current.setWidth(700));
      expect(onWidthChange).toHaveBeenCalledWith(700);
    });
  });

  describe('mouse drag', () => {
    it('should set isResizing on mouse down', () => {
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600 })
      );

      act(() => {
        result.current.handleMouseDown({
          clientX: 500,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      expect(result.current.isResizing).toBe(true);
    });

    it('should not start resizing when disabled', () => {
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600, disabled: true })
      );

      act(() => {
        result.current.handleMouseDown({
          clientX: 500,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      expect(result.current.isResizing).toBe(false);
    });

    it('should update width on mousemove and reset on mouseup', () => {
      const onResizeEnd = vi.fn();
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600, minWidth: 400, maxWidth: 900, onResizeEnd })
      );

      // Start drag at x=500
      act(() => {
        result.current.handleMouseDown({
          clientX: 500,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Drag left by 100px (increases width for right sidebar)
      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400 }));
      });
      expect(result.current.width).toBe(700);

      // Release
      act(() => {
        document.dispatchEvent(new MouseEvent('mouseup'));
      });
      expect(result.current.isResizing).toBe(false);
      expect(onResizeEnd).toHaveBeenCalledWith(700);
    });
  });

  describe('touch drag', () => {
    it('should set isResizing on touch start', () => {
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600 })
      );

      act(() => {
        result.current.handleTouchStart({
          touches: [{ clientX: 500 }],
        } as unknown as React.TouchEvent);
      });

      expect(result.current.isResizing).toBe(true);
    });

    it('should not start on touch when disabled', () => {
      const { result } = renderHook(() =>
        useResizable({ initialWidth: 600, disabled: true })
      );

      act(() => {
        result.current.handleTouchStart({
          touches: [{ clientX: 500 }],
        } as unknown as React.TouchEvent);
      });

      expect(result.current.isResizing).toBe(false);
    });
  });

  describe('initialWidth sync', () => {
    it('should sync when initialWidth changes', () => {
      const { result, rerender } = renderHook(
        ({ w }) => useResizable({ initialWidth: w }),
        { initialProps: { w: 600 } }
      );
      expect(result.current.width).toBe(600);

      rerender({ w: 800 });
      expect(result.current.width).toBe(800);
    });
  });
});
