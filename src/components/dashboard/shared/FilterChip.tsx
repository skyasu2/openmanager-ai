import { cn } from '@/lib/utils';

export type FilterVariant =
  | 'all'
  | 'info'
  | 'warn'
  | 'error'
  | 'warning'
  | 'critical'
  | 'firing'
  | 'resolved'
  | 'time';

export interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: FilterVariant;
}

const activeColors: Record<FilterVariant, string> = {
  all: 'border-blue-500 bg-blue-500 text-white',
  info: 'border-green-500 bg-green-500 text-white',
  warn: 'border-yellow-500 bg-yellow-500 text-white',
  warning: 'border-amber-500 bg-amber-500 text-white',
  error: 'border-red-500 bg-red-500 text-white',
  critical: 'border-red-600 bg-red-600 text-white',
  firing: 'border-red-500 bg-red-500 text-white',
  resolved: 'border-green-500 bg-green-500 text-white',
  time: 'border-indigo-500 bg-indigo-500 text-white',
};

export function FilterChip({
  label,
  active,
  onClick,
  variant = 'all',
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors sm:py-0.5',
        active
          ? (activeColors[variant] ?? activeColors.all)
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
      )}
    >
      {label}
    </button>
  );
}
