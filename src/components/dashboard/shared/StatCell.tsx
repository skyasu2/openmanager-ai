import { cn } from '@/lib/utils';

export interface StatCellProps {
  label: string;
  value: number | string;
  color: string;
  className?: string;
}

export function StatCell({ label, value, color, className }: StatCellProps) {
  return (
    <div className={cn('text-center', className)}>
      <div className={cn('text-base font-bold sm:text-lg', color)}>{value}</div>
      <div className="text-[10px] font-medium text-gray-400 uppercase">
        {label}
      </div>
    </div>
  );
}
