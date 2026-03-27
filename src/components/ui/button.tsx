'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * Button variants using Design System v1.0.0 tokens
 *
 * 디자인 시스템 토큰 활용:
 * - Border Radius: var(--radius-lg)
 * - Shadow: var(--shadow-sm), var(--shadow-md)
 * - Transition: var(--duration-150)
 * - Color: var(--color-primary-500), var(--color-error-500), etc.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Primary: 브랜드 그라데이션 (Stage 1 통일)
        default:
          'bg-linear-to-r from-purple-500 via-pink-500 to-cyan-500 text-white shadow-xs hover:opacity-90 focus-visible:ring-purple-400',
        // Destructive: 에러 색상
        destructive:
          'bg-(--color-error-500) text-white shadow-xs hover:opacity-90 focus-visible:ring-red-400',
        // Outline: 테두리만
        outline:
          'border border-neutral-300 bg-white hover:bg-gray-50 focus-visible:ring-gray-400',
        // Secondary: 서피스 색상
        secondary:
          'bg-(--color-surface-100) text-gray-700 border border-neutral-300 shadow-xs hover:bg-(--color-surface-200) focus-visible:ring-gray-400',
        // Ghost: 투명
        ghost: 'hover:bg-gray-100 focus-visible:ring-gray-400',
        // Link: 링크 스타일
        link: 'text-primary-500 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 text-sm',
        sm: 'h-8 px-3 py-1.5 text-xs',
        lg: 'h-10 px-6 py-3 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** 로딩 상태 */
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    // 디자인 시스템 토큰 활용 (인라인 스타일)
    const designSystemStyle: React.CSSProperties = {
      borderRadius: 'var(--radius-lg)',
      transitionDuration: 'var(--duration-150)',
      ...style,
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        style={designSystemStyle}
        {...props}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
