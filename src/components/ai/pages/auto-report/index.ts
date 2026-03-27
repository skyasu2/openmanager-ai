/**
 * Auto Report Module - Re-export All
 *
 * 자동 장애 보고서 모듈
 */

// Main Component
export { default as AutoReportPage } from './AutoReportPage';
// Formatters
export {
  downloadReport,
  formatReportAsMarkdown,
  formatReportAsText,
} from './formatters';
// Sub Components
export { default as ReportCard } from './ReportCard';
// Types
export type {
  FilterOption,
  IncidentReport,
  ServerMetric,
} from './types';
// Utils
export {
  extractNumericValue,
  getSeverityColor,
  getSeverityIcon,
  getStatusBadgeStyle,
  getStatusLabel,
  mapSeverity,
} from './utils';
