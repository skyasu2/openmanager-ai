/**
 * 🎯 AI Content Area
 *
 * Renders the specific content page based on the selected AI function.
 * Extracted from AIFunctionPages to allow reuse in both Sidebar and Fullscreen modes.
 */

'use client';

import { lazy, Suspense } from 'react';
import type { AIAssistantFunction } from '@/components/ai/AIAssistantIconPanel';

// 📦 Dynamic imports for optimization
const AutoReportPage = lazy(
  () => import('@/components/ai/pages/AutoReportPage')
);
const IntelligentMonitoringPage = lazy(
  () => import('@/components/ai/pages/IntelligentMonitoringPage')
);

// 🔄 Loading Spinner (화이트 모드)
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
  return (
    <>
      {/* Chat placeholder - 실제 채팅은 AISidebarV4에서 렌더링 */}
      <div
        className="flex h-full items-center justify-center bg-white p-4 text-center text-gray-600"
        data-testid="chat-placeholder"
        style={{ display: selectedFunction === 'chat' ? 'flex' : 'none' }}
      >
        <div>
          <div className="mb-2 text-2xl">💬</div>
          <p className="text-gray-700">채팅 인터페이스가 여기에 표시됩니다.</p>
          <span className="text-sm text-gray-500">
            (AIWorkspace 또는 Sidebar에서 ChatInterface를 렌더링해야 함)
          </span>
        </div>
      </div>

      {/* Reporter - 탭 전환 시 상태 유지 */}
      <div
        className="h-full"
        data-testid="auto-report-page"
        style={{
          display: selectedFunction === 'auto-report' ? 'block' : 'none',
        }}
      >
        <Suspense fallback={<LoadingSpinner />}>
          <AutoReportPage />
        </Suspense>
      </div>

      {/* Analyst - 탭 전환 시 상태 유지 */}
      <div
        className="h-full"
        data-testid="intelligent-monitoring-page"
        style={{
          display:
            selectedFunction === 'intelligent-monitoring' ? 'block' : 'none',
        }}
      >
        <Suspense fallback={<LoadingSpinner />}>
          <IntelligentMonitoringPage />
        </Suspense>
      </div>

      {/* Default placeholder */}
      <div
        className="flex h-full items-center justify-center bg-white text-gray-600"
        data-testid="default-page"
        style={{
          display:
            selectedFunction !== 'chat' &&
            selectedFunction !== 'auto-report' &&
            selectedFunction !== 'intelligent-monitoring'
              ? 'flex'
              : 'none',
        }}
      >
        🤖 기능을 선택해주세요.
      </div>
    </>
  );
}
