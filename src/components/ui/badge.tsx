import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-150 focus:outline-hidden focus:ring-2 focus:ring-offset-2',
  {
    variants: {
      variant: {
        // Primary: 브랜드 색상
        default:
          'border-transparent bg-linear-to-r from-purple-500 via-pink-500 to-cyan-500 text-white hover:opacity-90 focus:ring-purple-400',
        // Success: 성공 상태
        success:
          'border-transparent bg-green-500 text-white hover:opacity-90 focus:ring-green-400',
        // Warning: 경고 상태
        warning:
          'border-transparent bg-amber-500 text-white hover:opacity-90 focus:ring-amber-400',
        // Error: 에러 상태
        destructive:
          'border-transparent bg-red-500 text-white hover:opacity-90 focus:ring-red-400',
        // Info: 정보 상태
        info: 'border-transparent bg-blue-500 text-white hover:opacity-90 focus:ring-blue-400',
        // Secondary: 서피스 색상
        secondary:
          'border-transparent bg-stone-100 text-gray-700 hover:bg-stone-200 focus:ring-gray-400',
        // Outline: 테두리만
        outline:
          'border-neutral-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, style, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={style}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
