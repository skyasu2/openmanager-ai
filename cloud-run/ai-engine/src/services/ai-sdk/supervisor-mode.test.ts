import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSupervisorAssistantPlan,
  buildSupervisorAssistantPlanForRequest,
  buildSupervisorPlannerShadow,
  buildSupervisorRouteDecision,
  normalizeSupervisorLocalRouteDecision,
  refinePlannerShadowWithActualExecution,
  resolveSupervisorMode,
  resolveSupervisorModeDecision,
} from './supervisor-mode';
import { createMonitoringAssistantRuntimeHost } from './monitoring-runtime-host';

afterEach(() => {
  vi.restoreAllMocks();
});

const SHADOW_PLANNER_BASELINE_MAX_MISMATCHES = 5;
const SHADOW_PLANNER_BASELINE_LOCAL_BUDGET_MS = 200;
const SHADOW_PLANNER_BASELINE_CI_BUDGET_MS = 10_000;

function getShadowPlannerBaselineBudgetMs(): number {
  return process.env.CI === 'true'
    ? SHADOW_PLANNER_BASELINE_CI_BUDGET_MS
    : SHADOW_PLANNER_BASELINE_LOCAL_BUDGET_MS;
}

describe('resolveSupervisorMode', () => {
  it('upgrades explicit single request to multi when degraded single is disallowed', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    expect(
      resolveSupervisorMode({
        mode: 'single',
        messages: [{ role: 'user', content: '단순 상태 조회' }],
      }),
    ).toBe('multi');
  });

  it('keeps explicit single request when degraded single is allowed', () => {
    process.env.ALLOW_DEGRADED_SINGLE = 'true';
    expect(
      resolveSupervisorMode({
        mode: 'single',
        messages: [{ role: 'user', content: '단순 상태 조회' }],
      }),
    ).toBe('single');
    delete process.env.ALLOW_DEGRADED_SINGLE;
  });

  it('returns explicit mode without recalculating', () => {
    expect(
      resolveSupervisorMode({
        mode: 'multi',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toBe('multi');
  });

  it('resolves auto mode from the latest user message', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'user', content: '장애 보고서 생성해줘' }],
      }),
    ).toBe('multi');
  });

  it('routes image attachments to multi-agent vision path regardless of text complexity', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    const decision = resolveSupervisorModeDecision({
      mode: 'auto',
      messages: [
        {
          role: 'user',
          content: '첨부된 Playwright 스크린샷을 분석해줘',
        },
      ],
      images: [{ data: 'data:image/png;base64,aaa', mimeType: 'image/png' }],
    });

    expect(decision.resolvedMode).toBe('multi');
    expect(decision.modeSelectionSource).toBe('vision_input');
  });

  it('uses forwarded NLQ intentFrame executionMode for auto routing', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'user', content: '서버 상태 요약해줘' }],
        metadata: {
          intentFrame: {
            domainId: 'openmanager-monitoring',
            intent: 'server_health',
            capabilityId: 'monitoring.server_health',
            scope: 'whole_fleet',
            targets: [],
            aggregation: 'summary',
            ambiguity: 'low',
            executionMode: 'multi',
            confidence: 0.91,
          },
        },
      }),
    ).toBe('multi');
  });

  it('uses forwarded anomaly prediction intentFrame executionMode for auto routing', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'user', content: '장애 날 것 같은 서버 있어?' }],
        metadata: {
          intentFrame: {
            domainId: 'openmanager-monitoring',
            intent: 'failure_risk',
            capabilityId: 'monitoring.failure_risk',
            scope: 'whole_fleet',
            targets: [],
            metric: 'unknown',
            timeWindow: '6h',
            aggregation: 'summary',
            ambiguity: 'low',
            executionMode: 'multi',
            confidence: 0.92,
          },
        },
      })
    ).toBe('multi');
  });

  it('keeps low-complexity auto requests in single mode even when degraded single is disallowed', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toBe('single');
  });

  it('returns mode decision metadata for auto complexity routing', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;

    expect(
      resolveSupervisorModeDecision({
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toEqual({
      requestedMode: 'auto',
      resolvedMode: 'single',
      modeSelectionSource: 'auto_complexity',
      autoSelectedByComplexity: 'single',
    });
  });

  it('records explicit single upgrade decisions when degraded single is disallowed', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;

    expect(
      resolveSupervisorModeDecision({
        mode: 'single',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toEqual({
      requestedMode: 'single',
      resolvedMode: 'multi',
      modeSelectionSource: 'single_disallowed_upgrade',
    });
  });

  it('defaults to multi when no user message exists', () => {
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'assistant', content: '안녕하세요' }],
      }),
    ).toBe('multi');
  });

  it.each([
    {
      label: 'simple metric lookup',
      query: 'CPU 알려줘',
      resolvedMode: 'single',
      executionMode: 'single-agent',
    },
    {
      label: 'RCA/report escalation candidate',
      query: '전체 서버 장애 원인 분석 보고서 만들어줘',
      resolvedMode: 'multi',
      executionMode: 'multi-agent',
    },
  ])(
    'pins current Cloud Run supervisor baseline for $label',
    ({ query, resolvedMode, executionMode }) => {
      delete process.env.ALLOW_DEGRADED_SINGLE;

      const decision = resolveSupervisorModeDecision({
        mode: 'auto',
        messages: [{ role: 'user', content: query }],
      });
      const routeDecision = buildSupervisorRouteDecision(decision, {
        traceId: 'trace-m5a-baseline',
        queryAsOf: {
          dataSlot: {
            slotIndex: 131,
            minuteOfDay: 1310,
            timeLabel: '21:50 KST',
          },
        },
      });

      expect(decision.resolvedMode).toBe(resolvedMode);
      expect(buildSupervisorAssistantPlan(routeDecision)).toMatchObject({
        kind: 'chat',
        executionPath: 'stream',
        executionMode,
        stream: true,
        job: false,
        decidedBy: 'cloud-run',
        routeDecision: expect.objectContaining({
          intent: 'chat',
          executionPath: 'stream',
          mode: resolvedMode,
          traceId: 'trace-m5a-baseline',
          dataSlot: '21:50 KST',
        }),
      });
    }
  );
});

describe('supervisor planner shadow', () => {
  it('treats simple metric lookups as deterministic candidates without escalation', () => {
    const routeDecision = buildSupervisorRouteDecision(
      resolveSupervisorModeDecision({
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
      { traceId: 'trace-shadow-simple' }
    );
    const localRouteDecision = normalizeSupervisorLocalRouteDecision({
      intent: 'chat',
      executionPath: 'stream',
      complexity: 'simple',
      reasonCodes: ['complexity_below_threshold'],
      ruleVersion: '2026-05-03-v1',
      decidedBy: 'frontend',
      providerRawError: 'must not leak',
    });

    expect(localRouteDecision).toMatchObject({
      intent: 'chat',
      executionPath: 'stream',
      complexity: 'simple',
      reasonCodes: ['complexity_below_threshold'],
      decidedBy: 'frontend',
    });
    expect(localRouteDecision).not.toHaveProperty('providerRawError');

    const shadow = buildSupervisorPlannerShadow({
      request: {
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
        sessionId: 'session-shadow-simple',
      },
      routeDecision,
      localRouteDecision,
      latencyMs: 7,
    });

    expect(shadow).toMatchObject({
      candidate: {
        kind: 'chat',
        executionPath: 'stream',
        executionMode: 'deterministic',
        reasonCodes: ['metric_lookup'],
      },
      localDecision: expect.objectContaining({
        intent: 'chat',
        executionPath: 'stream',
        decidedBy: 'frontend',
      }),
      drift: {
        matched: true,
        reasonCodes: [],
      },
      latencyMs: 7,
    });
    expect(shadow.candidate).not.toHaveProperty('escalationReasonCodes');
  });

  it('marks report-style analysis as a multi-agent escalation candidate and reports drift', () => {
    const routeDecision = buildSupervisorRouteDecision(
      resolveSupervisorModeDecision({
        mode: 'auto',
        messages: [
          { role: 'user', content: '전체 서버 장애 원인 분석 보고서 만들어줘' },
        ],
      }),
      { traceId: 'trace-shadow-report' }
    );
    const localRouteDecision = normalizeSupervisorLocalRouteDecision({
      intent: 'chat',
      executionPath: 'stream',
      complexity: 'simple',
      reasonCodes: ['complexity_below_threshold'],
      ruleVersion: '2026-05-03-v1',
      decidedBy: 'frontend',
    });

    const shadow = buildSupervisorPlannerShadow({
      request: {
        mode: 'auto',
        messages: [
          { role: 'user', content: '전체 서버 장애 원인 분석 보고서 만들어줘' },
        ],
        sessionId: 'session-shadow-report',
      },
      routeDecision,
      localRouteDecision,
      latencyMs: 9,
    });

    expect(shadow.candidate).toMatchObject({
      kind: 'chat',
      executionPath: 'job',
      executionMode: 'multi-agent',
      escalationReasonCodes: ['incident_report_requested'],
    });
    expect(shadow.drift).toMatchObject({
      matched: false,
      reasonCodes: expect.arrayContaining([
        'execution_path_mismatch',
        'execution_mode_mismatch',
      ]),
    });
  });

  it('keeps formatting-only report rewrites out of incident report escalation', () => {
    const query =
      '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘';
      const routeDecision = buildSupervisorRouteDecision(
        resolveSupervisorModeDecision({
          mode: 'auto',
          messages: [{ role: 'user', content: query }],
        }),
      { traceId: 'trace-shadow-formatting-only' }
    );
    const shadow = buildSupervisorPlannerShadow({
      request: {
        mode: 'auto',
        messages: [{ role: 'user', content: query }],
        sessionId: 'session-shadow-formatting-only',
      },
      routeDecision,
      localRouteDecision: normalizeSupervisorLocalRouteDecision({
        intent: 'chat',
        executionPath: 'stream',
        mode: 'single',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'frontend',
      }),
      latencyMs: 5,
    });

    expect(routeDecision.mode).toBe('single');
    expect(shadow.candidate).toMatchObject({
      kind: 'chat',
      executionPath: 'stream',
      executionMode: 'single-agent',
      reasonCodes: ['single_agent_default'],
    });
    expect(shadow.candidate).not.toHaveProperty('escalationReasonCodes');
  });

  it('measures request shadow latency after candidate and drift are built', () => {
    let contentRead = false;
    vi.spyOn(performance, 'now').mockImplementation(() =>
      contentRead ? 1017 : 1000
    );

    const routeDecision = buildSupervisorRouteDecision({
      requestedMode: 'auto',
      resolvedMode: 'single',
      modeSelectionSource: 'auto_complexity',
      autoSelectedByComplexity: 'single',
    });
    const plan = buildSupervisorAssistantPlanForRequest(
      {
        mode: 'auto',
        sessionId: 'session-shadow-latency',
        messages: [
          {
            role: 'user',
            get content() {
              contentRead = true;
              return 'CPU 알려줘';
            },
          },
        ],
      },
      routeDecision
    );

    expect(contentRead).toBe(true);
    expect(plan.plannerShadow?.latencyMs).toBe(17);
  });

  it('records sub-millisecond shadow latency as observable telemetry', () => {
    let contentRead = false;
    vi.spyOn(performance, 'now').mockImplementation(() =>
      contentRead ? 1000.2 : 1000
    );

    const routeDecision = buildSupervisorRouteDecision({
      requestedMode: 'auto',
      resolvedMode: 'single',
      modeSelectionSource: 'auto_complexity',
      autoSelectedByComplexity: 'single',
    });
    const plan = buildSupervisorAssistantPlanForRequest(
      {
        mode: 'auto',
        sessionId: 'session-shadow-latency-sub-ms',
        messages: [
          {
            role: 'user',
            get content() {
              contentRead = true;
              return '운영 지표 용어 설명';
            },
          },
        ],
      },
      routeDecision
    );

    expect(contentRead).toBe(true);
    expect(plan.plannerShadow?.latencyMs).toBe(1);
  });

  it('keeps shadow planner drift within the rollout threshold on the baseline corpus', () => {
    const metricQueries = [
      'CPU 알려줘',
      'MEMORY 사용률 알려줘',
      'DISK 상태 알려줘',
      'network traffic 보여줘',
      '서버 health 확인',
      'CPU 높은 서버 알려줘',
      '메모리 높은 서버 목록',
      '디스크 80 이상 서버',
      'network 오류 상태',
      'server metrics',
      'CPU top 3',
      '현재 서버 상태',
    ];
    const artifactQueries = [
      '서버 상태 스냅샷 만들어줘',
      'server snapshot export',
      '인프라 상태 카드 생성',
      '서버 상태 스냅샷 JSON',
      '서버 상태 스냅샷 카드',
      'server snapshot card',
    ];
    const opsProcedureArtifactQueries = ['runbook 만들어줘'];
    const reportQueries = [
      '전체 서버 장애 원인 분석 보고서 만들어줘',
      'incident report 작성',
      '장애 분석 보고서',
      'postmortem 작성',
      '서버 사고 분석 리포트',
      '장애 보고서 생성',
      'incident summary report',
      '장애 원인 report',
    ];
    const rcaQueries = [
      '장애 원인 분석',
      'RCA 해줘',
      'root cause of CPU spike',
      '근본 원인 찾아줘',
      '상관관계 분석',
      '장애 원인 상관관계',
      'CPU spike 원인 분석',
      '에러율 상승 원인 분석',
    ];
    const advisorQueries = [
      '조치 방안 알려줘',
      '해결 방법 추천',
      'remediation plan',
      'how to fix CPU spike',
      '최적화 권장사항',
    ];
    const visionQueries = [
      '이미지 첨부된 대시보드 분석',
      'screenshot 분석',
      '그래프 이미지 원인',
      'alert 캡처 봐줘',
      'dashboard screenshot',
    ];
    const singleAgentQueries = [
      '안녕하세요',
      '운영 지표 용어 설명',
      'Prometheus가 뭐야',
      '도움말 알려줘',
      '이 기능 설명해줘',
    ];

    const cases = [
      ...metricQueries.map((query) => ({
        query,
        expectedExecutionMode: 'deterministic',
        localDecision: {
          intent: 'chat',
          executionPath: 'stream',
          complexity: 'simple',
          reasonCodes: ['complexity_below_threshold'],
          decidedBy: 'frontend',
        },
      })),
      ...artifactQueries.map((query) => ({
        query,
        expectedExecutionMode: 'deterministic',
        localDecision: {
          intent: 'artifact',
          executionPath: 'client-artifact',
          artifactKind: 'server-snapshot',
          reasonCodes: ['artifact_server-snapshot'],
          decidedBy: 'frontend',
        },
      })),
      ...opsProcedureArtifactQueries.map((query) => ({
        query,
        expectedExecutionMode: 'deterministic',
        localDecision: {
          intent: 'artifact',
          executionPath: 'client-artifact',
          artifactKind: 'ops-procedure',
          reasonCodes: ['artifact_ops-procedure'],
          decidedBy: 'frontend',
        },
      })),
      ...reportQueries.map((query) => ({
        query,
        expectedExecutionMode: 'multi-agent',
        localDecision: {
          intent: 'job',
          executionPath: 'job',
          complexity: 'complex',
          reasonCodes: ['job_queue_api'],
          decidedBy: 'bff',
        },
      })),
      ...rcaQueries.map((query) => ({
        query,
        expectedExecutionMode: 'multi-agent',
        localDecision: {
          intent: 'chat',
          executionPath: 'stream',
          mode: 'multi',
          reasonCodes: ['rca_requested'],
          decidedBy: 'frontend',
        },
      })),
      ...advisorQueries.map((query) => ({
        query,
        expectedExecutionMode: 'multi-agent',
        localDecision: {
          intent: 'chat',
          executionPath: 'stream',
          mode: 'multi',
          reasonCodes: ['advisor_requested'],
          decidedBy: 'frontend',
        },
      })),
      ...visionQueries.map((query) => ({
        query,
        expectedExecutionMode: 'multi-agent',
        images: [{ data: 'data:image/png;base64,aaa', mimeType: 'image/png' }],
        localDecision: {
          intent: 'chat',
          executionPath: 'stream',
          mode: 'multi',
          reasonCodes: ['attachment_streaming'],
          decidedBy: 'frontend',
        },
      })),
      ...singleAgentQueries.map((query) => ({
        query,
        expectedExecutionMode: 'single-agent',
        localDecision: {
          intent: 'chat',
          executionPath: 'stream',
          mode: 'single',
          reasonCodes: ['complexity_below_threshold'],
          decidedBy: 'frontend',
        },
      })),
    ];

    expect(cases).toHaveLength(50);

    const startedAt = Date.now();
    const runtimeHost = createMonitoringAssistantRuntimeHost();
    let mismatches = 0;
    for (const item of cases) {
      const routeDecision = buildSupervisorRouteDecision(
        resolveSupervisorModeDecision({
          mode: 'auto',
          messages: [{ role: 'user', content: item.query }],
          runtimeHost,
        })
      );
      const localRouteDecision = normalizeSupervisorLocalRouteDecision(
        item.localDecision
      );
      const shadow = buildSupervisorPlannerShadow({
        request: {
          mode: 'auto',
          messages: [{ role: 'user', content: item.query }],
          sessionId: 'session-shadow-corpus',
          images: item.images,
          runtimeHost,
        },
        routeDecision,
        localRouteDecision,
        latencyMs: 0,
      });

      expect(shadow.candidate.executionMode).toBe(
        item.expectedExecutionMode
      );
      if (shadow.drift?.matched === false) {
        mismatches += 1;
      }
    }

    expect(mismatches).toBeLessThanOrEqual(
      SHADOW_PLANNER_BASELINE_MAX_MISMATCHES
    );
    expect(Date.now() - startedAt).toBeLessThanOrEqual(
      getShadowPlannerBaselineBudgetMs()
    );
  });
});

describe('refinePlannerShadowWithActualExecution', () => {
  function makeShadowWithMissingDecision(
    candidateMode: 'deterministic' | 'single-agent' | 'multi-agent'
  ) {
    return buildSupervisorPlannerShadow({
      request: {
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 상태 알려줘' }],
        sessionId: 'session-refine-test',
      },
      routeDecision: buildSupervisorRouteDecision(
        { requestedMode: 'auto', resolvedMode: 'single', modeSelectionSource: 'auto_complexity' }
      ),
      localRouteDecision: undefined,
      latencyMs: 0,
    }) satisfies { candidate: { executionMode: string }; drift?: { matched: boolean; reasonCodes: string[] } };
  }

  it('deterministic 실행 후 shadow가 deterministic을 예측한 경우 matched: true로 변환', () => {
    const shadow = buildSupervisorPlannerShadow({
      request: {
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 상태 알려줘' }],
        sessionId: 's1',
      },
      routeDecision: buildSupervisorRouteDecision(
        { requestedMode: 'auto', resolvedMode: 'single', modeSelectionSource: 'auto_complexity' }
      ),
      localRouteDecision: undefined,
      latencyMs: 0,
    });

    expect(shadow.drift?.reasonCodes).toContain('local_decision_missing');

    const refined = refinePlannerShadowWithActualExecution(shadow, 'deterministic');

    expect(refined.drift?.matched).toBe(
      shadow.candidate.executionMode === 'deterministic'
    );
    expect(refined.drift?.reasonCodes).not.toContain('local_decision_missing');
  });

  it('actual deterministic이지만 shadow가 single-agent를 예측한 경우 execution_mode_mismatch', () => {
    const shadow = buildSupervisorPlannerShadow({
      request: {
        mode: 'auto',
        messages: [{ role: 'user', content: '장애 원인 분석해줘' }],
        sessionId: 's2',
      },
      routeDecision: buildSupervisorRouteDecision(
        { requestedMode: 'auto', resolvedMode: 'multi', modeSelectionSource: 'auto_complexity' }
      ),
      localRouteDecision: undefined,
      latencyMs: 0,
    });

    const refined = refinePlannerShadowWithActualExecution(shadow, 'deterministic');

    if (shadow.candidate.executionMode !== 'deterministic') {
      expect(refined.drift?.matched).toBe(false);
      expect(refined.drift?.reasonCodes).toContain('execution_mode_mismatch');
    }
  });

  it('localDecision이 있는 shadow는 건드리지 않음 (idempotent guard)', () => {
    const shadow = buildSupervisorPlannerShadow({
      request: {
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 상태 알려줘' }],
        sessionId: 's3',
      },
      routeDecision: buildSupervisorRouteDecision(
        { requestedMode: 'auto', resolvedMode: 'single', modeSelectionSource: 'auto_complexity' }
      ),
      localRouteDecision: normalizeSupervisorLocalRouteDecision({
        intent: 'chat',
        executionPath: 'stream',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'frontend',
      }),
      latencyMs: 0,
    });

    expect(shadow.drift?.reasonCodes).not.toContain('local_decision_missing');

    const refined = refinePlannerShadowWithActualExecution(shadow, 'deterministic');

    expect(refined).toBe(shadow);
  });

  it('actual single-agent이고 shadow도 single-agent를 예측한 경우 matched: true', () => {
    const shadow = buildSupervisorPlannerShadow({
      request: {
        mode: 'auto',
        messages: [{ role: 'user', content: '장애 원인 분석해줘' }],
        sessionId: 's4',
      },
      routeDecision: buildSupervisorRouteDecision(
        { requestedMode: 'auto', resolvedMode: 'single', modeSelectionSource: 'auto_complexity' }
      ),
      localRouteDecision: undefined,
      latencyMs: 0,
    });

    const refined = refinePlannerShadowWithActualExecution(shadow, 'single-agent');

    expect(refined.drift?.matched).toBe(
      shadow.candidate.executionMode === 'single-agent'
    );
    expect(refined.drift?.reasonCodes).not.toContain('local_decision_missing');
  });
});
