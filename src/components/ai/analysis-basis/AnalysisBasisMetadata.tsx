import { BookOpen, Clock, Cpu, Database, ExternalLink } from 'lucide-react';
import {
  buildAnalysisFeatureStatus,
  buildVisibleFeatureStatusBadges,
  type FeatureStatusBadge,
} from '@/lib/ai/utils/retrieval-status';
import {
  getToolDescription,
  getToolLabel,
} from '@/lib/ai/utils/tool-presentation';
import type { AnalysisBasis } from '@/stores/useAISidebarStore';
import { ANALYSIS_MODE_LABELS } from '@/types/ai/analysis-mode';
import { extractDomain, getEngineColor } from './shared';

interface AnalysisBasisMetadataProps {
  basis: AnalysisBasis;
  meaningfulTools?: string[];
}

export function AnalysisBasisMetadata({
  basis,
  meaningfulTools,
}: AnalysisBasisMetadataProps) {
  const ragSources = basis.ragSources ?? [];
  const hasRagEvidence = ragSources.some(
    (source) => source.sourceType !== 'web'
  );
  const hasWebEvidence = ragSources.some(
    (source) => source.sourceType === 'web'
  );
  const hasLegacyRagEvidence =
    Boolean(basis.ragUsed) && !hasRagEvidence && !hasWebEvidence;
  const featureStatus =
    basis.featureStatus ??
    buildAnalysisFeatureStatus({
      retrieval: basis.retrieval,
      ragEnabled: Boolean(basis.ragUsed),
      hasKnowledgeEvidence: hasRagEvidence || hasLegacyRagEvidence,
      hasWebEvidence,
      analysisMode: basis.analysisMode,
    });
  const featureBadges = buildVisibleFeatureStatusBadges(featureStatus);

  const renderFeatureBadge = (badge: FeatureStatusBadge) => (
    <span
      key={badge.feature}
      className={`rounded-full px-1.5 py-0.5 text-xs ${badge.className}`}
      title={badge.state.reason}
    >
      {badge.label}
    </span>
  );

  return (
    <>
      {basis.analysisMode && (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            분석 강도
          </p>
          <p className="text-xs text-slate-700">
            {ANALYSIS_MODE_LABELS[basis.analysisMode]}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Database className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-gray-500">데이터:</span>
        <span className="text-gray-700">{basis.dataSource}</span>
      </div>

      <div className="flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-gray-500">엔진:</span>
        <span className={getEngineColor(basis.engine)}>{basis.engine}</span>
        {featureBadges.map(renderFeatureBadge)}
      </div>

      {meaningfulTools && meaningfulTools.length > 0 && (
        <div className="flex items-start gap-2">
          <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="shrink-0 text-gray-500">도구:</span>
          <div className="flex flex-wrap gap-1">
            {meaningfulTools.map((tool) => (
              <span
                key={tool}
                className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700"
                title={getToolDescription(tool) ?? undefined}
              >
                {getToolLabel(tool)}
              </span>
            ))}
          </div>
        </div>
      )}

      {basis.timeRange && (
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-gray-500">기간:</span>
          <span className="text-gray-700">{basis.timeRange}</span>
        </div>
      )}

      {basis.serverCount && (
        <div className="flex items-center gap-2">
          <span className="ml-5 text-gray-500">분석 서버:</span>
          <span className="text-gray-700">{basis.serverCount}개</span>
        </div>
      )}

      {ragSources.length > 0 && (
        <div className="mt-2 border-t border-gray-200 pt-2">
          <div className="mb-1.5 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-xs font-medium text-gray-600">
              RAG 참조 문서
            </span>
          </div>
          <div className="ml-5 space-y-1">
            {ragSources.map((source, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="shrink-0 text-gray-400">[{idx + 1}]</span>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-blue-600 hover:text-blue-800 hover:underline"
                    title={source.url}
                  >
                    {source.title}
                  </a>
                ) : (
                  <span
                    className="min-w-0 flex-1 truncate text-gray-700"
                    title={source.title}
                  >
                    {source.title}
                  </span>
                )}
                {source.url && (
                  <ExternalLink className="h-3 w-3 shrink-0 text-blue-400" />
                )}
                {source.sourceType !== 'web' && (
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 text-xs font-medium ${
                      source.similarity >= 0.8
                        ? 'bg-green-100 text-green-700'
                        : source.similarity >= 0.6
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {Math.round(source.similarity * 100)}%
                  </span>
                )}
                <span className="shrink-0 rounded bg-purple-50 px-1 py-0.5 text-xs text-purple-600">
                  {source.sourceType === 'web' && source.url
                    ? extractDomain(source.url)
                    : source.sourceType}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
