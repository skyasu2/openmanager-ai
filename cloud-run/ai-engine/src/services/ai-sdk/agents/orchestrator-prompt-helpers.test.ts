import { describe, expect, it } from 'vitest';
import type { AgentConfig } from './config';
import {
  buildContextAwarePrompt,
  getAgentInstructions,
  getForcedRoutingCapabilityRequirements,
} from './orchestrator-prompt-helpers';

describe('orchestrator-prompt-helpers', () => {
  it('appends session context summary only when it is present', () => {
    expect(buildContextAwarePrompt('CPU 확인해줘')).toBe('CPU 확인해줘');
    expect(buildContextAwarePrompt('CPU 확인해줘', null)).toBe('CPU 확인해줘');
    expect(buildContextAwarePrompt('CPU 확인해줘', '')).toBe('CPU 확인해줘');

    expect(
      buildContextAwarePrompt('CPU 확인해줘', '이전 질문은 DB 서버 부하 확인')
    ).toBe(
      'CPU 확인해줘\n\n[세션 컨텍스트 요약]\n이전 질문은 DB 서버 부하 확인'
    );
  });

  it('prefers query-aware dynamic agent instructions over static instructions', () => {
    const staticConfig = {
      instructions: 'STATIC',
    } as AgentConfig;
    const dynamicConfig = {
      instructions: 'STATIC',
      getInstructions: (query: string) => `DYNAMIC:${query}`,
    } as AgentConfig;

    expect(getAgentInstructions(staticConfig, '메모리 확인')).toBe('STATIC');
    expect(getAgentInstructions(dynamicConfig, '메모리 확인')).toBe(
      'DYNAMIC:메모리 확인'
    );
  });

  it('maps forced routing model capability requirements by agent role', () => {
    expect(getForcedRoutingCapabilityRequirements('Metrics Query Agent')).toEqual(
      {
        requireToolCalling: true,
        minContextTokens: 16_000,
      }
    );
    expect(getForcedRoutingCapabilityRequirements('Reporter Agent')).toEqual({
      requireToolCalling: true,
      minContextTokens: 32_000,
    });
    expect(getForcedRoutingCapabilityRequirements('Unknown Agent')).toEqual({
      requireToolCalling: true,
    });
  });
});
