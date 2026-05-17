import {
  ARTIFACT_CONTRACT_VERSION,
  type IncidentReportArtifact,
  type MonitoringAnalysisArtifact,
  type OpsProcedureArtifact,
  type ServerMonitoringAnalysisArtifact,
  type ServerSnapshotArtifact,
} from '@/lib/ai/chat-artifacts/types';
import {
  MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
  registerArtifactRenderer,
} from '@/lib/ai/domain-renderers/artifact-renderer-registry';
import { IncidentReportArtifactCard } from '../IncidentReportArtifactCard';
import { MonitoringAnalysisArtifactCard } from '../MonitoringAnalysisArtifactCard';
import { OpsProcedureArtifactCard } from '../OpsProcedureArtifactCard';
import { ServerMonitoringAnalysisArtifactCard } from '../ServerMonitoringAnalysisArtifactCard';
import { ServerSnapshotArtifactCard } from '../ServerSnapshotArtifactCard';

let monitoringArtifactRenderersRegistered = false;

export function registerMonitoringArtifactRenderers(): void {
  if (monitoringArtifactRenderersRegistered) return;

  const domainId = MONITORING_ARTIFACT_RENDERER_DOMAIN_ID;
  const artifactVersion = ARTIFACT_CONTRACT_VERSION;

  registerArtifactRenderer(
    { domainId, artifactKind: 'incident-report', artifactVersion },
    (artifact) => (
      <IncidentReportArtifactCard
        artifact={artifact as IncidentReportArtifact}
      />
    )
  );
  registerArtifactRenderer(
    { domainId, artifactKind: 'monitoring-analysis', artifactVersion },
    (artifact) => (
      <MonitoringAnalysisArtifactCard
        artifact={artifact as MonitoringAnalysisArtifact}
      />
    )
  );
  registerArtifactRenderer(
    {
      domainId,
      artifactKind: 'server-monitoring-analysis',
      artifactVersion,
    },
    (artifact) => (
      <ServerMonitoringAnalysisArtifactCard
        artifact={artifact as ServerMonitoringAnalysisArtifact}
      />
    )
  );
  registerArtifactRenderer(
    { domainId, artifactKind: 'server-snapshot', artifactVersion },
    (artifact) => (
      <ServerSnapshotArtifactCard
        artifact={artifact as ServerSnapshotArtifact}
      />
    )
  );
  registerArtifactRenderer(
    { domainId, artifactKind: 'ops-procedure', artifactVersion },
    (artifact) => (
      <OpsProcedureArtifactCard artifact={artifact as OpsProcedureArtifact} />
    )
  );

  monitoringArtifactRenderersRegistered = true;
}
