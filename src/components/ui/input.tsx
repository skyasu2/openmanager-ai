import { type ComponentProps, forwardRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * Input 컴포넌트 - Design System v1.0.0
 *
 * 디자인 시스템 토큰 활용:
 * - Border Radius: var(--radius-md)
 * - Transition: var(--duration-150)
 * - Color: var(--color-neutral-300), var(--color-primary-500)
 * - Typography: text-body (16px)
 */
const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        aria-label="입력"
        type={type}
        className={cn(
          'flex h-9 w-full border bg-white px-3 py-1 text-base hover:border-gray-400 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        style={{
          borderRadius: 'var(--radius-md)',
          borderColor: 'var(--color-neutral-300)',
          transitionDuration: 'var(--duration-150)',
          transitionProperty: 'border-color, box-shadow',
          ...style,
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
