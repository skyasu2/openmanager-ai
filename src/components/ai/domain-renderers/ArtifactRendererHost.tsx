import {
  type ArtifactRendererEntry,
  resolveArtifactRenderer,
  resolveArtifactRendererEntries,
  type SupportedArtifactRendererEntry,
  type UnsupportedArtifactRendererEntry,
} from '@/lib/ai/domain-renderers/artifact-renderer-registry';
import { registerMonitoringArtifactRenderers } from './monitoring-artifact-renderers';

registerMonitoringArtifactRenderers();

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

function toMissingRendererEntry(
  entry: SupportedArtifactRendererEntry
): UnsupportedArtifactRendererEntry {
  return {
    status: 'unsupported',
    key: entry.key,
    domainId: entry.domainId,
    artifactKind: entry.artifactKind,
    artifactVersion: entry.artifactVersion,
    reason: 'unknown_renderer',
  };
}

function renderArtifactEntry(entry: ArtifactRendererEntry) {
  if (entry.status === 'unsupported') {
    return <UnsupportedArtifactFallback entry={entry} />;
  }

  const renderer = resolveArtifactRenderer(entry);
  if (!renderer) {
    return (
      <UnsupportedArtifactFallback entry={toMissingRendererEntry(entry)} />
    );
  }

  return renderer(entry.artifact, entry);
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
