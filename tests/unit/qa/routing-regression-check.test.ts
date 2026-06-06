/**
 * @vitest-environment node
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildRoutingRegressionReport,
  formatRoutingRegressionReport,
  parseJsonPayload,
} = require('../../../scripts/qa/routing-regression-check.js');

describe('routing-regression-check', () => {
  it('compares Langfuse traces against expected routing cases', () => {
    const report = buildRoutingRegressionReport({
      baseline: {
        cases: [
          {
            id: 'cpu-top',
            query: 'CPU 사용률이 가장 높은 서버는?',
            expectedAgent: 'Metrics Query Agent',
            expectedProviders: ['groq', 'zai', 'mistral', 'cerebras'],
          },
          {
            id: 'incident-report',
            query: '장애 보고서 작성해줘',
            expectedAgent: 'Reporter Agent',
            expectedProviders: ['zai', 'mistral', 'groq', 'cerebras'],
          },
          {
            id: 'advisor-missing',
            query: '메모리 부족 해결 방법 알려줘',
            expectedAgent: 'Advisor Agent',
            expectedProviders: ['mistral', 'zai', 'groq', 'cerebras'],
          },
        ],
      },
      traces: [
        {
          name: 'supervisor-execution',
          timestamp: '2026-06-06T10:00:00.000Z',
          input: 'CPU 사용률이 가장 높은 서버는?',
          metadata: {
            success: true,
            finalAgent: 'Metrics Query Agent',
            provider: 'groq',
            routingDecisionTrace: {
              agentDecision: {
                selectedAgent: 'Metrics Query Agent',
              },
            },
          },
        },
        {
          name: 'supervisor-execution',
          timestamp: '2026-06-06T10:01:00.000Z',
          input: '장애 보고서 작성해줘',
          metadata: {
            success: true,
            finalAgent: 'Advisor Agent',
            provider: 'mistral',
          },
        },
      ],
    });

    expect(report.summary).toMatchObject({
      totalCases: 3,
      evaluatedCases: 2,
      passedCases: 1,
      driftCases: 1,
      missingCases: 1,
      driftRatePct: 50,
    });
    expect(report.results).toContainEqual(
      expect.objectContaining({
        id: 'incident-report',
        status: 'drift',
        actualAgent: 'Advisor Agent',
        expectedAgent: 'Reporter Agent',
      })
    );
    expect(report.results).toContainEqual(
      expect.objectContaining({
        id: 'advisor-missing',
        status: 'missing',
      })
    );
  });

  it('formats drift and missing cases for terminal review', () => {
    const text = formatRoutingRegressionReport({
      summary: {
        totalCases: 3,
        evaluatedCases: 2,
        passedCases: 1,
        driftCases: 1,
        missingCases: 1,
        driftRatePct: 50,
      },
      results: [
        {
          id: 'incident-report',
          query: '장애 보고서 작성해줘',
          status: 'drift',
          expectedAgent: 'Reporter Agent',
          actualAgent: 'Advisor Agent',
          expectedProviders: ['zai', 'mistral'],
          actualProvider: 'mistral',
          success: true,
          issues: ['agent_mismatch'],
        },
        {
          id: 'advisor-missing',
          query: '메모리 부족 해결 방법 알려줘',
          status: 'missing',
          expectedAgent: 'Advisor Agent',
          expectedProviders: ['mistral'],
          issues: ['trace_missing'],
        },
      ],
    });

    expect(text).toContain('Routing Regression Report');
    expect(text).toContain('drift: 1/2 (50%)');
    expect(text).toContain('incident-report');
    expect(text).toContain('agent_mismatch');
    expect(text).toContain('missing: 1');
  });

  it('parses JSON payload captured from npm run output', () => {
    const payload = parseJsonPayload(`
> openmanager-ai@8.12.99 langfuse:check
> node scripts/qa/langfuse-check.js --limit 100 --q supervisor --json

[
  {
    "name": "supervisor-execution",
    "input": "CPU 사용률이 가장 높은 서버는?",
    "metadata": {
      "finalAgent": "Metrics Query Agent",
      "provider": "groq"
    }
  }
]
`);

    expect(payload).toEqual([
      expect.objectContaining({
        name: 'supervisor-execution',
        input: 'CPU 사용률이 가장 높은 서버는?',
      }),
    ]);
  });
});
