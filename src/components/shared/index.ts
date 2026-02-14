/**
 * Shared Components Barrel Export
 *
 * @description Centralized exports for reusable shared components
 * @module @/components/shared
 */

// AI Features
export { AIInsightBadge, type InsightType } from './AIInsightBadge';
// Analytics & Data Visualization
export { AnomalyFeed } from './AnomalyFeed';
// Authentication UI
export { default as AuthLoadingUI } from './AuthLoadingUI';
// Layout & Containers
export { default as CollapsibleCard } from './CollapsibleCard';
// Error Handling
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
export { default as FeatureCardModal } from './FeatureCardModal';
export { default as FullScreenLayout } from './FullScreenLayout';
export { MiniLineChart } from './MiniLineChart';
// Branding
export { OpenManagerLogo } from './OpenManagerLogo';
export { DateTimeClock, RealtimeClock } from './RealtimeClock';
// Status & Indicators
export { ServerStatusIndicator } from './ServerStatusIndicator';
export { default as UnauthorizedAccessUI } from './UnauthorizedAccessUI';
export {
  default as UnifiedCircularGauge,
  ServerCardGauge,
  ServerModal3DGauge,
  ServerModalGauge,
  type UnifiedCircularGaugeProps,
} from './UnifiedCircularGauge';
export { default as UnifiedProfileHeader } from './UnifiedProfileHeader';
