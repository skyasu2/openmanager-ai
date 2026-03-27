/**
 * Analysis Components - Shared Constants
 */

import { Cpu, HardDrive, MemoryStick } from 'lucide-react';

// 메트릭 아이콘 매핑
export const metricIcons: Record<string, React.ReactNode> = {
  cpu: <Cpu className="h-5 w-5" />,
  memory: <MemoryStick className="h-5 w-5" />,
  disk: <HardDrive className="h-5 w-5" />,
};

// 메트릭 라벨 한글화
export const metricLabels: Record<string, string> = {
  cpu: 'CPU',
  memory: '메모리',
  disk: '디스크',
};

// 심각도별 색상
export const severityColors: Record<string, string> = {
  low: 'text-green-600 bg-green-50 border-green-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  high: 'text-red-600 bg-red-50 border-red-200',
};

// 상태별 색상
export const statusColors: Record<string, string> = {
  online: 'text-green-600 bg-green-50 border-green-200',
  warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  critical: 'text-red-600 bg-red-50 border-red-200',
};

// 상태 라벨
export const statusLabel: Record<string, string> = {
  online: '정상',
  warning: '주의',
  critical: '위험',
};
