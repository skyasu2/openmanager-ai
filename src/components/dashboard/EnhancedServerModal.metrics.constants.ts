export type ViewMode = 'simple' | 'advanced';
export type MetricType = 'cpu' | 'memory' | 'disk' | 'network';
export type TimeRangeType = '1h' | '6h' | '24h' | '7d';

export const METRIC_TYPES: MetricType[] = ['cpu', 'memory', 'disk', 'network'];

export const TIME_RANGE_OPTIONS: { value: TimeRangeType; label: string }[] = [
  { value: '1h', label: '1시간' },
  { value: '6h', label: '6시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
];
