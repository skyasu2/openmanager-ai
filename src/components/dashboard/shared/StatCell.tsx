import { cn } from '@/lib/utils';

export interface StatCellProps {
  label: string;
  value: number | string;
  color: string;
  className?: string;
  active?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
  testId?: string;
}

export function StatCell({
  label,
  value,
  color,
  className,
  active,
  ariaLabel,
  onClick,
  testId,
}: StatCellProps) {
  const content = (
    <>
      <div className={cn('text-base font-bold sm:text-lg', color)}>{value}</div>
      <div className="text-[10px] font-medium text-gray-400 uppercase">
        {label}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={ariaLabel ?? `${label} 로그 필터`}
        aria-pressed={active}
        data-testid={testId}
        onClick={onClick}
        className={cn(
          'min-h-11 rounded-md px-2 py-1 text-center transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          active && 'bg-white ring-1 ring-blue-200',
          className
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div data-testid={testId} className={cn('text-center', className)}>
      {content}
    </div>
  );
}
