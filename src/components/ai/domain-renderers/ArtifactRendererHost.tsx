import type {
  IncidentReportArtifact,
  MonitoringAnalysisArtifact,
  OpsProcedureArtifact,
  ServerMonitoringAnalysisArtifact,
  ServerSnapshotArtifact,
} from '@/lib/ai/chat-artifacts/types';
import {
  type ArtifactRendererEntry,
  resolveArtifactRendererEntries,
  type SupportedArtifactRendererEntry,
  type UnsupportedArtifactRendererEntry,
} from '@/lib/ai/domain-renderers/artifact-renderer-registry';
import { IncidentReportArtifactCard } from '../IncidentReportArtifactCard';
import { MonitoringAnalysisArtifactCard } from '../MonitoringAnalysisArtifactCard';
import { OpsProcedureArtifactCard } from '../OpsProcedureArtifactCard';
import { ServerMonitoringAnalysisArtifactCard } from '../ServerMonitoringAnalysisArtifactCard';
import { ServerSnapshotArtifactCard } from '../ServerSnapshotArtifactCard';

interface ArtifactRendererHostProps {
  metadata: unknown;
}

function UnsupportedArtifactFallback({
  entry,
}: {
  entry: UnsupportedArtifactRendererEntry;
}) {
  return (
    <div
      data-testid="unsupported-artifact-fallback"
      className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p className="font-semibold">지원하지 않는 아티팩트</p>
      <p className="mt-1 text-xs text-amber-700">
        {entry.domainId} / {entry.artifactKind}
      </p>
    </div>
  );
}

function renderSupportedArtifact(entry: SupportedArtifactRendererEntry) {
  switch (entry.artifactKind) {
    case 'incident-report':
      return (
        <IncidentReportArtifactCard
          artifact={entry.artifact as IncidentReportArtifact}
        />
      );
    case 'monitoring-analysis':
      return (
        <MonitoringAnalysisArtifactCard
          artifact={entry.artifact as MonitoringAnalysisArtifact}
        />
      );
    case 'server-monitoring-analysis':
      return (
        <ServerMonitoringAnalysisArtifactCard
          artifact={entry.artifact as ServerMonitoringAnalysisArtifact}
        />
      );
    case 'server-snapshot':
      return (
        <ServerSnapshotArtifactCard
          artifact={entry.artifact as ServerSnapshotArtifact}
        />
      );
    case 'ops-procedure':
      return (
        <OpsProcedureArtifactCard
          artifact={entry.artifact as OpsProcedureArtifact}
        />
      );
  }
}

function renderArtifactEntry(entry: ArtifactRendererEntry) {
  if (entry.status === 'unsupported') {
    return <UnsupportedArtifactFallback entry={entry} />;
  }

  return renderSupportedArtifact(entry);
}

export function ArtifactRendererHost({ metadata }: ArtifactRendererHostProps) {
  const entries = resolveArtifactRendererEntries(metadata);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 space-y-3" data-testid="artifact-renderer-host">
      {entries.map((entry) => (
        <div key={entry.key}>{renderArtifactEntry(entry)}</div>
      ))}
    </div>
  );
}
