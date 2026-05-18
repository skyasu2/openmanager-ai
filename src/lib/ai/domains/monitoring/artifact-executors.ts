import { executeChatArtifact } from '@/lib/ai/chat-artifacts/artifact-execution';
import {
  type ArtifactExecutorContext,
  registerArtifactExecutor,
} from '@/lib/ai/chat-artifacts/artifact-executor-registry';
import {
  generateOpsProcedureArtifact,
  patchOpsProcedureArtifactFromQuery,
} from '@/lib/ai/chat-artifacts/ops-procedure-artifact';
import { generateServerSnapshotArtifact } from '@/lib/ai/chat-artifacts/server-snapshot-artifact';
import type { OpsProcedureArtifact } from '@/lib/ai/chat-artifacts/types';

let monitoringArtifactExecutorsRegistered = false;

function readBaseRequest({
  query,
  sessionId,
  queryAsOfDataSlot,
  signal,
}: ArtifactExecutorContext) {
  return {
    query,
    sessionId,
    signal,
    ...(queryAsOfDataSlot && { queryAsOfDataSlot }),
  };
}

function readPreviousOpsProcedureArtifact({
  readPreviousArtifact,
}: ArtifactExecutorContext): OpsProcedureArtifact | undefined {
  const artifact = readPreviousArtifact?.('ops-procedure');
  return artifact?.kind === 'ops-procedure'
    ? (artifact as OpsProcedureArtifact)
    : undefined;
}

async function executeOpsProcedureArtifact(
  context: ArtifactExecutorContext
): Promise<OpsProcedureArtifact> {
  const request = readBaseRequest(context);
  if (context.artifactIntent.reason !== 'ops_procedure_followup_edit_pattern') {
    return generateOpsProcedureArtifact(request);
  }

  const existingArtifact =
    readPreviousOpsProcedureArtifact(context) ??
    (await generateOpsProcedureArtifact(request));

  return patchOpsProcedureArtifactFromQuery(existingArtifact, context.query);
}

export function registerMonitoringArtifactExecutors(): void {
  if (monitoringArtifactExecutorsRegistered) return;

  registerArtifactExecutor({ kind: 'incident-report' }, (context) =>
    executeChatArtifact({
      kind: 'incident-report',
      ...readBaseRequest(context),
    })
  );
  registerArtifactExecutor({ kind: 'monitoring-analysis' }, (context) =>
    executeChatArtifact({
      kind: 'monitoring-analysis',
      ...readBaseRequest(context),
    })
  );
  registerArtifactExecutor(
    { kind: 'server-monitoring-analysis' },
    async (context) => {
      if (context.artifactIntent.kind !== 'server-monitoring-analysis') {
        return null;
      }

      return executeChatArtifact({
        kind: 'server-monitoring-analysis',
        ...readBaseRequest(context),
        serverId: context.artifactIntent.serverId,
        serverName:
          context.artifactIntent.serverName ?? context.artifactIntent.serverId,
      });
    }
  );
  registerArtifactExecutor({ kind: 'server-snapshot' }, (context) =>
    generateServerSnapshotArtifact(readBaseRequest(context))
  );
  registerArtifactExecutor({ kind: 'ops-procedure' }, (context) =>
    executeOpsProcedureArtifact(context)
  );

  monitoringArtifactExecutorsRegistered = true;
}
