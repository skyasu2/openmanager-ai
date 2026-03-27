import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Card 컴포넌트 - Design System v1.0.0
 *
 * 디자인 시스템 토큰 활용:
 * - Border Radius: var(--radius-lg)
 * - Shadow: var(--shadow-sm)
 * - Spacing: var(--spacing-6)
 * - Typography: text-heading-2 (CardTitle)
 * - Color: var(--color-surface-50), var(--color-neutral-200)
 */
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'border bg-white text-gray-900 transition-shadow duration-200 hover:shadow-md',
        className
      )}
      style={{
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        borderColor: 'var(--color-neutral-200)',
        ...style,
      }}
      {...props}
    />
  )
);
Card.displayName = 'Card';

/**
 * CardHeader - Card 헤더 영역
 */
const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5', className)}
      style={{
        padding: 'var(--spacing-6)',
        ...style,
      }}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

/**
 * CardTitle - Card 제목 (Typography System 활용)
 */
const CardTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-heading-2', className)} {...props}>
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

/**
 * CardDescription - Card 설명 (Typography System 활용)
 */
const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-body-small', className)}
    style={{ color: 'var(--color-neutral-600)' }}
    {...props}
  >
    {children}
  </p>
));
CardDescription.displayName = 'CardDescription';

/**
 * CardContent - Card 본문 영역
 */
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('pt-0', className)}
      style={{
        padding: 'var(--spacing-6)',
        paddingTop: 0,
        ...style,
      }}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

/**
 * CardFooter - Card 푸터 영역
 */
const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-0', className)}
      style={{
        padding: 'var(--spacing-6)',
        paddingTop: 0,
        ...style,
      }}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
