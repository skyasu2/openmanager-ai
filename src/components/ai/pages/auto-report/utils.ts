/**
 * Auto Report Page Utilities
 *
 * 헬퍼 함수 및 유틸리티
 */

import { AlertTriangle, CheckCircle } from 'lucide-react';
import { createElement } from 'react';
import type { IncidentSeverity, IncidentStatus } from './types';

/**
 * 심각도에 따른 아이콘 반환
 */
export function getSeverityIcon(severity: IncidentSeverity) {
  switch (severity) {
    case 'critical':
      return createElement(AlertTriangle, {
        className: 'h-4 w-4 text-red-500',
      });
    case 'warning':
      return createElement(AlertTriangle, {
        className: 'h-4 w-4 text-yellow-500',
      });
    default:
      return createElement(CheckCircle, { className: 'h-4 w-4 text-blue-500' });
  }
}

/**
 * 심각도에 따른 색상 클래스 반환
 */
export function getSeverityColor(severity: IncidentSeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-red-200 bg-red-50';
    case 'warning':
      return 'border-yellow-200 bg-yellow-50';
    default:
      return 'border-blue-200 bg-blue-50';
  }
}

/**
 * 상태에 따른 배지 스타일 반환
 */
export function getStatusBadgeStyle(status: IncidentStatus): string {
  switch (status) {
    case 'active':
      return 'bg-red-100 text-red-700';
    case 'investigating':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-green-100 text-green-700';
  }
}

/**
 * 상태 라벨 반환
 */
export function getStatusLabel(status: IncidentStatus): string {
  switch (status) {
    case 'active':
      return '활성';
    case 'investigating':
      return '조사중';
    default:
      return '해결됨';
  }
}
