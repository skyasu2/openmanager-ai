import type {
  AgentRole,
  AgentRoleRegistry,
  AssistantArtifact,
  AssistantDomain,
  AssistantRequest,
  AssistantRequestContext,
  ArtifactCandidate,
  DomainCapabilityManifest,
  DomainEvidenceProvider,
  DomainFactPack,
  ToolDefinition,
} from '../core/assistant-runtime';

export const SAMPLE_DOMAIN_ID = 'sample-customer-success';
export const SAMPLE_DOMAIN_VERSION = '2026-05-05-test';
export const SAMPLE_HEALTH_ARTIFACT_KIND = 'sample-health-summary';
export const SAMPLE_RENEWAL_RISK_CAPABILITY_ID = 'sample.renewal_risk';

export const sampleDomainToolInput = {
  accountId: 'acct-123',
};

export const sampleRawArtifact = {
  kind: SAMPLE_HEALTH_ARTIFACT_KIND,
  accountId: 'acct-123',
  summary: 'Account health requires follow-up.',
  health: 'warning',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readAccountId(input: unknown): string {
  if (!isRecord(input) || typeof input.accountId !== 'string') {
    return 'unknown';
  }
  return input.accountId;
}

function createSampleRouteCandidate(context: AssistantRequestContext) {
  return {
    kind: 'artifact' as const,
    executionPath: 'client-artifact' as const,
    executionMode: 'deterministic' as const,
    domainId: context.domainId,
    reasonCodes: ['sample_health_summary_requested'],
    metadata: {
      artifactKind: SAMPLE_HEALTH_ARTIFACT_KIND,
    },
  };
}

const sampleLookupAccountTool: ToolDefinition = {
  name: 'sampleLookupAccount',
  description: 'Returns deterministic sample account health.',
  inputSchema: {
    type: 'object',
    properties: {
      accountId: { type: 'string' },
    },
    required: ['accountId'],
  },
  execute(input) {
    return {
      accountId: readAccountId(input),
      health: 'warning',
      summary: 'Account health requires follow-up.',
    };
  },
};

const sampleAgentRoles: AgentRole[] = [
  {
    id: 'account-health',
    name: 'Account Health Agent',
    description: 'Reviews deterministic account health facts.',
    matchPatterns: ['account health', 'health summary'],
    capabilities: ['sample-account-health'],
  },
  {
    id: 'follow-up-advisor',
    name: 'Follow-up Advisor Agent',
    description: 'Suggests deterministic customer follow-up actions.',
    matchPatterns: ['follow up', 'next action'],
    capabilities: ['sample-follow-up'],
  },
];

function cloneSampleAgentRole(role: AgentRole): AgentRole {
  return {
    ...role,
    ...(role.matchPatterns ? { matchPatterns: [...role.matchPatterns] } : {}),
    ...(role.capabilities ? { capabilities: [...role.capabilities] } : {}),
  };
}

const sampleAgentRoleRegistry: AgentRoleRegistry = {
  listRoles() {
    return sampleAgentRoles.map(cloneSampleAgentRole);
  },
  resolveRole(id) {
    const role = sampleAgentRoles.find((candidate) => candidate.id === id);
    return role ? cloneSampleAgentRole(role) : undefined;
  },
};

export const sampleRenewalRiskEvidenceProvider: DomainEvidenceProvider = {
  id: 'sample-renewal-risk-evidence',
  canHandle(request) {
    return (
      request.intentFrame?.domainId === SAMPLE_DOMAIN_ID &&
      request.intentFrame.intent === 'renewal_risk' &&
      (request.capability?.id === SAMPLE_RENEWAL_RISK_CAPABILITY_ID ||
        request.intentFrame.capabilityId === SAMPLE_RENEWAL_RISK_CAPABILITY_ID)
    ) ||
      /renewal risk|highest risk|risk account|위험/i.test(request.message);
  },
  async resolve(request) {
    const accountId = request.intentFrame?.targets[0] ?? 'acct-123';
    return {
      id: 'sample-renewal-risk-evidence',
      prompt: [
        '[Deterministic sample renewal-risk evidence]',
        'Question asks which sample customer account has the highest renewal risk.',
        `Highest-risk account: ${accountId}`,
        'Risk: high',
        'Use these facts unchanged, then add one short business interpretation sentence.',
      ].join('\n'),
      fallback: `${accountId} has the highest renewal risk in the sample fixture. Business interpretation: prioritize a follow-up because the account health is warning-level.`,
      metadata: {
        ...(request.intentFrame && {
          capabilityId: SAMPLE_RENEWAL_RISK_CAPABILITY_ID,
        }),
        accountId,
        risk: 'high',
        source: 'sample-fixture',
      },
    };
  },
};

export const sampleCapabilities: DomainCapabilityManifest = {
  domainId: SAMPLE_DOMAIN_ID,
  version: SAMPLE_DOMAIN_VERSION,
  capabilities: [
    {
      id: SAMPLE_RENEWAL_RISK_CAPABILITY_ID,
      description: 'Sample renewal risk evidence lookup.',
      intents: ['renewal_risk'],
      requiredSlots: ['targets'],
      optionalSlots: ['aggregation'],
    },
  ],
};

export const sampleDomainPack: AssistantDomain = {
  id: SAMPLE_DOMAIN_ID,
  version: SAMPLE_DOMAIN_VERSION,
  instructions: {
    system: 'Answer with deterministic customer success facts.',
    locale: 'en-US',
  },
  routingPolicy: {
    decide: createSampleRouteCandidate,
  },
  tools: {
    listTools() {
      return [sampleLookupAccountTool];
    },
    resolveTool(name) {
      return name === sampleLookupAccountTool.name
        ? sampleLookupAccountTool
        : undefined;
    },
  },
  artifacts: {
    classify(): ArtifactCandidate {
      return {
        kind: SAMPLE_HEALTH_ARTIFACT_KIND,
        version: SAMPLE_DOMAIN_VERSION,
      };
    },
    normalize(value: unknown): AssistantArtifact | undefined {
      if (!isRecord(value) || value.kind !== SAMPLE_HEALTH_ARTIFACT_KIND) {
        return undefined;
      }

      return {
        kind: SAMPLE_HEALTH_ARTIFACT_KIND,
        version: SAMPLE_DOMAIN_VERSION,
        payload: value,
      };
    },
  },
  facts: {
    build(input): DomainFactPack {
      return {
        domainId: input.context.domainId,
        version: SAMPLE_DOMAIN_VERSION,
        facts: {
          accountCount: 1,
          source: 'sample-fixture',
        },
      };
    },
  },
  agentRoles: sampleAgentRoleRegistry,
  capabilities: sampleCapabilities,
  evidenceProviders: [sampleRenewalRiskEvidenceProvider],
};

export function createSampleDomainRequest(message: string): AssistantRequest {
  return {
    id: 'sample-request-1',
    domainId: SAMPLE_DOMAIN_ID,
    message,
    messages: [{ role: 'user', content: message }],
    sessionId: 'sample-session-1',
  };
}
