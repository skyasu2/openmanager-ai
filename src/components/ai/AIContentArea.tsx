/**
 * 🎯 AI Content Area
 *
 * Renders Reporter/Analyst pages with React Activity API for state preservation.
 * Uses mountedTabs pattern to lazy-load components only on first tab selection.
 */

'use client';

import { Activity, lazy, Suspense, useEffect, useState } from 'react';
import type { AIAssistantFunction } from '@/components/ai/AIAssistantIconPanel';

// 📦 Dynamic imports - only loaded when tab is first selected
const AutoReportPage = lazy(
  () => import('@/components/ai/pages/AutoReportPage')
);
const IntelligentMonitoringPage = lazy(
  () => import('@/components/ai/pages/IntelligentMonitoringPage')
);

// 🔄 Loading Spinner
const LoadingSpinner = () => (
  <div className="flex h-full items-center justify-center bg-white">
    <div className="flex flex-col items-center space-y-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      <span className="text-sm text-gray-600">로딩 중...</span>
    </div>
  </div>
);

interface AIContentAreaProps {
  selectedFunction: AIAssistantFunction;
}

export default function AIContentArea({
  selectedFunction,
}: AIContentAreaProps) {
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
    if (selectedFunction === 'chat') {
      return new Set();
    }

    return new Set([selectedFunction]);
  });

  const shouldRenderAutoReport =
    selectedFunction === 'auto-report' || mountedTabs.has('auto-report');
  const shouldRenderIntelligentMonitoring =
    selectedFunction === 'intelligent-monitoring' ||
    mountedTabs.has('intelligent-monitoring');

  useEffect(() => {
    if (selectedFunction === 'chat') return;
    setMountedTabs((prev) => {
      if (prev.has(selectedFunction)) return prev;
      return new Set(prev).add(selectedFunction);
    });
  }, [selectedFunction]);

  return (
    <>
      {shouldRenderAutoReport && (
        <Activity
          mode={selectedFunction === 'auto-report' ? 'visible' : 'hidden'}
        >
          <div className="h-full" data-testid="auto-report-page">
            <Suspense fallback={<LoadingSpinner />}>
              <AutoReportPage />
            </Suspense>
          </div>
        </Activity>
      )}
      {shouldRenderIntelligentMonitoring && (
        <Activity
          mode={
            selectedFunction === 'intelligent-monitoring' ? 'visible' : 'hidden'
          }
        >
          <div className="h-full" data-testid="intelligent-monitoring-page">
            <Suspense fallback={<LoadingSpinner />}>
              <IntelligentMonitoringPage />
            </Suspense>
          </div>
        </Activity>
      )}
    </>
  );
}
