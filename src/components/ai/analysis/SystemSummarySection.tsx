'use client';

import { Server } from 'lucide-react';
import type { SystemAnalysisSummary } from '@/types/intelligent-monitoring.types';
import { metricLabels, statusColors, statusLabel } from './constants';
import { formatPercentLabel } from './utils';

interface SystemSummarySectionProps {
  summary: SystemAnalysisSummary;
}

export function SystemSummarySection({ summary }: SystemSummarySectionProps) {
  return (
    <div
      className={`rounded-xl border p-4 ${statusColors[summary.overallStatus]}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          <h3 className="font-semibold">전체 시스템 상태</h3>
        </div>
        <span className="rounded-full px-3 py-1 text-sm font-bold">
          {statusLabel[summary.overallStatus]}
        </span>
      </div>

      {/* 서버 상태 요약 */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <div className="text-lg font-bold text-green-600">
            {summary.healthyServers}
          </div>
          <div className="text-xs text-gray-600">정상</div>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <div className="text-lg font-bold text-yellow-600">
            {summary.warningServers}
          </div>
          <div className="text-xs text-gray-600">주의</div>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <div className="text-lg font-bold text-red-600">
            {summary.criticalServers}
          </div>
          <div className="text-xs text-gray-600">위험</div>
        </div>
      </div>

      {/* Top Issues */}
      {summary.topIssues.length > 0 && (
        <div className="mb-3">
          <h4 className="mb-2 text-sm font-medium">주요 이슈</h4>
          <div className="space-y-1">
            {summary.topIssues.map((issue, idx) => (
              <div key={idx} className="rounded bg-white/60 px-2 py-1 text-xs">
                <div className="flex items-center justify-between">
                  <span>
                    {issue.serverName} -{' '}
                    {metricLabels[issue.metric] || issue.metric}
                  </span>
                  <span
                    className={`font-medium ${issue.severity === 'high' ? 'text-red-600' : 'text-yellow-600'}`}
                  >
                    {Math.round(issue.currentValue)}%
                  </span>
                </div>
                {issue.reason && (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {issue.reason}
                    {issue.confidence
                      ? ` · 신뢰도 ${Math.round(issue.confidence * 100)}%`
                      : ''}
                  </div>
                )}
                {issue.recommendation && (
                  <div className="mt-0.5 text-xs font-medium text-gray-600">
                    조치: {issue.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rising Trends */}
      {summary.predictions.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">상승 추세 경고</h4>
          <div className="space-y-1">
            {summary.predictions.map((pred, idx) => {
              const current = formatPercentLabel(pred.currentValue ?? 0);
              const hasPredictedValue =
                pred.predictionState !== 'missing' &&
                typeof pred.predictedValue === 'number' &&
                Number.isFinite(pred.predictedValue);
              const predicted = hasPredictedValue
                ? formatPercentLabel(pred.predictedValue ?? Number.NaN, {
                    clamp: true,
                  })
                : '예측값 없음';
              return (
                <div key={idx} className="rounded bg-white/60 px-2 py-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>
                      {pred.serverName} -{' '}
                      {metricLabels[pred.metric] || pred.metric}
                    </span>
                    <span className="font-medium text-orange-600">
                      {hasPredictedValue
                        ? `${current} → ${predicted}`
                        : `${current} · ${predicted}`}
                    </span>
                  </div>
                  {pred.thresholdBreachMessage && (
                    <div className="mt-0.5 text-xs text-orange-500">
                      {pred.thresholdBreachMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
